"""小红书（XHS）发布适配器 — 占位实现（SPEC §3.4）。

TODO: 小红书无公开内容发布 API，计划通过 Playwright 进行 web 端
自动化（扫码/扫码登录态持久化、创作者中心发稿流程）。实现时必须
保持按 job_id 幂等（发布前检查是否已发）。

合规提醒：web 端自动化可能违反平台服务条款并触发风控；接入前需
评估账号封禁风险、频率限制与适用法律，优先考虑官方开放平台渠道。
"""

from __future__ import annotations

from core.models.schemas import DraftContent, Metrics, Platform, PublishResult


class XhsAdapter:
    """小红书占位适配器：功能未实现，见模块 docstring 的 TODO 与合规提醒。"""

    platform: Platform = Platform.XHS

    def check_session(self) -> bool:
        """登录态检查未实现，占位返回 False。"""
        return False

    def publish(self, draft: DraftContent, job_id: str) -> PublishResult:
        raise NotImplementedError(
            "XhsAdapter.publish 未实现：待接入 Playwright web 端自动化，"
            "实现前请评估平台合规与风控风险（见模块 docstring）"
        )

    def fetch_metrics(self, platform_post_id: str) -> Metrics:
        raise NotImplementedError(
            "XhsAdapter.fetch_metrics 未实现：待接入 Playwright web 端自动化，"
            "实现前请评估平台合规与风控风险（见模块 docstring）"
        )
