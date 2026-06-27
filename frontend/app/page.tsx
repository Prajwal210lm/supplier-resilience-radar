"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  getClauseSummary,
  getSuppliers,
  runRiskBrief,
  type RiskBriefResponse,
  type SupplierRow,
} from "@/lib/api";
import {
  CONTRACT_IDS,
  CONTRACT_LIBRARY,
  formatDate,
  hostname,
  isHttp,
  parseClause,
  severity,
  splitLead,
} from "@/lib/format";
import { CountUp, Reveal } from "@/components/motion";
import Gauge from "@/components/Gauge";
import Architecture from "@/components/Architecture";
import LiveLoader from "@/components/LiveLoader";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Alert,
  ArrowRight,
  ArrowUpRight,
  Chevron,
  Doc,
  Radar,
  Shield,
} from "@/components/icons";

/* ------------------------------------------------------------------ *
 *  Small shared pieces
 * ------------------------------------------------------------------ */

function SourceChip({ c }: { c: string }) {
  const cl = parseClause(c);
  if (cl) {
    return (
      <a
        href={`/contract/${cl.sid}#clause-${cl.num}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[0.7rem] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent-bright)]"
      >
        <Doc size={11} className="text-[var(--color-ink-3)]" />
        {cl.sid} · Clause {cl.num}
      </a>
    );
  }
  if (isHttp(c)) {
    return (
      <a
        href={c}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[0.7rem] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent-bright)]"
      >
        {hostname(c)}
        <ArrowUpRight size={11} className="text-[var(--color-ink-3)]" />
      </a>
    );
  }
  return <span className="font-mono text-[0.7rem] text-[var(--color-ink-3)]">{c}</span>;
}

function SectionShell({
  n,
  title,
  id,
  children,
}: {
  n: string;
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32 border-t border-[var(--color-line)] pt-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="font-mono text-[0.75rem] text-[var(--color-accent)]">{n}</span>
        <h3 className="font-display text-[1.4rem] font-semibold text-[var(--color-ink)]">{title}</h3>
      </div>
      {children}
    </section>
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

  return (
    <div className="scroll-smooth">
      {/* ── Top nav ── */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-base)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center justify-between px-6 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5">
            <Radar size={18} className="text-[var(--color-accent)]" />
            <span className="font-display text-[0.95rem] font-semibold tracking-tight">Supplier Resilience Radar</span>
          </a>
          <div className="flex items-center gap-5">
            <span className="hidden font-mono text-[0.66rem] uppercase tracking-[0.18em] text-[var(--color-ink-3)] sm:inline">
              Portfolio · Project 02
            </span>
            <a
              href="#console"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-btn)] px-3.5 py-1.5 font-sans text-[0.82rem] font-medium text-white transition-all hover:bg-[var(--color-btn-hover)]"
            >
              Run an assessment
              <ArrowRight size={13} />
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto w-full max-w-[1180px] px-6 pb-32 sm:px-8">
        {/* ── 1. HERO ── */}
        <section className="relative pt-16 sm:pt-24">
          <div className="pointer-events-none absolute inset-x-0 -top-10 h-[460px] grid-backdrop" aria-hidden />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.35fr_1fr]">
            <div>
              <Reveal>
                <p className="kicker text-[var(--color-accent)]">AI Supply-Chain Portfolio · Project 02</p>
              </Reveal>
              <Reveal delay={0.06}>
                <h1 className="mt-5 font-display text-[2.9rem] font-semibold leading-[1.02] tracking-[-0.02em] sm:text-[4.1rem]">
                  Supplier <span className="text-[var(--color-accent)]">Resilience</span> Radar
                </h1>
              </Reveal>
              <Reveal delay={0.12}>
                <p className="mt-6 max-w-[40rem] text-[1.1rem] leading-relaxed text-[var(--color-ink-2)]">
                  I built an AI agent that assesses how exposed a manufacturer is to a single
                  supplier in its supply chain — concentration risk, live disruption signals, and
                  contract terms — and writes a board-ready brief where{" "}
                  <span className="text-[var(--color-ink)]">every number is computed by tested code</span> and{" "}
                  <span className="text-[var(--color-ink)]">every claim is traced to a source it actually retrieved</span>.
                </p>
              </Reveal>
              <Reveal delay={0.18}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <a
                    href="#console"
                    className="group inline-flex items-center gap-2 rounded-xl bg-[var(--color-btn)] px-5 py-3 font-sans text-[0.92rem] font-medium text-white transition-all hover:bg-[var(--color-btn-hover)]"
                  >
                    Assess a supplier
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </a>
                  <a
                    href="#how"
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-line-strong)] px-5 py-3 font-sans text-[0.92rem] font-medium text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-ink)]"
                  >
                    How I built it
                  </a>
                </div>
              </Reveal>
            </div>

            {/* visual hook — a decorative instrument, no fabricated data */}
            <Reveal delay={0.1} className="relative hidden justify-self-center lg:block">
              <HeroInstrument />
            </Reveal>
          </div>
        </section>

        {/* ── 2. THE PROBLEM ── */}
        <Reveal as="section" className="mt-24">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/70 p-7 sm:p-9">
            <div className="flex items-center gap-2">
              <Alert size={15} className="text-[var(--color-amber)]" />
              <span className="kicker text-[var(--color-ink-3)]">The problem I took</span>
            </div>
            <p className="mt-4 max-w-[58rem] text-[1.02rem] leading-relaxed text-[var(--color-ink-2)]">
              Gulf Cooling Industries (GCI) is a fictional UAE manufacturer of industrial chillers
              and district-cooling systems, created for this case study — it is not a real company.
              GCI runs <span className="text-[var(--color-ink)]">AED 480M of annual spend across 25 strategic
              suppliers</span> in its supply chain, importing critical compressors and components from
              concentrated overseas sources. A single-source supplier failure stops the production line
              for weeks. The exposure is known in principle but never assessed proactively, because
              checking one supplier means cross-referencing supply-chain data, live external signals,
              and the supplier contract — days of analyst work each.{" "}
              <span className="text-[var(--color-ink)]">I built this tool to produce that assessment on demand.</span>
            </p>
          </div>
        </Reveal>

        {/* ── 3. ARCHITECTURE ── */}
        <section id="how" className="mt-24 scroll-mt-20">
          <Reveal>
            <p className="kicker text-[var(--color-accent)]">How I designed it</p>
            <h2 className="mt-4 max-w-[36rem] font-display text-[2rem] font-semibold leading-tight tracking-[-0.01em] sm:text-[2.4rem]">
              Four stages. The judgement is the agent&apos;s; the numbers are not.
            </h2>
          </Reveal>
          <div className="mt-9">
            <Architecture />
          </div>
        </section>

        {/* ── 4. CONTRACTS ── */}
        <section id="contracts" className="mt-24 scroll-mt-20">
          <Reveal>
            <p className="kicker text-[var(--color-accent)]">Contract library</p>
            <h2 className="mt-4 font-display text-[2rem] font-semibold leading-tight tracking-[-0.01em] sm:text-[2.4rem]">
              The contracts I wrote
            </h2>
            <p className="mt-4 max-w-[58rem] text-[1rem] leading-relaxed text-[var(--color-ink-2)]">
              I wrote four representative supplier contracts spanning the risk spectrum — from a
              single-source trap to a buyer-protective deal — to demonstrate the contract-retrieval
              and analysis layer. The remaining suppliers in the dataset have no contract on file,
              which the tool surfaces honestly rather than inventing terms.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {CONTRACT_LIBRARY.map((c, i) => (
              <Reveal key={c.id} delay={i * 0.05}>
                <a
                  href={`/contract/${c.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block h-full overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/70 p-5 transition-colors hover:border-[var(--color-accent)]/45 sm:p-6"
                >
                  <span className="absolute left-0 top-0 h-full w-[3px] bg-transparent transition-colors group-hover:bg-[var(--color-accent)]/70" />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[0.72rem] text-[var(--color-accent)]">{c.id}</span>
                    <Doc size={15} className="text-[var(--color-ink-3)] transition-colors group-hover:text-[var(--color-accent-bright)]" />
                  </div>
                  <h3 className="mt-2.5 font-display text-[1.3rem] font-semibold leading-tight text-[var(--color-ink)]">{c.name}</h3>
                  <p className="mt-1 font-mono text-[0.72rem] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
                    {c.country} · {c.category.replace(/_/g, " ")}
                  </p>
                  <p className="mt-3 text-[0.88rem] leading-relaxed text-[var(--color-ink-2)]">{c.note}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-[var(--color-accent-bright)]">
                    Read the contract
                    <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </a>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <div className="mt-6">
              <Link
                href="/contracts"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-line-strong)] px-5 py-2.5 font-sans text-[0.88rem] font-medium text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-ink)]"
              >
                View all contracts
                <ArrowRight size={14} />
              </Link>
            </div>
          </Reveal>
        </section>

        {/* ── 5. CONSOLE ── */}
        <section id="console" className="mt-24 scroll-mt-20">
          <Reveal>
            <p className="kicker text-[var(--color-accent)]">Live console</p>
            <h2 className="mt-4 font-display text-[2rem] font-semibold leading-tight tracking-[-0.01em] sm:text-[2.4rem]">
              Select a supplier. Get the brief.
            </h2>
          </Reveal>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_360px]">
            {/* picker */}
            <Reveal className="order-2 lg:order-1">
              <div className="panel rounded-2xl p-5 sm:p-6">
                <label htmlFor="supplier" className="kicker text-[var(--color-ink-3)]">
                  Select a supplier to assess
                </label>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <select
                      id="supplier"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                      disabled={loading || !rows.length}
                      className="w-full cursor-pointer appearance-none rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface)] py-3 pl-4 pr-10 font-sans text-[0.95rem] text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)]/40 focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-60"
                    >
                      {!rows.length && <option>Loading suppliers…</option>}
                      {rows.map((row) => (
                        <option key={row.supplier_id} value={row.supplier_id} className="bg-[var(--color-surface)]">
                          {`${row.supplier_id}  ${row.name}  (${row.concentration_score.toFixed(1)})`}
                        </option>
                      ))}
                    </select>
                    <Chevron size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]" />
                  </div>

                  <button
                    onClick={onRun}
                    disabled={loading || !selected}
                    className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-btn)] px-6 py-3 font-sans text-[0.92rem] font-medium text-white transition-all hover:bg-[var(--color-btn-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Running…" : "Run Assessment"}
                    {!loading && <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />}
                  </button>
                </div>

                <label className="mt-4 inline-flex cursor-pointer select-none items-center gap-2.5 text-[0.82rem] text-[var(--color-ink-2)]">
                  <input
                    type="checkbox"
                    checked={fresh}
                    onChange={(e) => setFresh(e.target.checked)}
                    disabled={loading}
                    className="h-4 w-4 cursor-pointer rounded border-[var(--color-line-strong)] bg-[var(--color-surface)] accent-[var(--color-accent)]"
                  />
                  Force fresh research
                  <span className="text-[var(--color-ink-3)]">— bypass cache and re-run live (2–3 min)</span>
                </label>

                {loadError && <p className="mt-4 font-mono text-[0.8rem] text-[var(--color-crit)]">{loadError}</p>}
              </div>
            </Reveal>

            {/* case-file panel */}
            <div className="order-1 lg:order-2">
              <AnimatePresence mode="wait">
                {selectedRow && (
                  <CaseFile key={selectedRow.supplier_id} row={selectedRow} />
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* loading */}
          {loading && (
            <div className="mt-12 panel rounded-2xl">
              <LiveLoader fresh={loadingFresh} />
            </div>
          )}

          {/* error */}
          {error && !loading && (
            <div className="mt-10 flex items-start gap-3 rounded-2xl border border-[var(--color-crit)]/30 bg-[var(--color-crit)]/[0.07] p-5">
              <Alert size={18} className="mt-0.5 shrink-0 text-[var(--color-crit)]" />
              <div>
                <p className="font-display text-[0.95rem] font-medium text-[var(--color-ink)]">
                  Assessment could not be completed
                </p>
                <p className="mt-1 text-[0.85rem] text-[var(--color-ink-2)]">{error}</p>
              </div>
            </div>
          )}
        </section>

        {/* ── 6. BRIEF ── */}
        {result && !loading && (
          <Brief result={result} brief={brief} notice={notice} />
        )}

        {/* ── Footer ── */}
        <footer className="mt-28 border-t border-[var(--color-line)] pt-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[44rem] text-[0.82rem] leading-relaxed text-[var(--color-ink-3)]">
              Project 02 of a four-project AI supply-chain portfolio I&apos;m building. Each one takes a
              real supply-chain problem and ships an end-to-end tool — tested code for the numbers, an
              agent for the judgement, and a check that keeps the output honest.
            </p>
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
              Built by Prajwal
            </span>
          </div>
        </footer>
      </main>

      {/* ── Confirmation modal ── */}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => assess(true)}
        title="Run live research?"
        confirmLabel="Run live research"
      >
        This fetches current news, country and port-risk signals, and analyzes the
        supplier&apos;s contract in real time. It usually takes{" "}
        <span className="font-semibold text-[var(--color-ink)]">2–3 minutes</span> and replaces the cached
        brief shown by default.
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Hero decorative instrument (pure ornament, no data)
 * ------------------------------------------------------------------ */
function HeroInstrument() {
  const reduce = useReducedMotion();
  return (
    <div className="relative grid h-[340px] w-[340px] place-items-center" aria-hidden>
      <div className="absolute inset-0 rounded-full border border-[var(--color-line)]" />
      <div className="absolute inset-8 rounded-full border border-[var(--color-line)]" />
      <div className="absolute inset-16 rounded-full border border-[var(--color-line)]" />
      <div className="absolute inset-24 rounded-full border border-[var(--color-line-strong)]" />
      {/* sweep */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, rgba(79,140,255,0) 0deg, rgba(79,140,255,0.22) 50deg, rgba(79,140,255,0) 60deg)",
          maskImage: "radial-gradient(circle, #000 0%, #000 50%, transparent 50%)",
          WebkitMaskImage: "radial-gradient(circle, #000 0%, #000 50%, transparent 50%)",
        }}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 8, ease: "linear", repeat: Infinity }}
      />
      <Radar size={40} className="relative text-[var(--color-accent)]" />
      {/* purely ornamental sweep dots — single accent hue, no severity coding */}
      <span className="absolute left-[22%] top-[30%] h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" style={{ boxShadow: "0 0 8px var(--color-accent)" }} />
      <span className="absolute right-[26%] top-[44%] h-1.5 w-1.5 rounded-full bg-[var(--color-accent-bright)]" style={{ boxShadow: "0 0 8px var(--color-accent-bright)" }} />
      <span className="absolute bottom-[28%] left-[40%] h-1 w-1 rounded-full bg-[var(--color-ink-3)]" />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Case-file panel (slides in on select)
 * ------------------------------------------------------------------ */
