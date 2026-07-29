"""Shared dependencies for the FastAPI admin app."""

from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy.orm import Session

from core.models.db import get_session

# Default path of the accounts YAML config; can be overridden via env so
# tests and deployments can point elsewhere without touching the CWD.
ACCOUNTS_CONFIG_ENV = "OMNI_ACCOUNTS_CONFIG"
DEFAULT_ACCOUNTS_CONFIG_PATH = "configs/accounts.yaml"


def get_accounts_config_path() -> str:
    """Path of the accounts YAML config (env-overridable)."""
    return os.environ.get(ACCOUNTS_CONFIG_ENV, DEFAULT_ACCOUNTS_CONFIG_PATH)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a DB session, closed after the request.

    Works whether ``core.models.db.get_session`` is a context manager or a
    session factory (SQLAlchemy ``Session`` is itself a context manager).
    """
    with get_session() as session:
        yield session
