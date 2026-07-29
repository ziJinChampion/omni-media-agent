"""跨模块唯一数据格式（Pydantic DTO，SPEC §3.1）。"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class Platform(str, Enum):
    XHS = "xhs"
    DOUYIN = "douyin"
    MOCK = "mock"


class Vertical(str, Enum):
    ANIMAL = "animal"
    GEOGRAPHY = "geography"
    CUSTOM = "custom"


class JobStatus(str, Enum):
    PENDING = "pending"
    RESEARCHING = "researching"
    DRAFTING = "drafting"
    REVIEWING = "reviewing"
    REVISE = "revise"
    AWAITING_HUMAN = "awaiting_human"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED = "failed"
    ALERT = "alert"


class MaterialKind(str, Enum):
    TEXT = "text"
    IMAGE = "image"


class Material(BaseModel):
    kind: MaterialKind
    url: str  # 文本资料为来源页 URL，图片为图片 URL
    source: str  # 来源名（如 "mock-search"）
    license: str = "unknown"
    caption: str = ""


class DraftContent(BaseModel):
    title: str  # ≤20 字
    body: str
    tags: list[str]
    image_urls: list[str]


class JudgeScore(BaseModel):
    accuracy: float  # 0-10
    style: float  # 0-10
    compliance: float  # 0-10
    feedback: str
    passed: bool


class AccountConfig(BaseModel):
    name: str
    platform: Platform
    vertical: Vertical
    keywords: list[str]
    cron: str  # 标准 5 段 cron
    style_prompt: str = ""
    human_review: bool = False
    max_posts_per_day: int = 1


class PublishResult(BaseModel):
    success: bool
    platform_post_id: str | None = None
    error: str | None = None
    published_at: datetime | None = None


class Metrics(BaseModel):
    likes: int = 0
    collects: int = 0
    comments: int = 0
    shares: int = 0
