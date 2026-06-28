import type { Metadata } from "next";
import Link from "next/link";
import { CONTRACT_LIBRARY } from "@/lib/format";
import { ArrowRight, Doc } from "@/components/icons";

export const metadata: Metadata = {
  title: "Contract library · Supplier Resilience Radar",
  description:
    "The four case-study supplier contracts the tool reads and analyses to assess contract risk.",
};

export default function ContractsIndex() {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-base)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1000px] items-center justify-between px-6 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-display text-[0.9rem] font-semibold text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent-bright)]"
          >
            <ArrowRight size={14} className="rotate-180" />
            Resilience Radar
          </Link>
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-[var(--color-ink-3)]">
            <Doc size={12} /> Contract library
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1000px] px-6 pb-32 sm:px-8">
        <section className="pt-14 sm:pt-20">
          <p className="kicker text-[var(--color-accent)]">Case-study contracts</p>
          <h1 className="mt-4 font-display text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.02em] text-[var(--color-ink)] sm:text-[3.4rem]">
            The contracts I wrote
          </h1>
          <p className="mt-5 max-w-[46rem] text-[1.05rem] leading-relaxed text-[var(--color-ink-2)]">
            Four representative supplier contracts that span the risk spectrum, from a single-source
            trap to a buyer-protective deal, so the tool has real contracts to read and analyse. These
            are the only four contracts in the case study. The other suppliers in the dataset have none
            on file, which the tool reports honestly rather than inventing terms.
          </p>
        </section>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {CONTRACT_LIBRARY.map((c, i) => (
            <Link
              key={c.id}
              href={`/contract/${c.id}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/70 p-6 transition-colors hover:border-[var(--color-accent)]/45 sm:p-7"
            >
              <span className="absolute left-0 top-0 h-full w-[3px] bg-transparent transition-colors group-hover:bg-[var(--color-accent)]/70" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[0.78rem] text-[var(--color-accent)]">
                  {String(i + 1).padStart(2, "0")} · {c.id}
                </span>
                <Doc size={16} className="text-[var(--color-ink-3)] transition-colors group-hover:text-[var(--color-accent-bright)]" />
              </div>
              <h2 className="mt-3 font-display text-[1.6rem] font-semibold leading-tight text-[var(--color-ink)]">{c.name}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-md border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-2 py-0.5 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-[var(--color-ink-2)]">
                  {c.country}
                </span>
                <span className="rounded-md border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-2 py-0.5 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-[var(--color-ink-2)]">
                  {c.category.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-4 flex-1 text-[0.95rem] leading-relaxed text-[var(--color-ink-2)]">{c.note}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-[var(--color-accent-bright)]">
                Read the full contract
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
