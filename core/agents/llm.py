"""LLM 客户端抽象：OpenAI 兼容实现与确定性 Mock 实现（SPEC §3.5）。

凭证零明文：API Key 只从环境变量 ``OMNI_LLM_API_KEY`` 读取；
无 Key 时 ``get_llm()`` 降级为确定性 ``MockLLM``，保证离线可测试。
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Protocol, runtime_checkable

import httpx

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-4o-mini"


@runtime_checkable
class LLMClient(Protocol):
    """LLM 客户端协议。"""

    def complete(self, system: str, prompt: str) -> str:
        """自由文本补全。"""
        ...

    def complete_json(self, system: str, prompt: str) -> dict:
        """要求模型输出 JSON 并解析为 dict；解析失败重试 1 次。"""
        ...


def _extract_json(text: str) -> dict:
    """从模型输出中提取 JSON 对象（容忍 markdown 代码块包裹）。"""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    # 找到第一个 {...} 区块，容忍前后多余文字
    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if match:
        cleaned = match.group(0)
    return json.loads(cleaned)


class OpenAICompatibleLLM:
    """OpenAI 兼容协议的 LLM 客户端（httpx POST {base_url}/chat/completions）。"""

    def __init__(
        self,
        api_key: str,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float = 60.0,
    ) -> None:
        self._api_key = api_key
        self._base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self._model = model or DEFAULT_MODEL
        self._timeout = timeout

    def _chat(self, system: str, prompt: str) -> str:
        url = f"{self._base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.7,
        }
        with httpx.Client(timeout=self._timeout) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"]["content"]

    def complete(self, system: str, prompt: str) -> str:
        return self._chat(system, prompt)

    def complete_json(self, system: str, prompt: str) -> dict:
        json_system = system + "\n请仅输出合法的 JSON 对象，不要输出任何其他文字。"
        last_error: Exception | None = None
        for attempt in range(2):  # 首次 + 重试 1 次
            try:
                return _extract_json(self._chat(json_system, prompt))
            except (json.JSONDecodeError, ValueError, KeyError) as exc:
                last_error = exc
                logger.warning("complete_json parse failed (attempt %d): %s", attempt + 1, exc)
        raise ValueError(f"LLM did not return valid JSON after retry: {last_error}")


class MockLLM:
    """确定性 Mock LLM：无 API Key 时的离线降级实现。"""

    def complete(self, system: str, prompt: str) -> str:
        keywords = self._extract_keywords(prompt)
        kw_text = "、".join(keywords) if keywords else "本期主题"
        return (
            f"大家好，今天聊聊{kw_text}！\n\n"
            f"围绕{kw_text}，我们整理了最值得关注的几个要点：\n"
            "1. 基础背景快速了解；\n"
            "2. 三个冷知识，颠覆认知；\n"
            "3. 实用小贴士，马上能用。\n\n"
            "你还知道哪些有趣的点？评论区告诉我～"
        )

    def complete_json(self, system: str, prompt: str) -> dict:
        if "judge" in system.lower():
            return {
                "accuracy": 9,
                "style": 9,
                "compliance": 9,
                "feedback": "mock pass",
                "passed": True,
            }
        # 其他 JSON 请求的合理默认
        keywords = self._extract_keywords(prompt)
        return {
            "title": "今日冷知识分享",
            "keywords": keywords,
            "summary": "mock structured output",
        }

    @staticmethod
    def _extract_keywords(text: str) -> list[str]:
        """从 prompt 里提取候选关键词（中文/英文词），用于模板填充。"""
        words = re.findall(r"[一-鿿]{2,}|[A-Za-z][A-Za-z0-9_-]+", text)
        seen: list[str] = []
        for w in words:
            if w not in seen and w.lower() not in {"system", "prompt", "json"}:
                seen.append(w)
            if len(seen) >= 5:
                break
        return seen


def get_llm() -> LLMClient:
    """按环境变量选择 LLM 实现：有 OMNI_LLM_API_KEY → OpenAI 兼容；否则 Mock。"""
    api_key = os.environ.get("OMNI_LLM_API_KEY", "").strip()
    if api_key:
        base_url = os.environ.get("OMNI_LLM_BASE_URL", "").strip() or None
        model = os.environ.get("OMNI_LLM_MODEL", "").strip() or None
        logger.info("Using OpenAICompatibleLLM (model=%s)", model or DEFAULT_MODEL)
        return OpenAICompatibleLLM(api_key=api_key, base_url=base_url, model=model)
    logger.info("OMNI_LLM_API_KEY not set, falling back to MockLLM")
    return MockLLM()
