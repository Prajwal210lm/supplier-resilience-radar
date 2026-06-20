# Supplier Resilience Radar — 5-minute demo script

**Before you start:** pre-warm the cache. With the backend running and `ANTHROPIC_API_KEY` set, run the SUP-001 assessment once with "Force fresh research" ticked (or `POST /api/risk-brief/SUP-001?fresh=true`). That does the real 1–3 minute run and writes `data/cache/SUP-001.json`. During the demo, the plain button serves it instantly. Keep the checkbox visible so you can prove it runs live if asked.

---

## 0:00–1:00 — The problem

"A GCC chiller manufacturer assembles its products around a handful of imported critical components. The single most important is the compressor. Compressors come from a few global makers, and you can't swap one for another without redesigning and recertifying the unit. So if your compressor supplier fails, the line stops. That's not a missed SKU, it's missed construction milestones and liquidated damages. A board-level event.

Everyone knows supplier concentration is dangerous. The problem is nobody checks it proactively, because checking one supplier properly means pulling together your own procurement data, live external signals like port disruptions and country risk, and what your contract actually says. That's two to three days of analyst time per supplier, and there are a hundred suppliers. So it gets done reactively, after the shipment fails, when the only options left are expensive.

This tool does that assessment in three minutes and produces a board-ready brief where every number is computed by tested code and every external claim is traced to a source it actually retrieved."

## 1:00–1:30 — The picker and the score

"Here's the supplier list, sorted by a concentration score the system computes. Top of the list, SUP-001, Rheinkomp Compressors, scores 94 out of 100.

The score isn't just spend. Notice the copper supplier further down scores 14 despite being one of our larger suppliers by spend, because it has a real alternative. The score is exposure times vulnerability. Rheinkomp is high on both: 18% of spend, single-sourced, long lead time, almost no cover. I'll run the assessment." *(Click Run Assessment — cached brief appears instantly.)*

## 1:30–4:00 — Walk the brief

"Five sections.

**Concentration profile.** Our own exposure. 18% of spend, AED 86.4 million a year. Nine of twelve dependent models single-sourced. And the number that matters most: a 10-week line-down gap. Sixteen-week replacement lead time, six weeks of cover, so if they fail today we stop producing ten weeks before a replacement could land. Every number here comes from tested Python, not the model.

**Risk signals.** This is the agent's live research. It found German manufacturing in contraction with record SME insolvencies, which raises Rheinkomp's distress risk. And it found sustained Hamburg port congestion with Cape-of-Good-Hope rerouting, which extends an already long lead time. Every one of these has a clickable source. The model didn't recall these from training, it searched and read them.

**Contract implications.** The agent also searched our actual contract with this supplier. It found three traps. The force majeure clause excludes exactly the disruptions most likely to happen, energy and freight. An exclusivity clause forbids us from qualifying a backup without their consent. And liability is capped at the purchase-order value with no late-delivery penalty. So we're locked in, exposed, and have no remedy. Each points to a specific clause.

**Recommended actions.** Grounded in all of that: build safety stock to cover the gap, renegotiate the exclusivity and add penalties, qualify alternative sources, run a financial-health check, set up contingency freight routing, and serve renegotiation notice before the auto-renewal window closes.

**Confidence.** This is the part I'm proudest of. The agent tells you what it couldn't find. No public financials exist for this supplier, so it says so and recommends a credit-bureau check, instead of inventing a number. That honesty is what makes it a consulting deliverable and not a chatbot."

## 4:00–5:00 — The architecture story

"One line on how it holds together. The agent reaches into the live web, but it cannot cite anything it didn't actually retrieve. As every tool runs, code records a ledger of every URL and every contract clause that came back. Any claim whose source isn't in that ledger gets dropped, and the final brief is re-checked against the same ledger before it renders. Two gates, same ground truth.

And the numbers and the prose are kept separate by design. The model writes placeholders, never digits; tested code fills them in at the end. So the model that's good at reading the world is never the thing that does the arithmetic. That's the whole discipline: the AI reasons and writes, it never calculates, and it can't cite what it didn't find."

---

## The three hardest interview questions

**1. "The agent uses live web search. How do you know it isn't hallucinating sources?"**

Because it structurally can't. As each tool returns, my code builds a ledger of the exact URLs and clause references that actually came back. There are two enforcement points. At the end of research, any finding whose source isn't in the ledger is dropped before the brief is even written. Then the validator independently re-checks every citation in the finished brief against that same ledger and refuses to render if anything doesn't match. The model never gets to assert a source it didn't retrieve, and I have an adversarial test that plants a fabricated URL and confirms it gets cut. The honesty section exists for the same reason: when the agent finds nothing, the correct output is "I couldn't find this," and the system is built to say that.

**2. "If the LLM writes the brief, how do you trust the numbers?"**

The LLM never writes a number. Every figure is computed by deterministic Python that's unit-tested against hand-verified fixtures. The model writes placeholders like `{{spend_share}}`, and a renderer substitutes the real value at the very end, only after a validator confirms the placeholder resolves to a real computed field. The validator rejects any bare digit in the prose, even a correct one, because the rule is that prose never carries raw numbers. So the concentration score of 94 and the 10-week gap aren't the model's opinion, they're tested code, and I can show you the test that pins them.

**3. "This is a synthetic demo. What would it take to make it real?"**

The architecture is the real part; the data is the swappable part. The contract retrieval, the agent loop, the ledger, the validator all work identically on real contracts and real suppliers, you point the loader at the ERP and drop real contract PDFs into the corpus. Three things would harden it for production. First, premium data feeds, credit ratings and financial-distress signals behind a paid API, which I deliberately left as a clean plug-in point rather than faking. Second, scheduled monitoring instead of on-demand, so it watches the portfolio continuously. Third, a human review step before any recommendation reaches a contract action. None of those change the core. The discipline that makes it trustworthy, computed numbers and retrieved sources, is exactly what makes it safe to put real data through.
