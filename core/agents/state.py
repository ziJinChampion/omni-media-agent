"""LangGraph 流水线共享状态（SPEC §3.7）。"""

from __future__ import annotations

from typing import TypedDict

from core.models.schemas import (
    AccountConfig,
    DraftContent,
    JobStatus,
    JudgeScore,
    Material,
    PublishResult,
)


class PipelineState(TypedDict, total=False):
    """内容生产流水线在节点间传递的状态（total=False，全部字段可选）。"""

    job_id: str
    account: AccountConfig
    topic_candidates: list[str]
    topic: str
    materials: list[Material]
    draft: DraftContent
    judge: JudgeScore
    revise_count: int  # 默认 0，上限 2
    status: JobStatus
    error: str | None
    publish_result: PublishResult
