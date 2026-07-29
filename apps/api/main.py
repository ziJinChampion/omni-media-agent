"""FastAPI admin API for omni-media-agent (SPEC §3.11)."""

from __future__ import annotations

import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.agents.graph import run_job
from core.agents.nodes import node_publish
from core.models.db import init_db
from core.models.entities import ContentJobRow, PublishRecordRow
from core.models.schemas import (
    AccountConfig,
    DraftContent,
    JobStatus,
    JudgeScore,
    Material,
    Metrics,
)
from core.scheduler.scheduler import load_account_configs

from apps.api.deps import get_accounts_config_path, get_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="omni-media-agent", lifespan=lifespan)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _jsonable(value: Any) -> Any:
    """Fallback serializer for state_json round-trips."""
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def _dump_state(state: dict[str, Any]) -> str:
    return json.dumps(state, ensure_ascii=False, default=_jsonable)


def _rehydrate_state(state: dict[str, Any]) -> dict[str, Any]:
    """Turn JSON-decoded state fields back into DTOs expected by the nodes."""
    if isinstance(state.get("account"), dict):
        state["account"] = AccountConfig.model_validate(state["account"])
    if isinstance(state.get("draft"), dict):
        state["draft"] = DraftContent.model_validate(state["draft"])
    if isinstance(state.get("materials"), list):
        state["materials"] = [
            Material.model_validate(m) if isinstance(m, dict) else m
            for m in state["materials"]
        ]
    if isinstance(state.get("judge"), dict):
        state["judge"] = JudgeScore.model_validate(state["judge"])
    return state


def _job_summary(row: ContentJobRow) -> dict[str, Any]:
    return {
        "job_id": row.id,
        "account_name": row.account_name,
        "status": row.status,
        "topic": row.topic,
        "error": row.error,
        "retry_count": row.retry_count,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _get_job_or_404(session: Session, job_id: str) -> ContentJobRow:
    row = session.get(ContentJobRow, job_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"job {job_id} not found")
    return row


def _require_awaiting_human(row: ContentJobRow) -> None:
    if JobStatus(row.status) is not JobStatus.AWAITING_HUMAN:
        raise HTTPException(
            status_code=409,
            detail=f"job {row.id} is {row.status}, expected {JobStatus.AWAITING_HUMAN.value}",
        )


# ---------------------------------------------------------------------------
# endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/accounts")
def list_accounts() -> list[AccountConfig]:
    return load_account_configs(get_accounts_config_path())


@app.post("/accounts/{name}/trigger")
def trigger_account(name: str, background_tasks: BackgroundTasks) -> dict[str, str]:
    configs = load_account_configs(get_accounts_config_path())
    account = next((c for c in configs if c.name == name), None)
    if account is None:
        raise HTTPException(status_code=404, detail=f"account {name} not found")
    job_id = str(uuid.uuid4())
    background_tasks.add_task(run_job, account, job_id)
    return {"job_id": job_id}


@app.get("/jobs")
def list_jobs(
    account: str | None = Query(default=None),
    status: JobStatus | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=500),
    session: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    stmt = select(ContentJobRow).order_by(ContentJobRow.created_at.desc()).limit(limit)
    if account is not None:
        stmt = stmt.where(ContentJobRow.account_name == account)
    if status is not None:
        stmt = stmt.where(ContentJobRow.status == status.value)
    return [_job_summary(row) for row in session.scalars(stmt).all()]


@app.get("/jobs/{job_id}")
def get_job(job_id: str, session: Session = Depends(get_db)) -> dict[str, Any]:
    row = _get_job_or_404(session, job_id)
    state = json.loads(row.state_json) if row.state_json else {}
    judge = json.loads(row.judge_json) if row.judge_json else None
    return {
        **_job_summary(row),
        "judge": judge,
        "state": state,
    }


@app.post("/jobs/{job_id}/approve")
def approve_job(job_id: str, session: Session = Depends(get_db)) -> dict[str, Any]:
    """Human approval: re-run the publish node for an AWAITING_HUMAN job."""
    row = _get_job_or_404(session, job_id)
    _require_awaiting_human(row)

    state = _rehydrate_state(json.loads(row.state_json)) if row.state_json else {}
    state.setdefault("job_id", row.id)
    try:
        update = node_publish(state)  # equivalent of the publish pipeline node
    except Exception as exc:  # state 不完整或平台 adapter 未实现（xhs/douyin）
        row.status = JobStatus.FAILED.value
        row.error = f"publish exception: {exc}"
        row.updated_at = datetime.now(timezone.utc)
        session.commit()
        raise HTTPException(status_code=422, detail=row.error) from exc
    state.update(update)

    publish_result = update.get("publish_result")
    if publish_result is not None and publish_result.success:
        row.status = JobStatus.PUBLISHED.value
        row.error = None
        account = state.get("account")
        platform = account.platform if account is not None else None
        platform_value = platform.value if isinstance(platform, Enum) else platform
        session.add(
            PublishRecordRow(
                job_id=row.id,
                platform=platform_value,
                platform_post_id=publish_result.platform_post_id,
                published_at=publish_result.published_at or datetime.now(timezone.utc),
                metrics_json=Metrics().model_dump_json(),
            )
        )
    else:
        row.status = JobStatus.FAILED.value
        row.error = (
            publish_result.error if publish_result is not None else "publish failed"
        )

    row.state_json = _dump_state(state)
    row.updated_at = datetime.now(timezone.utc)
    session.commit()
    return {**_job_summary(row), "publish_result": update.get("publish_result")}


@app.post("/jobs/{job_id}/reject")
def reject_job(job_id: str, session: Session = Depends(get_db)) -> dict[str, Any]:
    row = _get_job_or_404(session, job_id)
    _require_awaiting_human(row)
    row.status = JobStatus.FAILED.value
    row.error = "rejected by human"
    row.updated_at = datetime.now(timezone.utc)
    session.commit()
    return _job_summary(row)
