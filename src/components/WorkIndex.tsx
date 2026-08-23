"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CLUSTER } from "@/content/cluster";
import { THEMES, type Theme, type WorkCard } from "@/content/projects";
import { Chip } from "./Section";

// An editorial index of the seven projects: full-width rows (title, hook,
// headline figure). Hover a row → the card on the right reveals the project
// with its CTA; click → deep-dive. On touch, a tap expands the row inline.

const hoverable = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

export function WorkIndex({ items }: { items: WorkCard[] }) {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [themeHL, setThemeHL] = useState<Theme | null>(null);
  const leaveT = useRef<number | null>(null);

  const figures = useMemo(() => Object.fromEntries(CLUSTER.map((n) => [n.slug, n])), []);
  const current = active ? items.find((i) => i.slug === active) ?? null : null;

  function clearLeave() {
    if (leaveT.current) { clearTimeout(leaveT.current); leaveT.current = null; }
  }
  function hoverIn(slug: string) {
    clearLeave();
    if (!pinned) setActive(slug);
  }
  function scheduleLeave() {
    clearLeave();
    if (!pinned) leaveT.current = window.setTimeout(() => setActive(null), 140);
  }
  function release() {
    setPinned(false);
    setActive(null);
  }
  function onRow(slug: string) {
    if (hoverable()) router.push(`/work/${slug}`);
    else if (pinned && active === slug) release();
    else {
      setActive(slug);
      setPinned(true);
    }
  }
  function onKey(e: KeyboardEvent<HTMLElement>, slug: string) {
    if (e.key === "Escape") release();
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/work/${slug}`);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr] lg:gap-8">
      {/* ── Index ─────────────────────────────────────────────────────── */}
      <ol className="idx divide-y divide-line rounded-2xl border border-line bg-surface" onPointerLeave={scheduleLeave} onPointerEnter={clearLeave}>
        {items.map((p, i) => {
          const f = figures[p.slug];
          const isOn = active === p.slug;
          const dim = (active && !isOn) || (themeHL && !p.themes.includes(themeHL));
          const expanded = isOn && pinned;
          return (
            <li key={p.slug} className={`idx-row ${isOn ? "idx-on" : ""} ${dim ? "idx-dim" : ""}`}>
              <div
                role="link"
                tabIndex={0}
                aria-describedby="work-panel"
                aria-current={isOn ? "true" : undefined}
                className="idx-hit grid cursor-pointer grid-cols-[2.2rem_1fr_auto] items-center gap-x-4 px-5 py-5 outline-none sm:px-6 sm:py-6"
                onPointerEnter={(e) => { if (e.pointerType !== "touch") hoverIn(p.slug); }}
                onFocus={() => hoverIn(p.slug)}
                onClick={() => onRow(p.slug)}
                onKeyDown={(e) => onKey(e, p.slug)}
              >
                <span className="idx-num font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="idx-title block text-[19px] font-semibold leading-snug text-ink sm:text-[21px]">{p.title}</span>
                  <span className="mt-1 block truncate text-[13px] text-muted">{p.cta ?? p.short}</span>
                </span>
                <span className="idx-fig text-right">
                  <span className="block font-mono text-[20px] font-medium leading-none tracking-tight text-ink sm:text-[24px]">{f?.value ?? p.headline[0]?.value}</span>
                  <span className="mt-1 block text-[11px] text-muted">{f?.label ?? p.headline[0]?.label}</span>
                </span>
                <span aria-hidden className="idx-arrow pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 font-mono text-[18px] text-accent sm:right-6">→</span>
              </div>

              {/* touch: inline expansion */}
              {expanded ? (
                <div className="idx-expand border-t border-line px-5 pb-5 pt-4 sm:px-6 lg:hidden">
                  <p className="text-[14px] leading-relaxed text-muted">{p.short}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {p.headline.slice(0, 3).map((m) => (
                      <div key={m.label} className="rounded-md border border-line bg-surface-2/60 px-2.5 py-2">
                        <div className="font-mono text-[14px] font-medium leading-tight text-ink">{m.value}</div>
                        <div className="mt-1 text-[10.5px] leading-tight text-muted">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <Link href={`/work/${p.slug}`} className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink">
                    {p.cta ?? "Read the deep-dive"} <span aria-hidden>→</span>
                  </Link>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* ── Card (desktop) ────────────────────────────────────────────── */}
      <div
        id="work-panel"
        aria-live="polite"
        onPointerEnter={clearLeave}
        onPointerLeave={scheduleLeave}
        className="relative hidden min-h-[420px] rounded-2xl border border-line bg-surface p-6 lg:sticky lg:top-24 lg:block lg:self-start"
      >
        {current ? (
          <div key={current.slug} className="panel-swap">
            <div className="panel-row flex items-start justify-between gap-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
              <span>{current.themes.join(" · ")}</span>
              <span>{current.period.split(" · ").slice(0, 2).join(" · ")}</span>
            </div>
            <h3 className="panel-row mt-3 text-[22px] font-semibold leading-snug text-ink">{current.title}</h3>
            <p className="panel-row mt-2 text-[14.5px] leading-relaxed text-muted">{current.short}</p>
            <div className="panel-row mt-4 grid grid-cols-3 gap-2">
              {current.headline.slice(0, 3).map((m) => (
                <div key={m.label} className="rounded-md border border-line bg-surface-2/60 px-2.5 py-2">
                  <div className="font-mono text-[15px] font-medium leading-tight text-ink">{m.value}</div>
                  <div className="mt-1 text-[11px] leading-tight text-muted">{m.label}</div>
                </div>
              ))}
            </div>
            <div className="panel-row mt-4 flex flex-wrap gap-1.5">
              {current.stack.slice(0, 5).map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </div>
            <div className="panel-row mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/work/${current.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink shadow-[0_12px_30px_-12px_var(--accent)] transition-transform hover:-translate-y-0.5"
              >
                {current.cta ?? "Read the deep-dive"} <span aria-hidden>→</span>
              </Link>
              {current.readMin ? <span className="font-mono text-[11px] text-faint">{current.readMin} min read</span> : null}
            </div>
            {current.teaser ? <p className="panel-row serif-lesson mt-5 text-[19px] leading-snug text-ink">“{current.teaser}”</p> : null}
          </div>
        ) : (
          <div key="idle" className="panel-swap">
            <p className="panel-row serif-lesson text-[26px] leading-tight text-ink sm:text-[30px]">Seven systems, one rule: the agent has to be right.</p>
            <p className="panel-row mt-3 text-[14px] leading-relaxed text-muted">Each row is one production system and the number it&apos;s known for. Hover a row to see what it is; click to read how it was built — and what went wrong on the way.</p>
            <div className="panel-row mt-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Themes</div>
            <div className="panel-row mt-2 flex flex-wrap gap-1.5" onMouseLeave={() => setThemeHL(null)}>
              {THEMES.filter((t) => items.some((i) => i.themes.includes(t))).map((t) => (
                <button key={t} type="button" onMouseEnter={() => setThemeHL(t)} onFocus={() => setThemeHL(t)} onBlur={() => setThemeHL(null)} className="rounded-full border border-line px-3 py-1 text-[12.5px] text-muted transition-colors hover:border-accent hover:text-accent">
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
