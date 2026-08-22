"use client";

import { useRef, useState } from "react";
import { useInViewOnce } from "@/lib/useInViewOnce";
import { motion, useReducedMotion } from "motion/react";

// Two single-series column charts: dollars per day, and LLM nudge turns per
// hour. Different scales → two charts, never a dual axis. One hue, direct
// labels on the caps, recessive grid, per-mark hover, and a table view.

type Bar = { label: string; value: number; note: string };

const COST: Bar[] = [
  { label: "Aug 1", value: 67, note: "Baseline, after correcting the cumulative-cost bug" },
  { label: "Aug 6", value: 26.84, note: "1-hour cache TTL · context recycling · 25 unused tools dropped" },
  { label: "Aug 11", value: 10.72, note: "Rule-based nudges shipped; traced across 580 turns, 22 riders" },
];

const TURNS: Bar[] = [
  { label: "LLM nudges", value: 35.3, note: "Every heartbeat, chase and reminder drafted by the model" },
  { label: "Rule-based", value: 1.4, note: "Templates over the snapshot, with a send-time freshness guard" },
];

function Column({ data, unit, fmt, title, id }: { data: Bar[]; unit: string; fmt: (v: number) => string; title: string; id: string }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const figRef = useRef<HTMLElement>(null);
  const seen = useInViewOnce(figRef, { amount: 0.2 });
  const W = 360, H = 220, padL = 40, padR = 16, padT = 28, padB = 34;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(...data.map((d) => d.value)) * 1.12;
  const slot = innerW / data.length;
  const bw = Math.min(24, slot * 0.5);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = [0, 0.5, 1].map((k) => max * k);

  return (
    <figure ref={figRef} className="min-w-0 flex-1">
      <figcaption className="mb-2 text-sm font-semibold text-ink">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{title}</title>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--faint)" fontFamily="var(--font-mono)">
              {fmt(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + slot * i + slot / 2;
          const top = y(d.value);
          const h = padT + innerH - top;
          const r = Math.min(4, h);
          const on = hover === i;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + slot * i} y={padT} width={slot} height={innerH} fill="transparent" />
              <motion.path
                d={`M ${cx - bw / 2} ${padT + innerH} V ${top + r} Q ${cx - bw / 2} ${top} ${cx - bw / 2 + r} ${top} H ${cx + bw / 2 - r} Q ${cx + bw / 2} ${top} ${cx + bw / 2} ${top + r} V ${padT + innerH} Z`}
                fill="var(--accent)"
                opacity={hover === null || on ? 1 : 0.45}
                style={{ transformOrigin: `${cx}px ${padT + innerH}px` }}
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: seen || reduce ? 1 : 0 }}
                transition={{ duration: 0.8, delay: 0.12 * i, ease: [0.22, 1, 0.36, 1] }}
              />
              <text x={cx} y={top - 7} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="var(--ink)" fontFamily="var(--font-mono)">
                {fmt(d.value)}
              </text>
              <text x={cx} y={H - 12} textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="var(--font-sans)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 min-h-[2.4rem] text-[12.5px] leading-snug text-muted" aria-live="polite">
        {hover === null ? <span className="text-faint">{unit} — hover a column for what changed.</span> : <><span className="font-medium text-ink">{data[hover].label}:</span> {data[hover].note}</>}
      </div>
    </figure>
  );
}

export function CostChart() {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <Column id="cost" title="Agent spend per day (USD)" unit="Traced per turn, not billed" data={COST} fmt={(v) => `$${v.toFixed(v >= 10 ? 0 : 2)}`} />
        <Column id="turns" title="Nudge LLM turns per hour" unit="Measured across the Aug-8 window" data={TURNS} fmt={(v) => v.toFixed(1)} />
      </div>
      <details className="mt-4 text-[12.5px] text-muted">
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.14em] text-faint hover:text-ink">View as table</summary>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <table className="w-full text-left">
            <thead><tr className="text-faint"><th className="font-medium">Day</th><th className="font-medium">USD / day</th></tr></thead>
            <tbody>{COST.map((d) => <tr key={d.label}><td>{d.label}</td><td className="font-mono">${d.value.toFixed(2)}</td></tr>)}</tbody>
          </table>
          <table className="w-full text-left">
            <thead><tr className="text-faint"><th className="font-medium">Mode</th><th className="font-medium">Turns / hour</th></tr></thead>
            <tbody>{TURNS.map((d) => <tr key={d.label}><td>{d.label}</td><td className="font-mono">{d.value.toFixed(1)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
