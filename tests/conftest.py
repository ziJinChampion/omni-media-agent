"""Shared pytest fixtures (SPEC §4).

Sets DATABASE_URL to a throwaway SQLite file BEFORE any core module is
imported, so tests never pollute local data.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

_TEST_DB = Path(tempfile.mkdtemp(prefix="omni-test-")) / "test.db"

# Must be set before core.config / core.models.db are imported anywhere.
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"
# Point the API/scheduler config lookup at the repo's accounts.yaml so tests
# are independent of the current working directory.
os.environ.setdefault("OMNI_ACCOUNTS_CONFIG", str(ROOT / "configs" / "accounts.yaml"))
# Make sure mock fallbacks are used.
os.environ.pop("OMNI_LLM_API_KEY", None)
os.environ.pop("OMNI_SEARCH_API_KEY", None)
