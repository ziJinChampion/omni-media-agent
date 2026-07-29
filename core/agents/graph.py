"""LangGraph 流水线编排与任务入口（SPEC §3.9）。"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from core.agents.nodes import (
    node_collect_images,
    node_dedup,
    node_discover,
    node_draft,
    node_judge,
    node_publish,
    node_research,
    node_revise,
)
from core.agents.state import PipelineState
from core.models.db import get_session, init_db
from core.models.entities import ContentJobRow, PublishRecordRow
from core.models.schemas import AccountConfig, JobStatus

logger = logging.getLogger(__name__)


def _route_after_judge(state: PipelineState) -> str:
    """judge 之后的条件路由：REVISE→revise，PUBLISHING→publish，其余结束。"""
    status = state.get("status")
    if status == JobStatus.REVISE:
        return "revise"
    if status == JobStatus.PUBLISHING:
        return "publish"
    # FAILED / AWAITING_HUMAN：结束，待人工处理
    return END


def build_pipeline() -> Any:
    """构建并编译内容生产流水线（StateGraph + MemorySaver 检查点）。"""
    graph = StateGraph(PipelineState)

    graph.add_node("discover", node_discover)
    graph.add_node("dedup", node_dedup)
    graph.add_node("research", node_research)
    graph.add_node("collect_images", node_collect_images)
    graph.add_node("draft", node_draft)
    graph.add_node("judge", node_judge)
    graph.add_node("revise", node_revise)
    graph.add_node("publish", node_publish)

    graph.set_entry_point("discover")
    graph.add_edge("discover", "dedup")
    graph.add_edge("dedup", "research")
    graph.add_edge("research", "collect_images")
    graph.add_edge("collect_images", "draft")
    graph.add_edge("draft", "judge")
    graph.add_conditional_edges(
        "judge",
        _route_after_judge,
        {"revise": "revise", "publish": "publish", END: END},
    )
    graph.add_edge("revise", "draft")
    graph.add_edge("publish", END)

    return graph.compile(checkpointer=MemorySaver())


def _serialize_state(state: PipelineState) -> str:
    """PipelineState → JSON 字符串（pydantic 模型 / 枚举自动序列化）。"""

    def default(obj: Any) -> Any:
        if hasattr(obj, "model_dump"):
            return obj.model_dump(mode="json")
        if isinstance(obj, datetime):
            return obj.isoformat()
        return str(obj)

    return json.dumps(dict(state), ensure_ascii=False, default=default)


def run_job(account: AccountConfig, job_id: str | None = None) -> PipelineState:
    """执行一次完整的内容生产任务，并落库 ContentJobRow / PublishRecordRow。

    流程：生成 job_id(uuid4) → init_db → 落 ContentJobRow(PENDING)
    → graph.invoke → 回写 ContentJobRow → 若 PUBLISHED 落 PublishRecordRow。
    """
    job_id = job_id or str(uuid.uuid4())
    init_db()

    now = datetime.now(timezone.utc)
    with get_session() as session:
        session.add(
            ContentJobRow(
                id=job_id,
                account_name=account.name,
                status=JobStatus.PENDING.value,
                topic="",
                state_json="{}",
                judge_json=None,
                error=None,
                retry_count=0,
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()

    initial_state: PipelineState = {
        "job_id": job_id,
        "account": account,
        "materials": [],
        "revise_count": 0,
        "status": JobStatus.PENDING,
        "error": None,
    }

    pipeline = build_pipeline()
    try:
        final_state: PipelineState = pipeline.invoke(
            initial_state,
            config={"configurable": {"thread_id": job_id}},
        )
    except Exception as exc:
        logger.exception("run_job %s failed", job_id)
        final_state = dict(initial_state)
        final_state["status"] = JobStatus.FAILED
        final_state["error"] = f"{type(exc).__name__}: {exc}"

    status = final_state.get("status", JobStatus.FAILED)
    topic = final_state.get("topic", "")
    judge = final_state.get("judge")
    error = final_state.get("error")

    with get_session() as session:
        row = session.get(ContentJobRow, job_id)
        if row is not None:
            row.status = status.value if isinstance(status, JobStatus) else str(status)
            row.topic = topic
            row.state_json = _serialize_state(final_state)
            row.judge_json = (
                judge.model_dump_json() if judge is not None else None
            )
            row.error = error
            row.updated_at = datetime.now(timezone.utc)

        if status == JobStatus.PUBLISHED:
            publish_result = final_state.get("publish_result")
            session.add(
                PublishRecordRow(
                    job_id=job_id,
                    platform=account.platform.value,
                    platform_post_id=(
                        publish_result.platform_post_id if publish_result else None
                    ),
                    published_at=(
                        publish_result.published_at
                        if publish_result and publish_result.published_at
                        else datetime.now(timezone.utc)
                    ),
                    metrics_json="{}",
                )
            )
        session.commit()

    logger.info("run_job %s finished with status=%s", job_id, status)
    return final_state
