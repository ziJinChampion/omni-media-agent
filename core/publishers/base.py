"""发布适配层抽象与注册表（SPEC §3.4）。

新增平台 = 新增一个实现 PublisherAdapter 协议的模块，并在
get_adapter 注册表中登记。
"""

from __future__ import annotations

from typing import Protocol

from core.models.schemas import DraftContent, Metrics, Platform, PublishResult


class PublisherAdapter(Protocol):
    """平台发布适配器协议。

    publish 必须幂等：同一 job_id 重复调用返回相同 platform_post_id，
    不重复发帖。
    """

    platform: Platform

    def check_session(self) -> bool:
        """检查平台登录态是否有效。"""
        ...

    def publish(self, draft: DraftContent, job_id: str) -> PublishResult:
        """发布草稿；必须按 job_id 幂等。"""
        ...

    def fetch_metrics(self, platform_post_id: str) -> Metrics:
        """抓取已发布内容的互动数据。"""
        ...


# 注册表缓存：同一平台返回同一实例（保证 MockAdapter 的内存幂等字典
# 在进程内持续有效）。
_registry: dict[Platform, PublisherAdapter] = {}


def get_adapter(platform: Platform) -> PublisherAdapter:
    """按平台返回对应适配器实例（mock→MockAdapter；xhs/douyin→占位实现）。"""
    if platform in _registry:
        return _registry[platform]

    if platform is Platform.MOCK:
        from core.publishers.mock import MockAdapter

        adapter: PublisherAdapter = MockAdapter()
    elif platform is Platform.XHS:
        from core.publishers.xhs import XhsAdapter

        adapter = XhsAdapter()
    elif platform is Platform.DOUYIN:
        from core.publishers.douyin import DouyinAdapter

        adapter = DouyinAdapter()
    else:  # pragma: no cover - 防御未知平台
        raise ValueError(f"no publisher adapter registered for platform: {platform!r}")

    _registry[platform] = adapter
    return adapter
