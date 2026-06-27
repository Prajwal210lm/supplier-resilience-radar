"use client";

import { motion, useReducedMotion } from "framer-motion";

const STAGES: { n: string; name: string; line: string }[] = [
  {
    n: "01",
    name: "Profile",
    line: "Deterministic. Tested Python computes every number — spend share, single-source count, line-down gap, the concentration score.",
  },
  {
    n: "02",
    name: "Research",
    line: "Agentic. A ReAct loop runs live web search and retrieves the supplier's own contract across company, country, logistics and contract risk.",
  },
  {
    n: "03",
    name: "Synthesize",
    line: "Writes the board-ready brief — five sections, every figure rendered from the profile, never re-guessed by the model.",
  },
  {
    n: "04",
    name: "Validate",
    line: "Rejects the brief if any number can't be reproduced or any cited source wasn't actually retrieved.",
  },
];

export default function Architecture() {
  const reduce = useReducedMotion();
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((s, i) => (
          <motion.div
            key={s.name}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 0.55, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="group relative"
          >
            {/* connector to the next stage (desktop) */}
            {i < STAGES.length - 1 && (
              <div className="pointer-events-none absolute right-[-12px] top-9 hidden h-px w-6 lg:block">
                <motion.div
                  className="h-px w-full origin-left"
                  style={{ background: "linear-gradient(90deg, var(--color-accent), transparent)" }}
                  initial={{ scaleX: reduce ? 1 : 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.25 + i * 0.12 }}
                />
              </div>
            )}
            <div className="h-full rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]/80 p-5 transition-colors duration-300 hover:border-[var(--color-accent)]/40">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[0.7rem] text-[var(--color-accent)]">{s.n}</span>
                <span className="h-1 w-1 rounded-full bg-[var(--color-line-strong)]" />
                <span className="font-display text-[1.05rem] font-semibold text-[var(--color-ink)]">{s.name}</span>
              </div>
              <p className="mt-2.5 text-[0.85rem] leading-relaxed text-[var(--color-ink-2)]">{s.line}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* anti-fabrication banner — the strongest part of the story */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 0.55, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="mt-5 overflow-hidden rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)] p-5"
      >
        <p className="font-display text-[1.05rem] font-medium leading-snug text-[var(--color-ink)] sm:text-[1.2rem]">
          Every number comes from tested code.{" "}
          <span className="text-[var(--color-accent-bright)]">Every claim is checked against what the agent actually retrieved</span>{" "}
          — a figure it can&apos;t reproduce or a source it never fetched is rejected before the brief renders.
        </p>
      </motion.div>
    </div>
  );
}
