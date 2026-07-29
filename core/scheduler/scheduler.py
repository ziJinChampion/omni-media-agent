"""Per-account cron scheduling based on APScheduler.

Each account in ``configs/accounts.yaml`` gets a ``CronTrigger`` job that
executes ``core.agents.graph.run_job`` with:

* ``jitter`` (per-account, deterministic, within 300-1800 seconds) to
  stagger posts and reduce behavioural fingerprints;
* ``misfire_grace_time=3600`` so a missed fire window still runs;
* a per-day publishing cap: if the number of ContentJobRow rows created
  today (UTC) for the account already reaches ``max_posts_per_day``, the
  run is skipped and logged.
"""

from __future__ import annotations

import logging
import zlib
from datetime import datetime, time, timezone
from pathlib import Path

import yaml
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import func, select

from core.agents.graph import run_job
from core.models.db import get_session
from core.models.entities import ContentJobRow
from core.models.schemas import AccountConfig

logger = logging.getLogger(__name__)

DEFAULT_CONFIG_PATH = "configs/accounts.yaml"

# Jitter window in seconds, per SPEC §3.10 (300-1800).
JITTER_MIN_SECONDS = 300
JITTER_MAX_SECONDS = 1800

MISFIRE_GRACE_TIME_SECONDS = 3600

__all__ = ["load_account_configs", "start_scheduler", "DEFAULT_CONFIG_PATH"]


def load_account_configs(path: str = DEFAULT_CONFIG_PATH) -> list[AccountConfig]:
    """Load account configs from a YAML file shaped like::

        accounts:
          - name: ...
            platform: ...
            ...

    Returns a list of validated ``AccountConfig`` DTOs.
    """
    with Path(path).open("r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    accounts = raw.get("accounts", [])
    return [AccountConfig.model_validate(item) for item in accounts]


def _jitter_for(account_name: str) -> int:
    """Deterministic per-account jitter within [300, 1800] seconds."""
    span = JITTER_MAX_SECONDS - JITTER_MIN_SECONDS
    return JITTER_MIN_SECONDS + zlib.crc32(account_name.encode("utf-8")) % (span + 1)


def _posts_today(account_name: str, now: datetime | None = None) -> int:
    """Count ContentJobRow rows created today (UTC) for the account."""
    now = now or datetime.now(timezone.utc)
    day_start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
    with get_session() as session:
        stmt = (
            select(func.count())
            .select_from(ContentJobRow)
            .where(ContentJobRow.account_name == account_name)
            .where(ContentJobRow.created_at >= day_start)
        )
        return int(session.scalar(stmt) or 0)


def _run_job_with_limit(cfg: AccountConfig) -> None:
    """Wrapper registered with the scheduler: enforce the daily cap."""
    today = _posts_today(cfg.name)
    if today >= cfg.max_posts_per_day:
        logger.info(
            "skip run_job for account %s: daily cap reached (%d/%d today)",
            cfg.name,
            today,
            cfg.max_posts_per_day,
        )
        return
    logger.info("running job for account %s (%d/%d today)", cfg.name, today, cfg.max_posts_per_day)
    run_job(cfg)


def start_scheduler(config_path: str = DEFAULT_CONFIG_PATH) -> BackgroundScheduler:
    """Register one cron job per account and start a BackgroundScheduler."""
    configs = load_account_configs(config_path)
    scheduler = BackgroundScheduler()
    for cfg in configs:
        trigger = CronTrigger.from_crontab(cfg.cron)
        jitter = _jitter_for(cfg.name)
        scheduler.add_job(
            _run_job_with_limit,
            trigger=trigger,
            args=[cfg],
            id=f"run_job:{cfg.name}",
            name=f"run_job({cfg.name})",
            jitter=jitter,
            misfire_grace_time=MISFIRE_GRACE_TIME_SECONDS,
            replace_existing=True,
        )
        logger.info(
            "registered account %s cron=%r jitter=%ss max_posts_per_day=%d",
            cfg.name,
            cfg.cron,
            jitter,
            cfg.max_posts_per_day,
        )
    scheduler.start()
    return scheduler