function CaseFile({ row }: { row: SupplierRow }) {
  const sev = severity(row.concentration_score);
  const hasContract = CONTRACT_IDS.has(row.supplier_id);
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="panel-raised h-full rounded-2xl p-5"
    >
      <div className="flex items-center justify-between">
        <span className="kicker text-[var(--color-ink-3)]">Case file</span>
        <span className="font-mono text-[0.7rem] text-[var(--color-ink-3)]">{row.supplier_id}</span>
      </div>
      <h3 className="mt-3 font-display text-[1.35rem] font-semibold leading-tight text-[var(--color-ink)]">{row.name}</h3>
      <p className="mt-1 font-mono text-[0.74rem] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
        {row.country} · {row.category.replace(/_/g, " ")}
      </p>
      <p className="mt-3 text-[0.88rem] leading-relaxed text-[var(--color-ink-2)]">{row.description}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
          <div className="font-display text-xl font-semibold tabular-nums" style={{ color: sev.color }}>
            {row.concentration_score.toFixed(1)}
          </div>
          <div className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">Concentration</div>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
          <div className="font-display text-xl font-semibold tabular-nums text-[var(--color-ink)]">
            {(row.spend_share * 100).toFixed(1)}%
          </div>
          <div className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">Spend share</div>
        </div>
      </div>

      {/* plain-English captions so a non-expert understands the two figures */}
      <dl className="mt-3 space-y-1.5">
        <div className="text-[0.72rem] leading-snug text-[var(--color-ink-3)]">
          <dt className="inline font-medium text-[var(--color-ink-2)]">Concentration —</dt>{" "}
          <dd className="inline">0–100 risk score: how exposed GCI is to this one supplier (higher = more dangerous).</dd>
        </div>
        <div className="text-[0.72rem] leading-snug text-[var(--color-ink-3)]">
          <dt className="inline font-medium text-[var(--color-ink-2)]">Spend share —</dt>{" "}
          <dd className="inline">Share of GCI&apos;s total annual procurement spend that goes to this supplier.</dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-[var(--color-line)] pt-3">
        {hasContract ? (
          <a
            href={`/contract/${row.supplier_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[0.84rem] font-medium text-[var(--color-accent-bright)] transition-colors hover:text-[var(--color-accent)]"
          >
            <Doc size={14} />
            View their contract
            <ArrowUpRight size={13} />
          </a>
        ) : (
          <span className="text-[0.82rem] text-[var(--color-ink-3)]">No contract on file for this supplier.</span>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 *  The brief — premium intelligence report
 * ------------------------------------------------------------------ */
function Brief({
  result,
  brief,
  notice,
}: {
  result: RiskBriefResponse;
  brief: RiskBriefResponse["brief"];
  notice: string | null;
}) {
  const sev = severity(result.profile.concentration_score);
  const p = result.profile;

  // One-line clause summaries for this supplier (real data from the API; null for
  // suppliers with no contract on file). Tracked per supplier id so it never
  // shows a stale supplier's summaries.
  const [loadedClauses, setLoadedClauses] = useState<{
    id: string;
    map: Record<string, string> | null;
  }>({ id: "", map: null });
  useEffect(() => {
    let cancelled = false;
    getClauseSummary(result.supplier_id)
      .then((m) => {
        if (!cancelled) setLoadedClauses({ id: result.supplier_id, map: m });
      })
      .catch(() => {
        if (!cancelled) setLoadedClauses({ id: result.supplier_id, map: null });
      });
    return () => {
      cancelled = true;
    };
  }, [result.supplier_id]);
  const clauseMap = loadedClauses.id === result.supplier_id ? loadedClauses.map : null;

  const NAV = [
    ["01", "Concentration", "b-concentration"],
    ["02", "Risk Signals", "b-risk"],
    ["03", "Contract", "b-contract"],
    ["04", "Actions", "b-actions"],
    ["05", "Confidence", "b-confidence"],
  ] as const;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mt-16"
    >
      {/* masthead */}
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/70 p-7 sm:p-9">
        {notice && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-ink-2)]">
            <Shield size={15} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
            {notice}
          </div>
        )}
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_300px]">
          <div>
            <p className="kicker text-[var(--color-accent)]">Risk brief · {result.supplier_id}</p>
            <h2 className="mt-3 font-display text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.015em] text-[var(--color-ink)] sm:text-[3rem]">
              {result.supplier_name}
            </h2>
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5"
              style={{ borderColor: sev.ring, background: sev.soft }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: sev.color }} />
              <span className="font-mono text-[0.72rem] font-medium uppercase tracking-[0.12em]" style={{ color: sev.color }}>
                {sev.label}
              </span>
            </div>

            {/* count-up stat strip */}
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Score" value={<CountUp value={p.concentration_score} decimals={1} />} color={sev.color} />
              <Stat label="Spend share" value={<CountUp value={p.spend_share * 100} decimals={1} suffix="%" />} />
              <Stat label="Single-source SKUs" value={<CountUp value={p.skus_single_sourced} />} />
              <Stat label="Line-down gap" value={<CountUp value={p.line_down_gap_weeks} suffix=" wk" />} />
            </div>
          </div>

          {/* the gauge */}
          <div className="grid place-items-center">
            <Gauge score={p.concentration_score} />
          </div>
        </div>
      </div>

      {/* validation failure */}
      {!brief && (
        <div className="mt-8 rounded-2xl border border-[var(--color-crit)]/30 bg-[var(--color-crit)]/[0.06] p-6">
          <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-crit)]">
            Validation failed
          </p>
          <p className="mt-2 text-[0.9rem] text-[var(--color-ink-2)]">
            The brief was withheld because it did not pass source verification. Flagged issues:
          </p>
          <ul className="mt-3 space-y-1.5">
            {result.violations.map((v, i) => (
              <li key={i} className="font-mono text-[0.8rem] text-[var(--color-crit)]">{v}</li>
            ))}
          </ul>
        </div>
      )}

      {brief && (
        <div className="mt-8">
          {/* sticky section nav */}
          <nav className="sticky top-14 z-30 -mx-2 mb-2 flex flex-wrap gap-x-5 gap-y-1 border-b border-[var(--color-line)] bg-[var(--color-base)]/85 px-2 py-3 backdrop-blur-md">
            {NAV.map(([n, label, id]) => (
              <a key={id} href={`#${id}`} className="font-mono text-[0.72rem] text-[var(--color-ink-3)] underline decoration-transparent decoration-from-font underline-offset-4 transition-colors hover:text-[var(--color-accent-bright)] hover:decoration-[var(--color-accent)]">
                <span className="text-[var(--color-line-strong)]">{n}</span> {label}
              </a>
            ))}
          </nav>

          {/* 01 concentration */}
          <SectionShell n="01" title="Concentration Profile" id="b-concentration">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricRow label="Concentration score" value={`${p.concentration_score.toFixed(1)} / 100`} note="Composite exposure across spend, single-sourcing, recovery time and category dominance." />
              <MetricRow label="Spend share" value={p.spend_share_display} note="Share of GCI's total strategic supply-chain spend routed through this one supplier." />
              <MetricRow label="Single-source dependency" value={`${p.skus_single_sourced} SKUs`} note="Finished models depending on this supplier with no qualified alternative." />
              <MetricRow label="Line-down gap" value={`${p.line_down_gap_weeks} weeks`} note="How long production stops if this supplier fails today." />
            </div>
            {brief.concentration_profile.length > 0 && (
              <div className="mt-5 space-y-3 border-l-2 border-[var(--color-line-strong)] pl-5">
                {brief.concentration_profile.map((c, i) => (
                  <p key={i} className="text-[0.97rem] leading-relaxed text-[var(--color-ink-2)]">{c.text}</p>
                ))}
              </div>
            )}
          </SectionShell>

          {/* 02 risk signals */}
          <div className="pt-12">
            <SectionShell n="02" title="Risk Signals" id="b-risk">
              <div className="grid gap-3">
                {brief.risk_signals.length === 0 && (
                  <EmptyNote text="No external risk signals were surfaced for this supplier." />
                )}
                {brief.risk_signals.map((c, i) => {
                  const { lead, rest } = splitLead(c.text);
                  return (
                    <Reveal key={i} delay={i * 0.04}>
                      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-5 transition-colors hover:border-[var(--color-line-strong)]">
                        <p className="font-display text-[1.02rem] font-semibold leading-snug text-[var(--color-ink)]">{lead}</p>
                        {rest && <p className="mt-2 text-[0.92rem] leading-relaxed text-[var(--color-ink-2)]">{rest}</p>}
                        {c.citations.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {c.citations.map((cc, j) => <SourceChip key={j} c={cc} />)}
                          </div>
                        )}
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </SectionShell>
          </div>

          {/* 03 contract implications */}
          <div className="pt-12">
            <SectionShell n="03" title="Contract Implications" id="b-contract">
              <div className="grid gap-3">
                {brief.contract_implications.length === 0 && (
                  <EmptyNote text="No contract implications were identified." />
                )}
                {brief.contract_implications.map((c, i) => {
                  const clauses = c.citations.map(parseClause).filter(Boolean) as { sid: string; num: number }[];
                  const others = c.citations.filter((cc) => !parseClause(cc));
                  return (
                    <Reveal key={i} delay={i * 0.04}>
                      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-5">
                        <div className="space-y-2.5">
                          {clauses.length === 0 && others.length === 0 && (
                            <span className="font-mono text-[0.74rem] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">Contract term</span>
                          )}
                          {clauses.map((cl, j) => {
                            const summary =
                              cl.sid === result.supplier_id ? clauseMap?.[String(cl.num)] : undefined;
                            return (
                              <div key={`c${j}`}>
                                <a
                                  href={`/contract/${cl.sid}#clause-${cl.num}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-3 py-1.5 font-mono text-[0.76rem] font-medium text-[var(--color-accent-bright)] transition-colors hover:bg-[var(--color-accent)]/20"
                                >
                                  <Doc size={13} />
                                  {cl.sid} · Clause {cl.num}
                                  <ArrowUpRight size={12} />
                                </a>
                                {/* one-line gist of the clause (real summary from the API) */}
                                {summary && (
                                  <p className="mt-1.5 text-[0.85rem] leading-relaxed text-[var(--color-ink-3)]">
                                    <span className="font-semibold text-[var(--color-ink-2)]">Clause {cl.num}:</span> {summary}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                          {/* any non-clause (URL) sources are still shown — provenance is never dropped */}
                          {others.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {others.map((cc, j) => <SourceChip key={`u${j}`} c={cc} />)}
                            </div>
                          )}
                        </div>
                        <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--color-ink-2)]">{c.text}</p>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </SectionShell>
          </div>

          {/* 04 recommended actions */}
          <div className="pt-12">
            <SectionShell n="04" title="Recommended Actions" id="b-actions">
              <div className="grid gap-3">
                {brief.recommended_actions.length === 0 && (
                  <EmptyNote text="No recommended actions were generated." />
                )}
                {brief.recommended_actions.map((c, i) => {
                  const { lead, rest } = splitLead(c.text);
                  return (
                    <Reveal key={i} delay={i * 0.04}>
                      <div className="flex gap-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-5">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] font-display text-[0.9rem] font-semibold text-[var(--color-accent-bright)]">
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-display text-[1.02rem] font-semibold leading-snug text-[var(--color-ink)]">{lead}</p>
                          {rest && <p className="mt-1.5 text-[0.92rem] leading-relaxed text-[var(--color-ink-2)]">{rest}</p>}
                          {c.citations.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-[var(--color-ink-3)]">Follows from</span>
                              {c.citations.map((cc, j) => <SourceChip key={j} c={cc} />)}
                            </div>
                          )}
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </SectionShell>
          </div>

          {/* 05 confidence */}
          <div className="pt-12">
            <SectionShell n="05" title="What I could not establish" id="b-confidence">
              {brief.confidence.length === 0 ? (
                <EmptyNote text="The agent did not flag any gaps in what it could establish." />
              ) : (
                <div className="grid gap-3">
                  {brief.confidence.map((s, i) => (
                    <div key={i} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-4">
                      <span className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
                        Could not establish
                      </span>
                      <p className="mt-1.5 text-[0.92rem] leading-relaxed text-[var(--color-ink-2)]">{cleanGap(s)}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionShell>
          </div>
        </div>
      )}

      {/* meta footer */}
      <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--color-line)] pt-5 font-mono text-[0.72rem] text-[var(--color-ink-3)]">
        <span className="inline-flex items-center gap-1.5" style={{ color: result.meta.cached ? "var(--color-ink-3)" : "var(--color-accent-bright)" }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: result.meta.cached ? "var(--color-ink-3)" : "var(--color-accent)" }} />
          {result.meta.cached ? "CACHED" : "FRESH"}
        </span>
        <span className="text-[var(--color-line-strong)]">·</span>
        <span>{result.meta.turns} research turns</span>
        <span className="text-[var(--color-line-strong)]">·</span>
        <span>generated {formatDate(result.meta.generated_at)}</span>
        {result.meta.forced && (
          <>
            <span className="text-[var(--color-line-strong)]">·</span>
            <span className="text-[var(--color-amber)]">forced submission</span>
          </>
        )}
      </div>
    </motion.section>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3.5">
      <div className="font-display text-2xl font-semibold tabular-nums" style={{ color: color ?? "var(--color-ink)" }}>
        {value}
      </div>
      <div className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">{label}</div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-[0.9rem] text-[var(--color-ink-2)]">{text}</p>;
}

// Strip any leading markdown bullet markers so confidence gaps render as clean
// prose rather than raw "* " / "- " text.
function cleanGap(s: string): string {
  return (s ?? "").replace(/^[\s*+•·-]+/, "").trim();
}

function MetricRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]/50 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-sans text-[0.86rem] font-medium text-[var(--color-ink-2)]">{label}</span>
        <span className="font-display text-[1.05rem] font-semibold tabular-nums text-[var(--color-ink)]">{value}</span>
      </div>
      <p className="mt-1.5 text-[0.8rem] leading-relaxed text-[var(--color-ink-2)]">{note}</p>
    </div>
  );
}
