"""FastAPI TestClient tests (SPEC §4)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from apps.api.main import app
from core.models.schemas import JobStatus


@pytest.fixture()
def client():
    with TestClient(app) as c:  # triggers lifespan -> init_db()
        yield c


def test_health(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_accounts_returns_two(client: TestClient) -> None:
    resp = client.get("/accounts")
    assert resp.status_code == 200
    accounts = resp.json()
    assert len(accounts) == 2
    assert {a["name"] for a in accounts} == {"animal-facts", "geo-facts"}


def test_trigger_and_get_job(client: TestClient) -> None:
    resp = client.post("/accounts/animal-facts/trigger")
    assert resp.status_code == 200
    job_id = resp.json()["job_id"]

    resp = client.get(f"/jobs/{job_id}")
    assert resp.status_code == 200
    body = resp.json()
    # status must be a legal JobStatus value
    assert JobStatus(body["status"]) in set(JobStatus)
    assert body["job_id"] == job_id
    assert body["account_name"] == "animal-facts"


def test_trigger_unknown_account_404(client: TestClient) -> None:
    resp = client.post("/accounts/nope/trigger")
    assert resp.status_code == 404


def test_jobs_listing(client: TestClient) -> None:
    client.post("/accounts/animal-facts/trigger")
    resp = client.get("/jobs", params={"account": "animal-facts", "limit": 5})
    assert resp.status_code == 200
    jobs = resp.json()
    assert len(jobs) >= 1
    assert all(j["account_name"] == "animal-facts" for j in jobs)
    assert all(JobStatus(j["status"]) in set(JobStatus) for j in jobs)


def test_approve_reject_flow(client: TestClient) -> None:
    # geo-facts requires human review -> job should end up AWAITING_HUMAN.
    job_id = client.post("/accounts/geo-facts/trigger").json()["job_id"]
    job = client.get(f"/jobs/{job_id}").json()
    assert JobStatus(job["status"]) is JobStatus.AWAITING_HUMAN

    resp = client.post(f"/jobs/{job_id}/approve")
    assert resp.status_code == 200
    assert JobStatus(resp.json()["status"]) is JobStatus.PUBLISHED

    # second approve on a non-AWAITING_HUMAN job must conflict
    assert client.post(f"/jobs/{job_id}/approve").status_code == 409

    job_id2 = client.post("/accounts/geo-facts/trigger").json()["job_id"]
    resp = client.post(f"/jobs/{job_id2}/reject")
    assert resp.status_code == 200
    body = resp.json()
    assert JobStatus(body["status"]) is JobStatus.FAILED
    assert body["error"] == "rejected by human"

    assert client.post(f"/jobs/{job_id2}/reject").status_code == 409
