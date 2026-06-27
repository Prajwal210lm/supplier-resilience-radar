"use client";

import { motion, useReducedMotion } from "framer-motion";

const STAGES: { n: string; name: string; line: string }[] = [
  {
    n: "01",
    name: "Profile",
    line: "Tested code calculates every number: how much GCI spends here, how many parts have no backup supplier, and how long the line would stop if this supplier failed.",
  },
  {
    n: "02",
    name: "Research",
    line: "The AI agent searches the live web and reads the supplier's own contract, covering the company, its country, its shipping route, and the contract terms.",
  },
  {
    n: "03",
    name: "Synthesize",
    line: "The agent writes the brief in five short sections. Every figure is pulled straight from the calculations, never re-guessed by the model.",
  },
  {
    n: "04",
    name: "Validate",
    line: "A final check throws the brief out if any number cannot be reproduced, or any cited source was not actually found.",
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
          <span className="text-[var(--color-accent-bright)]">Every claim is checked against what the agent actually found.</span>{" "}
          If it cannot reproduce a number, or point to a real source, the brief is withheld.
        </p>
      </motion.div>
    </div>
  );
}
