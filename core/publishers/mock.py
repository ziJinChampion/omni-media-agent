"""Mock 发布适配器（SPEC §3.4）。

内存字典按 job_id 幂等：同一 job_id 重复 publish 返回相同
platform_post_id，不重复"发帖"。fetch_metrics 返回确定性伪随机数据
（seed = post_id 的 sha256 哈希，跨进程稳定）。
"""

from __future__ import annotations

import hashlib
import random
from datetime import datetime, timezone

from core.models.schemas import DraftContent, Metrics, Platform, PublishResult


class MockAdapter:
    """离线可测试的 Mock 发布适配器。"""

    platform: Platform = Platform.MOCK

    def __init__(self) -> None:
        # job_id -> PublishResult，保证幂等
        self._published: dict[str, PublishResult] = {}

    def check_session(self) -> bool:
        return True

    def publish(self, draft: DraftContent, job_id: str) -> PublishResult:
        """按 job_id 幂等发布：重复调用直接返回首次结果。"""
        if job_id in self._published:
            return self._published[job_id]
        result = PublishResult(
            success=True,
            platform_post_id=f"mock-{job_id}",
            published_at=datetime.now(timezone.utc),
        )
        self._published[job_id] = result
        return result

    def fetch_metrics(self, platform_post_id: str) -> Metrics:
        """确定性伪随机指标：同一 post_id 永远返回相同数据。"""
        seed = int(
            hashlib.sha256(platform_post_id.encode("utf-8")).hexdigest(), 16
        )
        rng = random.Random(seed)
        likes = rng.randint(0, 10_000)
        return Metrics(
            likes=likes,
            collects=rng.randint(0, likes + 1),
            comments=rng.randint(0, 1_000),
            shares=rng.randint(0, 500),
        )
