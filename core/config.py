"""集中式配置读取（SPEC §1）。

所有配置只从环境变量读取（os.environ），带默认值；仓库中禁止出现真实密钥。
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class Settings:
    """应用配置，字段默认值与 .env.example 对齐。

    用法::

        settings = Settings()          # 从当前环境变量读取
        settings.database_url          # e.g. "sqlite:///data/omni.db"

    无 OMNI_LLM_API_KEY / OMNI_SEARCH_API_KEY 时，上层模块应降级到
    确定性 Mock 实现（SPEC §0 Mock 降级约定）。
    """

    database_url: str = field(
        default_factory=lambda: os.environ.get(
            "DATABASE_URL", "sqlite:///data/omni.db"
        )
    )
    llm_api_key: str = field(
        default_factory=lambda: os.environ.get("OMNI_LLM_API_KEY", "")
    )
    llm_base_url: str = field(
        default_factory=lambda: os.environ.get(
            "OMNI_LLM_BASE_URL", "https://api.openai.com/v1"
        )
    )
    llm_model: str = field(
        default_factory=lambda: os.environ.get("OMNI_LLM_MODEL", "gpt-4o-mini")
    )
    search_api_key: str = field(
        default_factory=lambda: os.environ.get("OMNI_SEARCH_API_KEY", "")
    )


def get_settings() -> Settings:
    """返回一个从当前环境变量构造的 Settings 实例。"""
    return Settings()
