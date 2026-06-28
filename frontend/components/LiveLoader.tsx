"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const STEPS = [
  "Scanning current company & country news",
  "Checking port and shipping-corridor signals",
  "Retrieving and reading the supplier contract",
  "Drafting the brief and validating every source",
];

/* On-brand loader for a live (2–3 min) run: a radar sweep with concentric
   ping rings and a cycling status line. Falls back to a static state when
   reduced motion is requested. */
export default function LiveLoader({ fresh }: { fresh: boolean }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!fresh || reduce) return;
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2600);
    return () => clearInterval(id);
  }, [fresh, reduce]);

  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-center px-6 py-4 text-center">
      <div className="relative grid h-32 w-32 place-items-center">
        {/* ping rings */}
        {!reduce &&
          [0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute h-12 w-12 rounded-full border border-[var(--color-accent)]/40"
              style={{ animation: "ping-ring 2.8s ease-out infinite", animationDelay: `${i * 0.9}s` }}
            />
          ))}
        {/* dial */}
        <div className="relative grid h-24 w-24 place-items-center rounded-full border border-[var(--color-line-strong)] bg-[var(--color-surface)]">
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(79,140,255,0) 0deg, rgba(79,140,255,0.35) 60deg, rgba(79,140,255,0) 70deg)",
              }}
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 2.4, ease: "linear", repeat: Infinity }}
            />
          </div>
          <span className="relative h-2 w-2 rounded-full bg-[var(--color-accent)]" style={{ boxShadow: "0 0 12px var(--color-accent)" }} />
        </div>
      </div>

      <p className="mt-7 font-display text-xl font-medium text-[var(--color-ink)]">
        {fresh ? "Running live research" : "Loading brief"}
      </p>

      {fresh ? (
        <>
          <div className="mt-3 h-5 overflow-hidden">
            <motion.p
              key={step}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="font-mono text-[0.8rem] text-[var(--color-accent-bright)]"
            >
              {STEPS[step]}
            </motion.p>
          </div>
          <p className="mt-3 max-w-[28rem] text-[0.85rem] leading-relaxed text-[var(--color-ink-3)]">
            Live web research and contract analysis typically take 2 to 3 minutes. The agent
            works through company, country, logistics and contract risk before it writes.
          </p>
        </>
      ) : (
        <p className="mt-3 font-mono text-[0.8rem] text-[var(--color-ink-3)]">Reading the most recent cached assessment…</p>
      )}
    </div>
  );
}
