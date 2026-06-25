"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSuppliers,
  runRiskBrief,
  type RiskBriefResponse,
  type SupplierRow,
} from "@/lib/api";

/* ------------------------------------------------------------------ *
 *  Constants + small helpers
 * ------------------------------------------------------------------ */

const NAVY = "#1B2A4A";
const LINK =
  "text-blue-700 underline decoration-blue-300 underline-offset-[3px] transition-colors hover:text-blue-900 hover:decoration-blue-500";

// The four supplier contracts written for this case study (the only ones with a
// contract on file). Names provided by the brief author, not invented here.
const REFERENCE_CONTRACTS: { id: string; name: string }[] = [
  { id: "SUP-001", name: "Rheinkomp" },
  { id: "SUP-002", name: "Zhejiang Scroll" },
  { id: "SUP-003", name: "Milano Controls" },
  { id: "SUP-004", name: "AlpenHX" },
];
const CONTRACT_IDS = new Set(REFERENCE_CONTRACTS.map((c) => c.id));

const STAGES: { name: string; note: string }[] = [
  { name: "Profile", note: "Deterministic — every number computed by tested code" },
  { name: "Research", note: "Agentic — live web search + contract retrieval" },
  { name: "Synthesize", note: "Writes the board-ready brief" },
  { name: "Validate", note: "Rejects unverifiable numbers + fabricated sources" },
];

