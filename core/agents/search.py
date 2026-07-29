"""搜索源抽象：Tavily 实现与确定性 Mock 实现（SPEC §3.6）。

无 ``OMNI_SEARCH_API_KEY`` 时降级为 ``MockSearchProvider``，离线可测试。
"""

from __future__ import annotations

import hashlib
import logging
import os
from typing import Any, Protocol, runtime_checkable

import httpx

from core.models.schemas import Material, MaterialKind

logger = logging.getLogger(__name__)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"


def _slug(text: str) -> str:
    """由文本生成确定性 slug（用于 Mock URL，兼容中文）。"""
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:10]
    safe = "".join(ch for ch in text if ch.isalnum())[:20]
    return f"{safe}-{digest}" if safe else digest


@runtime_checkable
class SearchProvider(Protocol):
    """搜索源协议。"""

    def search_topics(self, keywords: list[str], limit: int = 5) -> list[str]:
        """按关键词返回候选选题。"""
        ...

    def search_text(self, query: str, limit: int = 3) -> list[Material]:
        """围绕选题检索文本资料。"""
        ...

    def search_images(self, query: str, limit: int = 4) -> list[Material]:
        """围绕选题检索图片素材。"""
        ...


class TavilyProvider:
    """Tavily 搜索实现（占位，httpx 调用 https://api.tavily.com/search）。"""

    def __init__(self, api_key: str, timeout: float = 30.0) -> None:
        self._api_key = api_key
        self._timeout = timeout

    def _search(self, query: str, limit: int) -> dict[str, Any]:
        payload = {"api_key": self._api_key, "query": query, "max_results": limit}
        with httpx.Client(timeout=self._timeout) as client:
            resp = client.post(TAVILY_SEARCH_URL, json=payload)
            resp.raise_for_status()
            return resp.json()

    def search_topics(self, keywords: list[str], limit: int = 5) -> list[str]:
        topics: list[str] = []
        for kw in keywords:
            if len(topics) >= limit:
                break
            try:
                data = self._search(f"{kw} 热门话题", 2)
                for item in data.get("results", []):
                    title = str(item.get("title", "")).strip()
                    if title and title not in topics:
                        topics.append(title)
                    if len(topics) >= limit:
                        break
            except httpx.HTTPError as exc:
                logger.warning("Tavily topic search failed for %r: %s", kw, exc)
        return topics[:limit]

    def search_text(self, query: str, limit: int = 3) -> list[Material]:
        data = self._search(query, limit)
        materials: list[Material] = []
        for item in data.get("results", [])[:limit]:
            url = str(item.get("url", "")).strip()
            if not url:
                continue
            materials.append(
                Material(
                    kind=MaterialKind.TEXT,
                    url=url,
                    source="tavily",
                    license="unknown",
                    caption=str(item.get("title", "")).strip(),
                )
            )
        return materials

    def search_images(self, query: str, limit: int = 4) -> list[Material]:
        # Tavily 主接口为文本搜索；图片检索为占位实现，返回空列表并记录日志。
        logger.info("TavilyProvider.search_images is a placeholder, returning [] for %r", query)
        return []


class MockSearchProvider:
    """确定性 Mock 搜索源：由关键词/查询生成可复现的选题与素材。"""

    def search_topics(self, keywords: list[str], limit: int = 5) -> list[str]:
        templates = [
            "奇奇怪怪的{kw}大赏：你不知道的5个冷知识",
            "{kw}图鉴：看完直呼涨知识",
            "关于{kw}，99%的人都不知道的事",
            "硬核科普：{kw}背后的秘密",
            "{kw}之最盘点，第一名实至名归",
        ]
        topics: list[str] = []
        for i, kw in enumerate(keywords):
            if len(topics) >= limit:
                break
            topics.append(templates[i % len(templates)].format(kw=kw))
        # 关键词多于 limit 时按确定性顺序补齐
        idx = 0
        while len(topics) < limit and keywords:
            kw = keywords[idx % len(keywords)]
            candidate = templates[(idx + 1) % len(templates)].format(kw=kw)
            if candidate not in topics:
                topics.append(candidate)
            idx += 1
        return topics[:limit]

    def search_text(self, query: str, limit: int = 3) -> list[Material]:
        return [
            Material(
                kind=MaterialKind.TEXT,
                url=f"https://example.com/{_slug(query)}-{i}",
                source="mock-search",
                license="unknown",
                caption=f"{query} 参考资料 {i + 1}",
            )
            for i in range(limit)
        ]

    def search_images(self, query: str, limit: int = 4) -> list[Material]:
        return [
            Material(
                kind=MaterialKind.IMAGE,
                url=f"https://picsum.photos/seed/{_slug(query)}-{i}/800/600",
                source="mock-search",
                license="unknown",
                caption=f"{query} 配图 {i + 1}",
            )
            for i in range(limit)
        ]


def get_search_provider() -> SearchProvider:
    """按环境变量选择搜索实现：有 OMNI_SEARCH_API_KEY → Tavily；否则 Mock。"""
    api_key = os.environ.get("OMNI_SEARCH_API_KEY", "").strip()
    if api_key:
        logger.info("Using TavilyProvider")
        return TavilyProvider(api_key=api_key)
    logger.info("OMNI_SEARCH_API_KEY not set, falling back to MockSearchProvider")
    return MockSearchProvider()
