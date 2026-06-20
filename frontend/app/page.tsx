"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSuppliers,
  runRiskBrief,
  type Claim,
  type RiskBriefResponse,
  type SupplierRow,
} from "@/lib/api";

/* ------------------------------------------------------------------ *
 *  Small presentational helpers
 * ------------------------------------------------------------------ */

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

function severity(score: number): {
  label: string;
  color: string;
  soft: string;
} {
  if (score >= 75)
    return { label: "Critical exposure", color: "#b91c1c", soft: "#fef2f2" };
  if (score >= 50)
    return { label: "Elevated exposure", color: "#b45309", soft: "#fef3e2" };
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

/* A single citation: URL → quiet link (hostname); clause → mono badge */
function Citation({ c }: { c: string }) {
  if (isHttp(c)) {
    return (
      <a
        href={c}
        target="_blank"
        rel="noopener noreferrer"
        className="cite-link inline-flex items-center gap-1 cursor-pointer"
      >
        {hostname(c)}
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="opacity-70"
        >
          <path d="M7 17 17 7" />
          <path d="M7 7h10v10" />
        </svg>
      </a>
    );
  }
  return <span className="cite-badge">{c}</span>;
}

function CitationRow({ citations }: { citations: string[] }) {
  if (!citations.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="eyebrow text-[0.6rem] text-[var(--color-faint)]">
        Sources
      </span>
      {citations.map((c, i) => (
        <Citation key={i} c={c} />
      ))}
    </div>
  );
}

/* A numbered editorial section wrapper */
function Section({
  index,
  label,
  children,
}: {
  index: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative pt-9">
      <div className="mb-5 flex items-baseline gap-4 border-t border-[var(--color-line)] pt-6">
        <span className="font-display text-2xl leading-none text-[var(--color-faint)]">
          {index}
        </span>
        <h2 className="eyebrow text-[var(--color-navy)]">{label}</h2>
      </div>
      <div className="prose-reader">{children}</div>
    </section>
  );
}

function ClaimBlock({ claim, hideSources }: { claim: Claim; hideSources?: boolean }) {
  return (
    <div className="mb-6 last:mb-0">
      <p>{claim.text}</p>
      {!hideSources && <CitationRow citations={claim.citations} />}
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

  useEffect(() => {
    getSuppliers()
      .then((data) => {
        setRows(data);
        if (data.length) setSelected(data[0].supplier_id);
      })
      .catch(() => setLoadError("Could not reach the assessment service."));
  }, []);

  async function handleRun() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await runRiskBrief(selected, fresh);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "assessment failed");
    } finally {
      setLoading(false);
    }
  }

  const selectedRow = useMemo(
    () => rows.find((r) => r.supplier_id === selected),
    [rows, selected]
  );

  const brief = result?.brief ?? null;
  const sev = result ? severity(result.profile.concentration_score) : null;

  return (
    <main className="mx-auto w-full max-w-[1080px] px-6 pb-28 sm:px-8">
      {/* Masthead */}
      <div className="flex items-center justify-between border-b border-[var(--color-line)] py-5">
        <div className="flex items-center gap-2.5">
          <RadarMark />
          <span className="eyebrow text-[0.62rem] text-[var(--color-slate)]">
            Resilience Intelligence
          </span>
        </div>
        <span className="eyebrow text-[0.6rem] text-[var(--color-faint)]">
          Confidential Briefing
        </span>
      </div>

      {/* Header */}
      <header className="mx-auto max-w-[720px] pt-16 text-center sm:pt-20">
        <p className="eyebrow text-[var(--color-accent)]">Supply Chain Risk</p>
        <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-[-0.01em] text-[var(--color-ink)] sm:text-6xl">
          Supplier Resilience Radar
        </h1>
        <p className="mx-auto mt-5 max-w-[34rem] text-[1.05rem] leading-relaxed text-[var(--color-muted)]">
          Concentration exposure, live disruption signals, and contract
          implications for one supplier — sourced and traceable.
        </p>
      </header>

      {/* Picker — selecting a case file */}
      <div className="mx-auto mt-12 max-w-[720px]">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-24px_rgba(15,23,42,0.25)] sm:p-6">
          <label
            htmlFor="supplier"
            className="eyebrow block text-[0.6rem] text-[var(--color-faint)]"
          >
            Select case file
          </label>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <select
                id="supplier"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={loading || !rows.length}
                className="w-full cursor-pointer appearance-none rounded-xl border border-[var(--color-line)] bg-white py-3 pl-4 pr-10 font-sans text-[0.95rem] text-[var(--color-navy)] transition-colors duration-200 hover:border-[var(--color-faint)] focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-60"
              >
                {!rows.length && <option>Loading suppliers…</option>}
                {rows.map((row) => (
                  <option key={row.supplier_id} value={row.supplier_id}>
                    {`${row.supplier_id}  ${row.name}  (${row.concentration_score.toFixed(
                      1
                    )})`}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>

            <button
              onClick={handleRun}
              disabled={loading || !selected}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-navy)] px-6 py-3 font-sans text-[0.92rem] font-medium text-white transition-all duration-200 hover:bg-[var(--color-ink)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer"
            >
              {loading ? "Assessing…" : "Run Assessment"}
              {!loading && (
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              )}
            </button>
          </div>

          <label className="mt-4 inline-flex cursor-pointer select-none items-center gap-2.5 text-[0.82rem] text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={fresh}
              onChange={(e) => setFresh(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 cursor-pointer rounded border-[var(--color-line)] accent-[var(--color-accent)]"
            />
            Force fresh research
            <span className="text-[var(--color-faint)]">
              — bypass cache and re-run live
            </span>
          </label>

          {selectedRow && !loading && !result && (
            <p className="mt-4 border-t border-[var(--color-line-soft)] pt-4 text-[0.82rem] text-[var(--color-faint)]">
              {selectedRow.name} · {selectedRow.country} ·{" "}
              {selectedRow.category}
            </p>
          )}
        </div>

        {loadError && (
          <p className="mt-3 text-center text-[0.82rem] text-[var(--color-sev-critical)]">
            {loadError}
          </p>
        )}
      </div>

      {/* Loading — professional and patient */}
      {loading && (
        <div className="mx-auto mt-20 flex max-w-[720px] flex-col items-center text-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span
              className="absolute h-6 w-6 rounded-full bg-[var(--color-accent)]/30"
              style={{ animation: "radar-pulse 2.4s ease-out infinite" }}
            />
            <span
              className="absolute h-6 w-6 rounded-full bg-[var(--color-accent)]/30"
              style={{
                animation: "radar-pulse 2.4s ease-out infinite",
                animationDelay: "1.2s",
              }}
            />
            <span className="relative h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
          </div>
          <p className="mt-7 font-display text-xl text-[var(--color-navy)]">
            Researching supplier risk…
          </p>
          <p className="mt-2 max-w-[24rem] text-[0.88rem] leading-relaxed text-[var(--color-faint)]">
            This runs live web research and contract analysis — up to a few
            minutes on a fresh run.
          </p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="mx-auto mt-12 max-w-[720px] rounded-xl border border-[var(--color-sev-critical)]/30 bg-[#fef2f2] px-5 py-4">
          <p className="flex items-center gap-2 text-[0.9rem] font-medium text-[var(--color-sev-critical)]">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
            Assessment could not be completed
          </p>
          <p className="mt-1 pl-[25px] text-[0.85rem] text-[var(--color-slate)]">
            {error}
          </p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <article className="rise mx-auto mt-16 max-w-[720px]">
          {/* Brief masthead */}
          <div className="text-center">
            <p className="eyebrow text-[var(--color-accent)]">
              Risk Brief · {result.supplier_id}
            </p>
            <h2 className="mt-3 font-display text-[2.5rem] font-semibold leading-[1.1] tracking-[-0.01em] text-[var(--color-ink)]">
              {result.supplier_name}
            </h2>
            {sev && (
              <div className="mt-5 inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5"
                style={{ borderColor: `${sev.color}33`, background: sev.soft }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: sev.color }}
                />
                <span
                  className="text-[0.8rem] font-medium"
                  style={{ color: sev.color }}
                >
                  {sev.label} · score{" "}
                  {result.profile.concentration_score.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Validation failure */}
          {!brief && (
            <div className="mt-12 rounded-xl border border-[var(--color-sev-critical)]/30 bg-[#fef2f2] px-5 py-5">
              <p className="eyebrow text-[var(--color-sev-critical)]">
                Validation failed
              </p>
              <p className="mt-2 text-[0.88rem] text-[var(--color-slate)]">
                The brief was withheld because it did not pass source
                verification. Flagged issues:
              </p>
              <ul className="mt-3 space-y-1.5">
                {result.violations.map((v, i) => (
                  <li
                    key={i}
                    className="font-mono text-[0.8rem] text-[var(--color-sev-critical)]"
                  >
                    {v}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Five sections */}
          {brief && (
            <div className="mt-10">
              <Section index="01" label="Concentration Profile">
                {brief.concentration_profile.map((c, i) => (
                  <ClaimBlock key={i} claim={c} hideSources />
                ))}
              </Section>

              <Section index="02" label="Risk Signals">
                {brief.risk_signals.map((c, i) => (
                  <ClaimBlock key={i} claim={c} />
                ))}
              </Section>

              <Section index="03" label="Contract Implications">
                {brief.contract_implications.map((c, i) => (
                  <ClaimBlock key={i} claim={c} />
                ))}
              </Section>

              <Section index="04" label="Recommended Actions">
                {brief.recommended_actions.map((c, i) => (
                  <ClaimBlock key={i} claim={c} />
                ))}
              </Section>

              {/* Confidence — honest, measured caveats */}
              <section className="pt-9">
                <div className="mb-5 flex items-baseline gap-4 border-t border-[var(--color-line)] pt-6">
                  <span className="font-display text-2xl leading-none text-[var(--color-faint)]">
                    05
                  </span>
                  <h2 className="eyebrow text-[var(--color-navy)]">
                    Confidence
                  </h2>
                </div>
                <ul className="space-y-3 border-l-2 border-[var(--color-line)] pl-5">
                  {brief.confidence.map((s, i) => (
                    <li
                      key={i}
                      className="text-[0.95rem] italic leading-relaxed text-[var(--color-muted)]"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {/* Profile card — four figures */}
          <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
            <Figure
              label="Concentration"
              value={result.profile.concentration_score.toFixed(1)}
              accent={sev?.color}
            />
            <Figure label="Spend share" value={result.profile.spend_share_display} />
            <Figure
              label="Single-source SKUs"
              value={String(result.profile.skus_single_sourced)}
            />
            <Figure
              label="Line-down gap"
              value={`${result.profile.line_down_gap_weeks} wks`}
            />
          </div>

          {/* Meta footer */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-center text-[0.78rem] text-[var(--color-faint)]">
            <span
              className="inline-flex items-center gap-1.5 font-medium"
              style={{
                color: result.meta.cached
                  ? "var(--color-muted)"
                  : "var(--color-accent)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: result.meta.cached
                    ? "var(--color-faint)"
                    : "var(--color-accent)",
                }}
              />
              {result.meta.cached ? "Cached" : "Fresh"}
            </span>
            <span aria-hidden>·</span>
            <span>{result.meta.turns} research turns</span>
            <span aria-hidden>·</span>
            <span>generated {formatDate(result.meta.generated_at)}</span>
            {result.meta.forced && (
              <>
                <span aria-hidden>·</span>
                <span className="text-[var(--color-accent)]">
                  forced submission
                </span>
              </>
            )}
          </div>
        </article>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ *
 *  Figure cell for the profile card
 * ------------------------------------------------------------------ */
function Figure({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-[var(--color-card)] px-5 py-6 text-center">
      <p
        className="font-display text-[2rem] font-semibold leading-none"
        style={{ color: accent ?? "var(--color-navy)" }}
      >
        {value}
      </p>
      <p className="eyebrow mt-3 text-[0.58rem] text-[var(--color-faint)]">
        {label}
      </p>
    </div>
  );
}

/* Small radar monogram for the masthead */
function RadarMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-navy)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12 19 7" stroke="var(--color-accent)" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1" fill="var(--color-navy)" stroke="none" />
    </svg>
  );
}
