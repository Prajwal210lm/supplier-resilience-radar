import os
import types

import pytest
from fastapi.testclient import TestClient

import backend.api as api

client = TestClient(api.app)


# --------------------------------------------------------------------------- #
# Canned state shaped the way run_assessment returns it
# --------------------------------------------------------------------------- #
def _canned_state():
    return {
        "supplier_id": "SUP-001",
        "profile": types.SimpleNamespace(
            supplier_id="SUP-001", name="Rheinkomp Compressors",
            country="Germany", category="compressors",
            concentration_score=94.0, spend_share=0.18,
        ),
        "research": types.SimpleNamespace(turns=2, forced=False, dropped=[]),
        "violations": [],
        "rendered_brief": types.SimpleNamespace(
            concentration_profile=[types.SimpleNamespace(text="score 94.0", citations=[])],
            risk_signals=[types.SimpleNamespace(
                text="German energy costs have risen.",
                citations=["https://reuters.com/energy"])],
            contract_implications=[],
            recommended_actions=[],
            confidence=["No public financial filings were found."],
        ),
    }


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #
def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_suppliers():
    r = client.get("/api/suppliers")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)
    assert len(body) == 25
    assert body[0]["supplier_id"] == "SUP-001"
    assert body[0]["concentration_score"] == 94.0
    for item in body:
        for key in ("supplier_id", "name", "country", "category",
                    "concentration_score", "spend_share"):
            assert key in item
    scores = [item["concentration_score"] for item in body]
    assert scores == sorted(scores, reverse=True)


def test_cache_flow(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "CACHE_DIR", str(tmp_path))
    counter = {"n": 0}

    def fake_run_assessment(supplier_id, client=None, store=None):
        counter["n"] += 1
        return _canned_state()

    monkeypatch.setattr(api, "run_assessment", fake_run_assessment)

    # No cache yet and not a fresh request: clean 200 with brief=null and a
    # no_cache meta note, WITHOUT triggering a live run or writing a cache file.
    r0 = client.post("/api/risk-brief/SUP-001")
    assert r0.status_code == 200
    body0 = r0.json()
    assert body0["brief"] is None
    assert body0["profile"] is None
    assert body0["meta"]["cached"] is False
    assert body0["meta"]["no_cache"] is True
    assert counter["n"] == 0
    assert os.listdir(str(tmp_path)) == []

    # First fresh call: live run, not cached, writes the cache file.
    r1 = client.post("/api/risk-brief/SUP-001?fresh=true")
    assert r1.status_code == 200
    assert r1.json()["meta"]["cached"] is False
    assert counter["n"] == 1
    assert any("SUP-001" in f for f in os.listdir(str(tmp_path)))

    # Second call without fresh: served from cache, run_assessment not invoked again.
    r2 = client.post("/api/risk-brief/SUP-001")
    assert r2.status_code == 200
    assert r2.json()["meta"]["cached"] is True
    assert counter["n"] == 1

    # fresh=true: bypass cache, force a live run.
    r3 = client.post("/api/risk-brief/SUP-001?fresh=true")
    assert r3.status_code == 200
    assert r3.json()["meta"]["cached"] is False
    assert counter["n"] == 2


def test_unknown_supplier_404(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "CACHE_DIR", str(tmp_path))

    def boom(supplier_id, client=None, store=None):
        raise KeyError(f"unknown supplier {supplier_id}")

    monkeypatch.setattr(api, "run_assessment", boom)

    r = client.post("/api/risk-brief/SUP-999?fresh=true")
    assert r.status_code == 404
