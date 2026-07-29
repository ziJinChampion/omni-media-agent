"""数据库引擎 / 会话 / 初始化（SPEC §3.3）。

用法::

    from core.models.db import get_engine, get_session, init_db

    init_db()                       # 建表（自动创建 data/ 目录）
    with get_session() as session:  # Session 工厂，支持上下文管理器
        session.add(row)
        session.commit()

`get_session()` 每次调用基于当前 Settings.database_url 构建引擎与
sessionmaker；测试可通过设置环境变量 DATABASE_URL 切换数据库
（如 sqlite:///:memory:）。
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from core.config import Settings
from core.models.entities import Base


_engines: dict[str, Engine] = {}


def get_engine(url: str | None = None) -> Engine:
    """创建 SQLAlchemy Engine；url 缺省时取 Settings.database_url。

    按 URL 缓存复用 Engine：避免每次新建连接池，也保证
    ``sqlite:///:memory:`` 在多次 ``get_session()`` 间共享同一库。
    """
    if url is None:
        url = Settings().database_url
    engine = _engines.get(url)
    if engine is None:
        engine = create_engine(url)
        _engines[url] = engine
    return engine


def get_session() -> Session:
    """返回一个新的 Session（基于默认数据库 URL）。

    可作为上下文管理器使用::

        with get_session() as session:
            ...
    """
    factory = sessionmaker(bind=get_engine(), expire_on_commit=False)
    return factory()


def _ensure_sqlite_dir(url: str) -> None:
    """若是本地 sqlite 文件库，自动创建其所在目录（如 data/）。"""
    prefix = "sqlite:///"
    if url.startswith(prefix):
        path = url[len(prefix):]
        if path not in ("", ":memory:"):
            Path(path).expanduser().parent.mkdir(parents=True, exist_ok=True)


def init_db(engine: Engine | None = None) -> None:
    """create_all 建表；engine 缺省时基于默认 URL 创建，并自动创建 data/ 目录。"""
    if engine is None:
        url = Settings().database_url
        _ensure_sqlite_dir(url)
        engine = get_engine(url)
    Base.metadata.create_all(engine)
