"""SQLAlchemy 2.0 声明式实体（SPEC §3.2）。

JSON 字段（config_json / state_json / judge_json / metrics_json）统一用
Text 存序列化后的 JSON 字符串，序列化/反序列化由调用方负责。
时间统一 datetime.now(timezone.utc)（SPEC §0）。
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """所有 ORM 实体的声明式基类。"""


class AccountRow(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    platform: Mapped[str] = mapped_column(String(32), nullable=False)
    vertical: Mapped[str] = mapped_column(String(32), nullable=False)
    config_json: Mapped[str] = mapped_column(Text, nullable=False)  # AccountConfig JSON
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(nullable=False, default=_utcnow)


class ContentJobRow(Base):
    __tablename__ = "content_jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    account_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    topic: Mapped[str] = mapped_column(Text, nullable=False, default="")
    state_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")  # PipelineState JSON
    judge_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, default=_utcnow, onupdate=_utcnow
    )


class PublishRecordRow(Base):
    __tablename__ = "publish_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(
        ForeignKey("content_jobs.id"), nullable=False, index=True
    )
    platform: Mapped[str] = mapped_column(String(32), nullable=False)
    platform_post_id: Mapped[str] = mapped_column(String(128), nullable=False)
    published_at: Mapped[datetime] = mapped_column(nullable=False, default=_utcnow)
    metrics_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")  # Metrics JSON
