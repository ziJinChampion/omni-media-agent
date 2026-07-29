"""End-to-end mock pipeline tests (SPEC §4).

Mock LLM + Mock Search + Mock Adapter: run_job(animal-facts) must reach
PUBLISHED, persist ContentJobRow/PublishRecordRow, and mock publishing must
be idempotent per job_id.
"""

from __future__ import annotations

import os

from sqlalchemy import select

from core.agents.graph import run_job
from core.models.db import get_session
from core.models.entities import ContentJobRow, PublishRecordRow
from core.models.schemas import (
    DraftContent,
    JobStatus,
    Platform,
    PublishResult,
)
from core.publishers.base import get_adapter
from core.scheduler.scheduler import load_account_configs

ACCOUNTS_PATH = os.environ["OMNI_ACCOUNTS_CONFIG"]


def _account(name: str = "animal-facts"):
    configs = load_account_configs(ACCOUNTS_PATH)
    return next(c for c in configs if c.name == name)


def _as_dict(model_or_dict):
    return model_or_dict if isinstance(model_or_dict, dict) else model_or_dict.model_dump()


def test_run_job_mock_end_to_end() -> None:
    account = _account()
    assert account.human_review is False  # animal-facts publishes automatically

    state = run_job(account)

    assert JobStatus(state["status"]) is JobStatus.PUBLISHED
    publish_result = PublishResult.model_validate(_as_dict(state["publish_result"]))
    assert publish_result.success is True
    assert publish_result.platform_post_id is not None
    assert publish_result.platform_post_id.startswith("mock-")

    job_id = state["job_id"]
    with get_session() as session:
        row = session.get(ContentJobRow, job_id)
        assert row is not None
        assert JobStatus(row.status) is JobStatus.PUBLISHED
        assert row.topic == state["topic"]

        records = session.scalars(
            select(PublishRecordRow).where(PublishRecordRow.job_id == job_id)
        ).all()
        assert len(records) == 1
        assert records[0].platform_post_id == publish_result.platform_post_id


def test_run_job_human_review_pauses() -> None:
    """geo-facts has human_review=true: pipeline must stop at AWAITING_HUMAN."""
    account = _account("geo-facts")
    state = run_job(account)
    assert JobStatus(state["status"]) is JobStatus.AWAITING_HUMAN


def test_mock_publish_idempotent() -> None:
    adapter = get_adapter(Platform.MOCK)
    draft = DraftContent(title="t", body="b", tags=["x"], image_urls=[])
    first = adapter.publish(draft, "job-idem-1")
    second = adapter.publish(draft, "job-idem-1")
    assert first.success and second.success
    assert first.platform_post_id == second.platform_post_id == "mock-job-idem-1"
