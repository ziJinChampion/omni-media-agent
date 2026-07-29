"""DTO round-trip and enum completeness tests (SPEC §4)."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from core.models.schemas import (
    AccountConfig,
    DraftContent,
    JobStatus,
    JudgeScore,
    Material,
    MaterialKind,
    Metrics,
    Platform,
    PublishResult,
    Vertical,
)


@pytest.mark.parametrize(
    "dto",
    [
        Material(kind=MaterialKind.TEXT, url="https://example.com/a", source="mock-search"),
        Material(
            kind=MaterialKind.IMAGE,
            url="https://picsum.photos/seed/x/800/600",
            source="mock-search",
            license="cc0",
            caption="cap",
        ),
        DraftContent(title="标题", body="正文", tags=["a", "b", "c"], image_urls=["u1"]),
        JudgeScore(accuracy=9.0, style=8.5, compliance=10.0, feedback="ok", passed=True),
        AccountConfig(
            name="animal-facts",
            platform=Platform.MOCK,
            vertical=Vertical.ANIMAL,
            keywords=["奇特动物"],
            cron="0 9 * * *",
        ),
        PublishResult(
            success=True,
            platform_post_id="mock-1",
            published_at=datetime.now(timezone.utc),
        ),
        PublishResult(success=False, error="boom"),
        Metrics(likes=1, collects=2, comments=3, shares=4),
    ],
)
def test_dto_roundtrip(dto) -> None:
    cls = type(dto)
    assert cls.model_validate(dto.model_dump()) == dto
    assert cls.model_validate_json(dto.model_dump_json()) == dto


def test_account_config_defaults() -> None:
    cfg = AccountConfig(
        name="x",
        platform=Platform.XHS,
        vertical=Vertical.CUSTOM,
        keywords=["k"],
        cron="* * * * *",
    )
    assert cfg.style_prompt == ""
    assert cfg.human_review is False
    assert cfg.max_posts_per_day == 1


def test_job_status_completeness() -> None:
    assert {s.name for s in JobStatus} == {
        "PENDING",
        "RESEARCHING",
        "DRAFTING",
        "REVIEWING",
        "REVISE",
        "AWAITING_HUMAN",
        "PUBLISHING",
        "PUBLISHED",
        "FAILED",
        "ALERT",
    }
    for s in JobStatus:
        assert s.value == s.name.lower()


def test_enum_values() -> None:
    assert {p.value for p in Platform} == {"xhs", "douyin", "mock"}
    assert {v.value for v in Vertical} == {"animal", "geography", "custom"}
    assert {m.value for m in MaterialKind} == {"text", "image"}
