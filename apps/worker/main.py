"""Worker entrypoint: ``python -m apps.worker.main`` (SPEC §3.12).

Initialises the DB, starts the per-account cron scheduler, prints the
registered jobs, then blocks forever.
"""

from __future__ import annotations

import logging
import os
import time

from core.models.db import init_db
from core.scheduler.scheduler import start_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    init_db()
    config_path = os.environ.get("OMNI_ACCOUNTS_CONFIG", "configs/accounts.yaml")
    scheduler = start_scheduler(config_path)
    jobs = scheduler.get_jobs()
    logger.info("scheduler started, %d job(s) registered:", len(jobs))
    for job in jobs:
        logger.info("  - %s (trigger=%s, next_run=%s)", job.id, job.trigger, job.next_run_time)
    try:
        while True:
            time.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        logger.info("shutting down scheduler")
        scheduler.shutdown()


if __name__ == "__main__":
    main()
