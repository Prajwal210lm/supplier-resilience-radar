# Supplier Resilience Radar

An AI agent that assesses a single supplier's risk to a GCC industrial manufacturer and writes a board-ready brief where every number is computed by tested code and every external claim is traced to a source the agent actually retrieved.

> Project 2 of 4 in an AI Supply Chain Portfolio. Project 1 (Liquidity Lens) was a closed deterministic pipeline for working-capital diagnostics. This project is its architectural opposite: an outward-facing research agent that reaches into the live web and the supplier's own contracts.

---

## The problem

A GCC chiller manufacturer builds its products around a few imported critical components. A chiller is built around its compressor, and compressors come from a handful of global makers whose units can't be swapped without redesign and recertification. When a single-source supplier fails, the production line stops, construction and district-cooling milestones slip, and liquidated damages follow.

Everyone knows supplier concentration is dangerous. Nobody assesses it proactively, because doing so means cross-referencing internal procurement data, live external signals, and the supplier contract, which takes an analyst 2–3 days per supplier. Across 100+ suppliers it happens reactively, after the shipment fails, when the only options left are expensive.

This tool produces the assessment in minutes: a sourced, board-ready risk brief for one supplier, on demand.

## What it produces

A five-section brief for a supplier:

1. **Concentration profile** — exposure in our own book (spend share, single-source count, line-down gap, a 0–100 concentration score). All computed by tested Python.
2. **Risk signals** — live external risks found by web research, each citing a URL.
3. **Contract implications** — what the supplier's contract says about those risks, each citing a clause.
4. **Recommended actions** — prioritised mitigations, each grounded in a finding.
5. **Confidence** — what the agent searched for and could not establish.

On the lead supplier (SUP-001, a single-source German compressor maker): **94.0/100** concentration score, **18%** of spend (AED 86.4M), **10-week** line-down gap, with the agent finding German industrial contraction, Hamburg port congestion, and a contract whose force-majeure clause excludes the very disruptions most likely to occur.

## Architecture

```
                         supplier_id
                              │
                              ▼
                    ┌───────────────────┐   deterministic · tested Python · no LLM
                    │     PROFILE       │   spend share · single-source count ·
                    │                   │   days-of-cover · line-down gap ·
                    └─────────┬─────────┘   0–100 concentration score
                              │             → SupplierProfile + render context
                              ▼
                    ┌───────────────────┐   agentic ReAct loop · Sonnet 4.6 · 6-turn cap
                    │     RESEARCH      │   tools: web_search (server) +
                    │   ┌──► reason     │          contract_search (RAG · client)
                    │   │    act ──┐    │   angles: company · country ·
                    │   └─────◄────┘    │           logistics · contract
                    └─────────┬─────────┘   → ResearchFindings + FindingsLedger
                              │               (ledger = ground truth of what was retrieved)
                              ▼
                    ┌───────────────────┐   forced structured output · writes NO digits
                    │    SYNTHESIZE     │   numbers → {{placeholders}} ·
                    │                   │   claims  → citations
                    └─────────┬─────────┘   → RiskBrief
                              │
                              ▼
                    ┌───────────────────┐   deterministic · no LLM
                    │     VALIDATE      │   placeholders resolve · citations in ledger ·
                    │                   │   no bare digits · confidence present
                    └─────────┬─────────┘   → render, or reject with violations
                              │
                              ▼
              Risk Brief — every number traced to code, every claim to a source
```

Wired as a LangGraph `StateGraph`; the Anthropic client and the contract store reach the nodes via closures, never through state.

## Key design decisions

**The LLM computes nothing.** Every figure is deterministic, unit-tested Python. The model writes placeholder tokens; a renderer substitutes real values only after a validator confirms each placeholder resolves to a real field. The validator rejects any bare digit in prose, even a correct one.

**Split traceability.** Two rails, separated physically in the data. Numbers live as `{{placeholders}}` resolving to the deterministic core. External claims live as citations resolving to the ledger. Gaps live in a mandatory confidence section. None of it is promised by a prompt; all of it is enforced by code.

**Two-gate fabrication defense.** As tools return, code builds a `FindingsLedger` of every URL and clause actually retrieved. At research exit, findings citing unledgered sources are dropped. At validation, the finished brief is re-checked against the same ledger. The agent reaches into the live web yet cannot cite what it didn't retrieve. Proven by an adversarial test that plants a fabricated URL and confirms it's cut.

**Structural supplier isolation.** The contract-search tool never exposes the supplier identity as a model-settable parameter; the run injects it. The model cannot query the wrong supplier's contract because the lever doesn't exist in its hands. Proven by a test that smuggles a foreign supplier id and confirms it's ignored, with both German contracts present so the case is hard.

**Right-sized retrieval.** 36 contract clauses, so the vector store is cosine similarity over local embeddings (all-MiniLM-L6-v2) in memory, not a vector database. Contract text never leaves the machine. The interface is kept swappable for a real corpus.

## Tech stack

Python · FastAPI · LangGraph · Claude (Anthropic API) · sentence-transformers (local embeddings) · Next.js + Tailwind · pytest. 46 tests on a red-before-green discipline: hand-verified deterministic fixtures, mocked agent loops, adversarial validators, plus skip-by-default live integration tests.

## How to run

Requirements: Python 3.11+, Node 18+, an `ANTHROPIC_API_KEY`.

```bash
# 1. Backend
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
uvicorn backend.api:app --reload --port 8000

# 2. Frontend (separate terminal)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev          # http://localhost:3000

# 3. Tests
pytest -q                                  # full suite (mocked, no API key needed)
ANTHROPIC_API_KEY=... pytest -q -m '' tests/test_graph.py::test_integration_real -s   # live end-to-end
```

The supplier dropdown loads sorted by concentration score (SUP-001 at 94.0 on top). The first assessment of a supplier runs the live pipeline (1–3 minutes) and caches the result; later runs serve the cache instantly. Tick "Force fresh research" or pass `?fresh=true` to re-run live.

## Repository layout

```
profile_core/   deterministic concentration metrics (tested, no LLM)
rag/            contract chunker, local embedder, cosine store + metadata filter
tools/          web_search (server) + contract_search (client) tool wrappers
agent/          the ReAct research loop, findings ledger, fabrication gate
brief/          synthesize (forced structured output) + validate (V1–V7) + render
pipeline/       LangGraph wiring, run_assessment entry point
backend/        FastAPI: /health, /suppliers, /risk-brief/{id} with per-supplier cache
frontend/       Next.js single page — the brief is the product
data/           25-supplier synthetic dataset + 4 supplier contracts
tests/          46 tests, red-before-green
```

## What's out of scope (v2)

Premium data feeds (credit ratings, financial-distress APIs) behind the existing tool interface; scheduled portfolio monitoring instead of on-demand; a validation-retry loop; a human review step before any contract action. The architecture is the durable part; the synthetic data is the swappable part.
