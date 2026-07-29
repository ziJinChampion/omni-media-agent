"""内容生产流水线的八个节点（SPEC §3.8）。

每个节点签名为 ``def node_xxx(state: PipelineState) -> dict``，
返回增量更新（LangGraph 会合并进 PipelineState），并更新 ``status``。
"""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone

from core.agents.llm import get_llm
from core.agents.search import get_search_provider
from core.agents.state import PipelineState
from core.models.db import get_session
from core.models.entities import ContentJobRow
from core.models.schemas import (
    DraftContent,
    JobStatus,
    JudgeScore,
    MaterialKind,
)
from core.publishers.base import get_adapter

logger = logging.getLogger(__name__)

MAX_REVISE = 2
TITLE_MAX_LEN = 20


def _normalize_topic(topic: str) -> str:
    """选题归一化：去首尾空白、压缩内部空白、小写。"""
    return re.sub(r"\s+", " ", topic.strip()).lower()


def _topic_fingerprint(topic: str) -> str:
    """选题去重指纹：sha256(normalize(topic))。"""
    return hashlib.sha256(_normalize_topic(topic).encode("utf-8")).hexdigest()


def _historical_fingerprints(account_name: str) -> set[str]:
    """读取该账号历史 ContentJobRow 的 topic 指纹集合。DB 不可用时返回空集。"""
    try:
        with get_session() as session:
            rows = (
                session.query(ContentJobRow)
                .filter(ContentJobRow.account_name == account_name)
                .all()
            )
            return {
                _topic_fingerprint(row.topic) for row in rows if row.topic
            }
    except Exception as exc:  # DB 未初始化等场景降级为不去重
        logger.warning("dedup: failed to load history fingerprints: %s", exc)
        return set()


def _image_urls(materials: list) -> list[str]:
    return [m.url for m in materials if m.kind == MaterialKind.IMAGE]


def _build_draft(
    state: PipelineState,
    feedback: str | None = None,
) -> DraftContent:
    """按账号风格 + 素材生成 DraftContent（标题 ≤20 字、3-6 个 tags）。"""
    account = state["account"]
    topic = state.get("topic", "")
    materials = state.get("materials", [])
    llm = get_llm()

    sources = "\n".join(
        f"- {m.caption or m.url}（{m.url}）"
        for m in materials
        if m.kind == MaterialKind.TEXT
    )
    system = (
        "你是一名资深新媒体编辑，为指定垂类账号撰写内容。"
        f"账号风格要求：{account.style_prompt or '科普、有趣、易读'}"
    )
    prompt_parts = [
        f"主题：{topic}",
        f"垂类：{account.vertical.value}",
        f"关键词：{'、'.join(account.keywords)}",
        "参考资料：",
        sources or "（无）",
        "请撰写正文（分段短句，适合移动端阅读）。",
    ]
    if feedback:
        prompt_parts.append(f"上一轮审核反馈，请据此改进：{feedback}")
    body = llm.complete(system, "\n".join(prompt_parts))

    title = topic.strip() or "今日冷知识分享"
    if len(title) > TITLE_MAX_LEN:
        title = title[:TITLE_MAX_LEN]

    tags: list[str] = []
    for kw in account.keywords:
        if kw not in tags:
            tags.append(kw)
    if topic and topic not in tags:
        tags.append(topic[:10])
    tags = tags[:6] if len(tags) >= 3 else (tags + ["冷知识", "科普", "涨姿势"])[:6]

    return DraftContent(
        title=title,
        body=body,
        tags=tags,
        image_urls=_image_urls(materials),
    )


def node_discover(state: PipelineState) -> dict:
    """选题：search_topics(account.keywords) → topic_candidates。"""
    account = state["account"]
    provider = get_search_provider()
    candidates = provider.search_topics(account.keywords, limit=5)
    if not candidates:  # 兜底，保证流水线可继续
        candidates = [f"奇奇怪怪的{kw}大赏：你不知道的5个冷知识" for kw in account.keywords[:1]]
    logger.info("discover: %d topic candidates", len(candidates))
    return {"topic_candidates": candidates, "status": JobStatus.RESEARCHING}