function isHttp(c: string) {
  return c.trim().toLowerCase().startsWith("http");
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// "SUP-001 Clause 2" -> { sid: "SUP-001", num: 2 }
function parseClause(c: string): { sid: string; num: number } | null {
  const m = c.match(/(SUP-\d+).*?Clause\s+(\d+)/i);
  return m ? { sid: m[1], num: parseInt(m[2], 10) } : null;
}

// Split a claim into a bold lead (first sentence) and the rest.
function splitLead(text: string): { lead: string; rest: string } {
  const t = (text ?? "").trim();
  const idx = t.search(/[.!?]\s/);
  if (idx === -1) return { lead: t, rest: "" };
  return { lead: t.slice(0, idx + 1).trim(), rest: t.slice(idx + 1).trim() };
}

// A one-line description derived from the supplier's category.
function supplierBlurb(category: string): string {
  const map: Record<string, string> = {
    compressors: "Supplies screw compressors for the flagship chiller line",
    copper: "Supplies copper tube and coil stock for heat exchangers",
    controls: "Supplies control systems and electronics for chiller units",
    heat_exchangers: "Supplies heat exchangers for district-cooling systems",
    fans: "Supplies fans and air-movement assemblies",
    steel: "Supplies structural steel and fabricated frames",
    refrigerant: "Supplies refrigerant charge for the cooling circuit",
    pumps: "Supplies circulation pumps for chilled-water loops",
    valves: "Supplies valves and flow-control hardware",
    electronics: "Supplies electronic components and drives",
  };
  return map[category] ?? `Supplies ${category.replace(/_/g, " ")} to the production line`;
}

function severity(score: number): { label: string; color: string; soft: string } {
  if (score >= 75) return { label: "Critical exposure", color: "#b91c1c", soft: "#fef2f2" };
  if (score >= 50) return { label: "Elevated exposure", color: "#b45309", soft: "#fef3e2" };
  return { label: "Moderate exposure", color: "#475569", soft: "#f1f5f9" };
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/* A single source citation: clause -> contract link; URL -> hostname link */
function SourceLink({ c }: { c: string }) {
  const cl = parseClause(c);
  if (cl) {
    return (
      <a href={`/contract/${cl.sid}#clause-${cl.num}`} target="_blank" rel="noopener noreferrer" className={LINK}>
        {cl.sid} · Clause {cl.num}
      </a>
    );
  }
  if (isHttp(c)) {
    return (
      <a href={c} target="_blank" rel="noopener noreferrer" className={LINK}>
        {hostname(c)}
      </a>
    );
  }
  return <span className="text-[var(--color-slate)]">{c}</span>;
}

/* ------------------------------------------------------------------ *
 *  Layout primitives
 * ------------------------------------------------------------------ */

function SectionHead({ n, title, id }: { n: string; title: string; id: string }) {
  return (
    <div id={id} className="mb-6 flex items-baseline gap-4 border-t border-slate-200 pt-7 scroll-mt-20">
      <span className="font-display text-2xl leading-none text-slate-300">{n}</span>
      <h2 className="font-display text-[1.6rem] font-semibold leading-none" style={{ color: NAVY }}>
        {title}
      </h2>
    </div>
  );
}

// Two-column row: anchor on the left, explanation on the right. Stacks on mobile.
function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 py-4 md:grid-cols-[15rem_1fr]">
      <div className="min-w-0">{left}</div>
      <div className="min-w-0">{right}</div>
    </div>
  );
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="mt-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="mt-1 flex justify-between text-[0.7rem] text-slate-400">
        <span>0</span>
        <span>board-level concentration begins ~70</span>
        <span>100</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Page
 * ------------------------------------------------------------------ */

export default function Home() {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [fresh, setFresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskBriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loadingFresh, setLoadingFresh] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    getSuppliers()
      .then((data) => {
        setRows(data);
        if (data.length) setSelected(data[0].supplier_id);
      })
      .catch(() => setLoadError("Could not reach the assessment service."));
  }, []);

  function onRun() {
    if (!selected) return;
    setNotice(null);
    if (fresh) {
      setShowConfirm(true); // gate live runs behind the modal
      return;
    }
    assess(false);
  }

  async function assess(useFresh: boolean) {
    setShowConfirm(false);
    setError(null);
    setNotice(null);
    setResult(null);
    setLoadingFresh(useFresh);
    setLoading(true);
    try {
      const data = await runRiskBrief(selected, useFresh);
      setResult(data);
    } catch {
      if (useFresh) {
        // live run failed (timeout / resource limit) — fall back to the cached brief
        try {
          const cached = await runRiskBrief(selected, false);
          setResult(cached);
          setNotice("Live research did not finish — showing the most recent cached brief.");
        } catch {
          setError("The live assessment could not be completed. Please try again later.");
        }
      } else {
        setError(
          "No cached brief available for this supplier yet. Tick 'Force fresh research' to run a live assessment."
        );
      }
    } finally {
      setLoading(false);
      setLoadingFresh(false);
    }
  }

  const selectedRow = useMemo(
    () => rows.find((r) => r.supplier_id === selected),
    [rows, selected]
  );

  const brief = result?.brief ?? null;
  const sev = result ? severity(result.profile.concentration_score) : null;

  return (
    <main className="mx-auto w-full max-w-[1100px] scroll-smooth px-6 pb-28 sm:px-8">
      {/* Slim masthead */}
      <div className="flex items-center justify-between border-b border-slate-200 py-5">
        <span className="font-display text-sm font-semibold tracking-tight" style={{ color: NAVY }}>
          Supplier Resilience Radar
        </span>
        <span className="font-sans text-[0.7rem] font-medium uppercase tracking-[0.18em] text-slate-400">
          AI Supply Chain Portfolio
        </span>
      </div>

      {/* ── 1. HERO / PROBLEM STATEMENT ── */}
      <section className="mx-auto max-w-[820px] pt-14 sm:pt-20">
        <p className="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-blue-700">
          AI Supply Chain Portfolio · Project 2
        </p>
        <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.04] tracking-[-0.015em] sm:text-6xl" style={{ color: NAVY }}>
          Supplier Resilience Radar
        </h1>
        <p className="mt-6 max-w-[42rem] font-sans text-[1.08rem] leading-relaxed text-slate-700">
          I built an AI agent that assesses how exposed a manufacturer is to a single
          supplier — concentration risk, live disruption signals, and contract terms —
          and writes a board-ready brief where every number is computed by tested code
          and every claim is traced to a source it actually retrieved.
        </p>

        {/* The problem I took */}
        <div className="mt-9 rounded-2xl border border-slate-200 p-6 sm:p-7" style={{ background: "rgba(27,42,74,0.04)" }}>
          <h2 className="font-display text-xl font-semibold" style={{ color: NAVY }}>
            The problem I took
          </h2>
          <p className="mt-3 font-sans text-[0.97rem] leading-relaxed text-slate-700">
            Gulf Cooling Industries (GCI) is a fictional UAE manufacturer of industrial
            chillers and district-cooling systems, created for this case study — it is
            not a real company. GCI runs AED 480M of annual procurement across 25
            strategic suppliers, importing critical compressors and components from
            concentrated overseas sources. A single-source supplier failure stops the
            production line for weeks. The exposure is known in principle but never
            assessed proactively, because checking one supplier means cross-referencing
            procurement data, live external signals, and the supplier contract — days of
            analyst work each. I built this tool to produce that assessment on demand.
          </p>
        </div>

        {/* How I designed it */}
        <div className="mt-7">
          <p className="font-sans text-[0.95rem] leading-relaxed text-slate-700">
            <span className="font-semibold" style={{ color: NAVY }}>How I designed it:</span>{" "}
            a deterministic Profile stage computes every number, an agentic Research
            stage investigates company, country, logistics and contract risk using live
            web search and contract retrieval, a Synthesize stage writes the brief, and
            a Validate stage rejects any unverifiable number or fabricated source.
          </p>
        </div>

        {/* Architecture at a glance */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {STAGES.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="font-display text-[0.95rem] font-semibold" style={{ color: NAVY }}>
                    {s.name}
                  </span>
                  <span className="font-sans text-[0.68rem] leading-tight text-slate-400">{s.note}</span>
                </div>
                {i < STAGES.length - 1 && (
                  <span className="px-1 text-slate-300" aria-hidden>
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 font-sans text-[0.8rem] leading-relaxed text-slate-500">
            The numbers come from tested Python, not the model. Every claim is checked
            against what the agent actually retrieved — a number it cannot reproduce or a
            source it never fetched is rejected before the brief renders.
          </p>
        </div>

        {/* Reference contracts */}
        <p className="mt-6 font-sans text-[0.85rem] leading-relaxed text-slate-500">
          The four supplier contracts I wrote for this case study:{" "}
          {REFERENCE_CONTRACTS.map((c, i) => (
            <span key={c.id}>
              <a href={`/contract/${c.id}`} target="_blank" rel="noopener noreferrer" className={LINK}>
                {c.name} ({c.id})
              </a>
              {i < REFERENCE_CONTRACTS.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
      </section>

      {/* ── Picker + supplier context ── */}
      <div className="mx-auto mt-14 max-w-[820px]">
        {/* Supplier context card */}
        {selectedRow && !result && !loading && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-semibold" style={{ color: NAVY }}>
                  {selectedRow.name}
                </h3>
                <p className="mt-0.5 font-sans text-[0.82rem] text-slate-400">
                  {selectedRow.supplier_id} · {selectedRow.country} · {selectedRow.category.replace(/_/g, " ")}
                </p>
                <p className="mt-2 font-sans text-[0.92rem] text-slate-600">
                  {supplierBlurb(selectedRow.category)}.
                </p>
              </div>
              <div className="flex gap-2">
                <div className="rounded-lg border border-slate-200 px-3 py-2 text-center">
                  <div className="font-display text-lg font-semibold" style={{ color: severity(selectedRow.concentration_score).color }}>
                    {selectedRow.concentration_score.toFixed(1)}
                  </div>
                  <div className="font-sans text-[0.62rem] uppercase tracking-wider text-slate-400">Concentration</div>
                </div>
                <div className="rounded-lg border border-slate-200 px-3 py-2 text-center">
                  <div className="font-display text-lg font-semibold" style={{ color: NAVY }}>
                    {(selectedRow.spend_share * 100).toFixed(1)}%
                  </div>
                  <div className="font-sans text-[0.62rem] uppercase tracking-wider text-slate-400">Spend share</div>
                </div>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3 font-sans text-[0.85rem]">
              {CONTRACT_IDS.has(selectedRow.supplier_id) ? (
                <a href={`/contract/${selectedRow.supplier_id}`} target="_blank" rel="noopener noreferrer" className={LINK}>
                  View their contract →
                </a>
              ) : (
                <span className="text-slate-400">No contract on file for this supplier.</span>
              )}
            </div>
          </div>
        )}

        {/* Case-file picker */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-24px_rgba(15,23,42,0.25)] sm:p-6">
          <label htmlFor="supplier" className="font-sans text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Select a supplier to assess
          </label>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <select
                id="supplier"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={loading || !rows.length}
                className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-10 font-sans text-[0.95rem] text-slate-800 transition-colors duration-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none disabled:opacity-60"
              >
                {!rows.length && <option>Loading suppliers…</option>}
                {rows.map((row) => (
                  <option key={row.supplier_id} value={row.supplier_id}>
                    {`${row.supplier_id}  ${row.name}  (${row.concentration_score.toFixed(1)})`}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>

            <button
              onClick={onRun}
              disabled={loading || !selected}
              className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3 font-sans text-[0.92rem] font-medium text-white transition-all duration-200 hover:brightness-110 focus:outline-none disabled:cursor-not-allowed disabled:opacity-55"
              style={{ background: NAVY }}
            >
              {loading ? "Running…" : "Run Assessment"}
              {!loading && (
                <svg
                  width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              )}
            </button>
          </div>

          <label className="mt-4 inline-flex cursor-pointer select-none items-center gap-2.5 font-sans text-[0.82rem] text-slate-600">
            <input
              type="checkbox"
              checked={fresh}
              onChange={(e) => setFresh(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-700"
            />
            Force fresh research
            <span className="text-slate-400">— bypass cache and re-run live</span>
          </label>
        </div>

        {loadError && (
          <p className="mt-3 text-center font-sans text-[0.82rem] text-red-700">{loadError}</p>
        )}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="mx-auto mt-20 flex max-w-[720px] flex-col items-center text-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute h-6 w-6 rounded-full" style={{ background: "rgba(37,99,235,0.25)", animation: "radar-pulse 2.4s ease-out infinite" }} />
            <span className="absolute h-6 w-6 rounded-full" style={{ background: "rgba(37,99,235,0.25)", animation: "radar-pulse 2.4s ease-out infinite", animationDelay: "1.2s" }} />
            <span className="relative h-2.5 w-2.5 rounded-full bg-blue-700" />
          </div>
          <p className="mt-7 max-w-[30rem] font-sans text-[0.98rem] font-medium leading-relaxed" style={{ color: NAVY }}>
            {loadingFresh
              ? "Running live research — fetching current news, port signals, and contract terms. This usually takes 2–3 minutes."
              : "Loading brief..."}
          </p>
        </div>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <div className="mx-auto mt-12 max-w-[720px] rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="font-sans text-[0.9rem] font-medium text-red-800">Assessment could not be completed</p>
          <p className="mt-1 font-sans text-[0.85rem] text-red-700">{error}</p>
        </div>
      )}

      {/* ── Brief ── */}
      {result && !loading && (
        <article className="rise mx-auto mt-16 max-w-[860px]">
          {notice && (
            <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 font-sans text-sm text-blue-800">
              {notice}
            </div>
          )}

          {/* Brief masthead */}
          <div>
            <p className="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-blue-700">
              Risk Brief · {result.supplier_id}
            </p>
            <h2 className="mt-3 font-display text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.015em]" style={{ color: NAVY }}>
              {result.supplier_name}
            </h2>
            {sev && (
              <div className="mt-4 inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5" style={{ borderColor: `${sev.color}33`, background: sev.soft }}>
                <span className="h-2 w-2 rounded-full" style={{ background: sev.color }} />
                <span className="font-sans text-[0.8rem] font-medium" style={{ color: sev.color }}>
                  {sev.label} · score {result.profile.concentration_score.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Validation failure */}
          {!brief && (
            <div className="mt-12 rounded-xl border border-red-200 bg-red-50 px-5 py-5">
              <p className="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-red-800">Validation failed</p>
              <p className="mt-2 font-sans text-[0.88rem] text-slate-700">
                The brief was withheld because it did not pass source verification. Flagged issues:
              </p>
              <ul className="mt-3 space-y-1.5">
                {result.violations.map((v, i) => (
                  <li key={i} className="font-mono text-[0.8rem] text-red-700">{v}</li>
                ))}
              </ul>
            </div>
          )}

          {brief && (
            <div className="mt-10">
              {/* In-brief section nav */}
              <nav className="sticky top-0 z-10 -mx-2 mb-2 flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-100 bg-white/90 px-2 py-3 backdrop-blur">
                {[
                  ["01", "Concentration", "sec-concentration"],
                  ["02", "Risk Signals", "sec-risk"],
                  ["03", "Contract", "sec-contract"],
                  ["04", "Actions", "sec-actions"],
                  ["05", "Confidence", "sec-confidence"],
                ].map(([n, label, id]) => (
                  <a key={id} href={`#${id}`} className="font-sans text-[0.74rem] text-slate-500 transition-colors hover:text-blue-700">
                    <span className="text-slate-300">{n}</span> {label}
                  </a>
                ))}
              </nav>

              {/* 01 — CONCENTRATION PROFILE */}
              <SectionHead n="01" title="Concentration Profile" id="sec-concentration" />
              {sev && <ScoreBar score={result.profile.concentration_score} color={sev.color} />}
              <div className="mt-6 divide-y divide-slate-100">
                <Row
                  left={<span className="font-sans font-semibold" style={{ color: NAVY }}>Concentration score</span>}
                  right={
                    <p className="font-sans text-[0.95rem] leading-relaxed text-slate-700">
                      <span className="font-semibold" style={{ color: NAVY }}>{result.profile.concentration_score.toFixed(1)} / 100</span>
                      {" — "}composite exposure across spend, single-sourcing, recovery time and category dominance.
                    </p>
                  }
                />
                <Row
                  left={<span className="font-sans font-semibold" style={{ color: NAVY }}>Spend share</span>}
                  right={
                    <p className="font-sans text-[0.95rem] leading-relaxed text-slate-700">
                      <span className="font-semibold" style={{ color: NAVY }}>{result.profile.spend_share_display}</span>
                      {" — "}share of GCI&apos;s total strategic procurement routed through this one supplier.
                    </p>
                  }
                />
                <Row
                  left={<span className="font-sans font-semibold" style={{ color: NAVY }}>Single-source dependency</span>}
                  right={
                    <p className="font-sans text-[0.95rem] leading-relaxed text-slate-700">
                      <span className="font-semibold" style={{ color: NAVY }}>{result.profile.skus_single_sourced} SKUs</span>
                      {" — "}finished models that depend on this supplier with no qualified alternative.
                    </p>
                  }
                />
                <Row
                  left={<span className="font-sans font-semibold" style={{ color: NAVY }}>Line-down gap</span>}
                  right={
                    <p className="font-sans text-[0.95rem] leading-relaxed text-slate-700">
                      <span className="font-semibold" style={{ color: NAVY }}>{result.profile.line_down_gap_weeks} weeks</span>
                      {" — "}how long production stops if this supplier fails today.
                    </p>
                  }
                />
              </div>
              {brief.concentration_profile.length > 0 && (
                <div className="mt-6 space-y-3 border-l-2 border-slate-100 pl-5">
                  {brief.concentration_profile.map((c, i) => (
                    <p key={i} className="font-sans text-[0.97rem] leading-relaxed text-slate-600">{c.text}</p>
                  ))}
                </div>
              )}

              {/* 02 — RISK SIGNALS */}
              <div className="pt-9">
                <SectionHead n="02" title="Risk Signals" id="sec-risk" />
                <div className="divide-y divide-slate-100">
                  {brief.risk_signals.map((c, i) => {
                    const { lead, rest } = splitLead(c.text);
                    return (
                      <Row
                        key={i}
                        left={<p className="font-sans font-semibold leading-snug" style={{ color: NAVY }}>{lead}</p>}
                        right={
                          <div>
                            {rest && <p className="font-sans text-[0.95rem] leading-relaxed text-slate-700">{rest}</p>}
                            <Sources citations={c.citations} className={rest ? "mt-2" : ""} />
                          </div>
                        }
                      />
                    );
                  })}
                </div>
              </div>

              {/* 03 — CONTRACT IMPLICATIONS */}
              <div className="pt-9">
                <SectionHead n="03" title="Contract Implications" id="sec-contract" />
                <div className="divide-y divide-slate-100">
                  {brief.contract_implications.map((c, i) => {
                    const clauses = c.citations.map(parseClause).filter(Boolean) as { sid: string; num: number }[];
                    return (
                      <Row
                        key={i}
                        left={
                          <div className="space-y-1">
                            {clauses.length > 0 ? (
                              clauses.map((cl, j) => (
                                <a
                                  key={j}
                                  href={`/contract/${cl.sid}#clause-${cl.num}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`block font-sans font-semibold ${LINK}`}
                                >
                                  Clause {cl.num}
                                  <span className="block font-sans text-[0.72rem] font-normal text-slate-400">{cl.sid} · open contract →</span>
                                </a>
                              ))
                            ) : (
                              <span className="font-sans font-semibold" style={{ color: NAVY }}>Contract term</span>
                            )}
                          </div>
                        }
                        right={<p className="font-sans text-[0.95rem] leading-relaxed text-slate-700">{c.text}</p>}
                      />
                    );
                  })}
                </div>
              </div>

              {/* 04 — RECOMMENDED ACTIONS */}
              <div className="pt-9">
                <SectionHead n="04" title="Recommended Actions" id="sec-actions" />
                <div className="divide-y divide-slate-100">
                  {brief.recommended_actions.map((c, i) => {
                    const { lead, rest } = splitLead(c.text);
                    return (
                      <Row
                        key={i}
                        left={<p className="font-sans font-semibold leading-snug" style={{ color: NAVY }}>{lead}</p>}
                        right={
                          <div>
                            {rest && <p className="font-sans text-[0.95rem] leading-relaxed text-slate-700">{rest}</p>}
                            <Sources citations={c.citations} className={rest ? "mt-2" : ""} prefix="Follows from" />
                          </div>
                        }
                      />
                    );
                  })}
                </div>
              </div>

              {/* 05 — CONFIDENCE */}
              <div className="pt-9">
                <SectionHead n="05" title="What I could not establish" id="sec-confidence" />
                <div className="divide-y divide-slate-100">
                  {brief.confidence.map((s, i) => (
                    <Row
                      key={i}
                      left={<span className="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-400">Could not establish</span>}
                      right={<p className="font-sans text-[0.95rem] italic leading-relaxed text-slate-500">{s}</p>}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Meta footer */}
          <div className="mt-10 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-slate-100 pt-5 font-sans text-[0.78rem] text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: result.meta.cached ? "#64748b" : "#1d4ed8" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: result.meta.cached ? "#94a3b8" : "#1d4ed8" }} />
              {result.meta.cached ? "Cached" : "Fresh"}
            </span>
            <span aria-hidden>·</span>
            <span>{result.meta.turns} research turns</span>
            <span aria-hidden>·</span>
            <span>generated {formatDate(result.meta.generated_at)}</span>
            {result.meta.forced && (
              <>
                <span aria-hidden>·</span>
                <span className="text-blue-700">forced submission</span>
              </>
            )}
          </div>
        </article>
      )}

      {/* Footer */}
      <footer className="mx-auto mt-24 max-w-[820px] border-t border-slate-200 pt-6">
        <p className="font-sans text-[0.82rem] leading-relaxed text-slate-500">
          Project 2 of a four-project AI supply chain portfolio I&apos;m building. Each
          project takes a real procurement problem and ships an end-to-end tool —
          tested code for the numbers, an agent for the judgement, and a check that
          keeps the output honest.
        </p>
      </footer>

      {/* Confirmation modal — gate every live (fresh) run */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowConfirm(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl" style={{ color: NAVY }}>Run live research?</h3>
            <p className="mt-3 font-sans text-sm leading-relaxed text-slate-600">
              This fetches current news, country and port-risk signals, and analyzes the
              supplier&apos;s contract in real time. It usually takes{" "}
              <span className="font-semibold" style={{ color: NAVY }}>2–3 minutes</span> and
              replaces the cached brief shown by default.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} className="rounded-md px-4 py-2 font-sans text-sm text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button onClick={() => assess(true)} className="rounded-md px-4 py-2 font-sans text-sm font-medium text-white hover:brightness-110" style={{ background: NAVY }}>
                Run live research
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* Inline source links for a claim's citations */
function Sources({ citations, className = "", prefix = "Source" }: { citations: string[]; className?: string; prefix?: string }) {
  if (!citations.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <span className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {prefix}
      </span>
      {citations.map((c, i) => (
        <SourceLink key={i} c={c} />
      ))}
    </div>
  );
}
