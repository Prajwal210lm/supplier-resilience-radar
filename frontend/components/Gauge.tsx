"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CountUp } from "./motion";
import { severity } from "@/lib/format";

/* ------------------------------------------------------------------ *
 *  Concentration gauge — a 270° instrument dial. The arc sweeps from
 *  0 to the score, coloured by severity (red/amber/emerald), the value
 *  counts up in the centre. This is the signature visual.
 * ------------------------------------------------------------------ */

const START = -135; // lower-left
const END = 135; // lower-right (270° sweep, gap at the bottom)

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}`;
}

export default function Gauge({ score, size = 280 }: { score: number; size?: number }) {
  const reduce = useReducedMotion();
  const sev = severity(score);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 26;
  const track = arc(cx, cy, r, START, END);
  const frac = Math.max(0, Math.min(1, score / 100));

  // Major tick marks at 0/25/50/75/100 around the sweep.
  const ticks = [0, 25, 50, 75, 100].map((t) => {
    const a = START + (t / 100) * (END - START);
    const o = polar(cx, cy, r + 11, a);
    const i = polar(cx, cy, r + 4, a);
    return { key: t, x1: o.x, y1: o.y, x2: i.x, y2: i.y };
  });

  return (
    <div className="relative mx-auto aspect-square w-full" style={{ maxWidth: size }}>
      <svg className="h-full w-full" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Concentration score ${score.toFixed(1)} out of 100`}>
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={sev.color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={sev.color} />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <line key={t.key} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="var(--color-line-strong)" strokeWidth={2} strokeLinecap="round" />
        ))}

        {/* track */}
        <path d={track} fill="none" stroke="var(--color-line)" strokeWidth={12} strokeLinecap="round" />

        {/* value arc */}
        <motion.path
          d={track}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth={12}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 7px ${sev.color}88)` }}
          initial={{ pathLength: reduce ? frac : 0 }}
          animate={{ pathLength: frac }}
          transition={{ duration: reduce ? 0 : 1.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      {/* center readout */}
      <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
        <div className="kicker text-[var(--color-ink-3)]">Concentration</div>
        <div className="mt-1 flex items-end justify-center gap-1">
          <CountUp
            value={score}
            decimals={1}
            className="font-display text-6xl font-semibold leading-none tabular-nums"
          />
          <span className="mb-1 font-mono text-sm text-[var(--color-ink-3)]">/100</span>
        </div>
        <div
          className="mt-3 inline-flex items-center justify-center gap-1.5 self-center rounded-full border px-2.5 py-0.5"
          style={{ borderColor: sev.ring, background: sev.soft }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: sev.color }} />
          <span className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.14em]" style={{ color: sev.color }}>
            {sev.label}
          </span>
        </div>
      </div>
    </div>
  );
}