def node_dedup(state: PipelineState) -> dict:
    """去重：与历史 topic 指纹比对，选中第一个未发的；全部重复则加日期后缀。"""
    account = state["account"]
    candidates = state.get("topic_candidates", [])
    if not candidates:
        return {"status": JobStatus.FAILED, "error": "no topic candidates"}

    history = _historical_fingerprints(account.name)
    selected: str | None = None
    for topic in candidates:
        if _topic_fingerprint(topic) not in history:
            selected = topic
            break
    if selected is None:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        selected = f"{candidates[0]}（{today}）"
        logger.info("dedup: all candidates duplicated, append date suffix")
    logger.info("dedup: selected topic %r", selected)
    return {"topic": selected, "status": JobStatus.RESEARCHING}


def node_research(state: PipelineState) -> dict:
    """检索资料：search_text(topic) → 累积进 materials。"""
    topic = state.get("topic", "")
    provider = get_search_provider()
    texts = provider.search_text(topic, limit=3)
    materials = list(state.get("materials", [])) + texts
    logger.info("research: +%d text materials", len(texts))
    return {"materials": materials, "status": JobStatus.RESEARCHING}


def node_collect_images(state: PipelineState) -> dict:
    """图片采集：search_images(topic) → 累积进 materials。"""
    topic = state.get("topic", "")
    provider = get_search_provider()
    images = provider.search_images(topic, limit=4)
    materials = list(state.get("materials", [])) + images
    logger.info("collect_images: +%d image materials", len(images))
    return {"materials": materials, "status": JobStatus.DRAFTING}


def node_draft(state: PipelineState) -> dict:
    """初稿生成：LLM 按 style_prompt + materials 生成 DraftContent。"""
    draft = _build_draft(state)
    logger.info("draft: title=%r, %d tags, %d images", draft.title, len(draft.tags), len(draft.image_urls))
    return {"draft": draft, "status": JobStatus.REVIEWING}


def node_judge(state: PipelineState) -> dict:
    """LLM 审核：三维打分；不通过转 revise（≤2 次），超限 FAILED，通过转人工或发布。"""
    account = state["account"]
    draft = state["draft"]
    revise_count = state.get("revise_count", 0)
    llm = get_llm()

    system = (
        "你是内容审核 judge。从事实准确性(accuracy)、平台风格契合度(style)、"
        "合规风险(compliance)三个维度按 0-10 打分，给出 feedback 与是否通过(passed)。"
        "以 JSON 输出：{\"accuracy\":..,\"style\":..,\"compliance\":..,\"feedback\":..,\"passed\":..}"
    )
    prompt = (
        f"标题：{draft.title}\n"
        f"正文：\n{draft.body}\n"
        f"标签：{'、'.join(draft.tags)}\n"
        f"账号风格要求：{account.style_prompt or '无'}"
    )
    raw = llm.complete_json(system, prompt)
    judge = JudgeScore(**raw)
    logger.info(
        "judge: passed=%s accuracy=%.1f style=%.1f compliance=%.1f",
        judge.passed, judge.accuracy, judge.style, judge.compliance,
    )

    update: dict = {"judge": judge}
    if not judge.passed:
        if revise_count < MAX_REVISE:
            update["status"] = JobStatus.REVISE
        else:
            update["status"] = JobStatus.FAILED
            update["error"] = "judge failed after max revise"
    else:
        update["status"] = JobStatus.AWAITING_HUMAN if account.human_review else JobStatus.PUBLISHING
    return update


def node_revise(state: PipelineState) -> dict:
    """重写：revise_count+1，把 judge.feedback 拼入 prompt 重新生成 draft。"""
    revise_count = state.get("revise_count", 0) + 1
    judge = state.get("judge")
    feedback = judge.feedback if judge else None
    draft = _build_draft(state, feedback=feedback)
    logger.info("revise: count=%d", revise_count)
    return {"draft": draft, "revise_count": revise_count, "status": JobStatus.REVIEWING}


def node_publish(state: PipelineState) -> dict:
    """发布：get_adapter(account.platform).publish(draft, job_id)。"""
    account = state["account"]
    draft = state["draft"]
    job_id = state["job_id"]
    adapter = get_adapter(account.platform)
    result = adapter.publish(draft, job_id)
    logger.info("publish: success=%s post_id=%s", result.success, result.platform_post_id)
    if result.success:
        return {
            "publish_result": result,
            "status": JobStatus.PUBLISHED,
            "error": None,
        }
    return {
        "publish_result": result,
        "status": JobStatus.FAILED,
        "error": result.error or "publish failed",
    }
