import glob
import json
import os
import re
from datetime import datetime, timezone

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader

from brief.render import fmt
from pipeline.graph import run_assessment
from profile_core.builder import build_profile
from profile_core.loader import load_suppliers

_API_SECRET = os.environ.get("API_SECRET")  # None means no auth enforced


def _check_secret(x_api_secret: str | None):
    if _API_SECRET and x_api_secret != _API_SECRET:
        raise HTTPException(status_code=401, detail="invalid or missing API secret")


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://supplier-resilience-radar.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
    ],
    allow_origin_regex=r"https://supplier-resilience-radar[a-z0-9-]*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_DIR = "data/cache"
CONTRACTS_DIR = "data/contracts"


def _claim_to_dict(c):
    return {"text": c.text, "citations": list(c.citations)}


def state_to_response(state, cached: bool) -> dict:
    profile = state["profile"]
    rb = state.get("rendered_brief")
    research = state["research"]
    brief = None
    if rb is not None:
        brief = {
            "concentration_profile": [_claim_to_dict(c) for c in rb.concentration_profile],
            "risk_signals": [_claim_to_dict(c) for c in rb.risk_signals],
            "contract_implications": [_claim_to_dict(c) for c in rb.contract_implications],
            "recommended_actions": [_claim_to_dict(c) for c in rb.recommended_actions],
            "confidence": list(rb.confidence),
        }
    return {
        "supplier_id": profile.supplier_id,
        "supplier_name": profile.name,
        "profile": {
            "spend_share": profile.spend_share,
            "spend_share_display": fmt("spend_share", profile.spend_share),
            "skus_single_sourced": getattr(profile, "skus_single_sourced", None),
            "line_down_gap_weeks": getattr(profile, "line_down_gap_weeks", None),
            "concentration_score": profile.concentration_score,
        },
        "brief": brief,
        "violations": list(state.get("violations", [])),
        "meta": {
            "turns": research.turns, "forced": research.forced,
            "dropped_findings": len(research.dropped), "cached": cached,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
    }


def load_suppliers_summary():
    suppliers = load_suppliers()
    rows = []
    for s in suppliers:
        p = build_profile(s, suppliers)
        rows.append({
            "supplier_id": p.supplier_id, "name": p.name, "country": p.country,
            "category": p.category, "concentration_score": p.concentration_score,
            "spend_share": p.spend_share,
        })
    rows.sort(key=lambda r: r["concentration_score"], reverse=True)
    return rows


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/suppliers")
def suppliers():
    return load_suppliers_summary()


@app.post("/api/risk-brief/{supplier_id}")
def risk_brief(supplier_id: str, fresh: bool = False,
               x_api_secret: str | None = Header(default=None)):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"{supplier_id}.json")
    if not fresh and os.path.exists(path):
        with open(path) as f:
            resp = json.load(f)
        resp["meta"]["cached"] = True
        return resp
    _check_secret(x_api_secret)  # only checked when fresh=True (cached path returns above)
    try:
        state = run_assessment(supplier_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown supplier {supplier_id}")
    resp = state_to_response(state, cached=False)
    with open(path, "w") as f:
        json.dump(resp, f, indent=2)
    return resp


@app.get("/api/contract/{supplier_id}")
def contract(supplier_id: str):
    # Guard against path traversal — only allow the SUP-NNN pattern.
    if not re.fullmatch(r"SUP-\d+", supplier_id):
        raise HTTPException(status_code=400, detail="invalid supplier id")
    matches = glob.glob(os.path.join(CONTRACTS_DIR, f"{supplier_id}_*.md"))
    if not matches:
        raise HTTPException(status_code=404, detail="no contract on file")
    with open(matches[0], encoding="utf-8") as f:
        markdown = f.read()
    return {"markdown": markdown, "supplier_id": supplier_id}
