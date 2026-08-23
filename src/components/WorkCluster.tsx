"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { CLUSTER, ORB_PX } from "@/content/cluster";
import { THEMES, type Theme, type WorkCard } from "@/content/projects";
import { Chip } from "./Section";

// Seven independent projects as floating orbs, each showing its headline
// figure. Hover (or tap) reveals the project card; click (or the card's CTA)
// opens the deep-dive. The hit area is the static button; only the visual
// layer floats/parallaxes, so hover is reliable on every orb.

const hoverable = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

export function WorkCluster({ items }: { items: WorkCard[] }) {
  const router = useRouter();
  const stage = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [themeHL, setThemeHL] = useState<Theme | null>(null);
  const [live, setLive] = useState(false);
  const leaveT = useRef<number | null>(null);

  const bySlug = useMemo(() => Object.fromEntries(items.map((i) => [i.slug, i])), [items]);
  const current = active ? bySlug[active] : null;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => setLive(es.some((e) => e.isIntersecting)), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Parallax drives only the visual layer (CSS vars), never the hit areas.
  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = stage.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  }
  function clearLeave() {
    if (leaveT.current) { clearTimeout(leaveT.current); leaveT.current = null; }
  }
  function hoverIn(slug: string) {
    clearLeave();
    setActive(slug);
  }
  function scheduleLeave() {
    clearLeave();
    if (!pinned) leaveT.current = window.setTimeout(() => setActive(null), 140);
  }
  function onStageLeave() {
    stage.current?.style.setProperty("--px", "0");
    stage.current?.style.setProperty("--py", "0");
    scheduleLeave();
  }
  function release() {
    setPinned(false);
    setActive(null);
  }
  function onNode(slug: string) {
    if (hoverable() || (pinned && active === slug)) router.push(`/work/${slug}`);
    else {
      setActive(slug);
      setPinned(true);
    }
  }
  function onKey(e: KeyboardEvent<HTMLButtonElement>, slug: string) {
    if (e.key === "Escape") release();
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/work/${slug}`);
    }
  }

  return (
    <div ref={wrap} className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-8">
      {/* ── Field ─────────────────────────────────────────────────────── */}
      <div
        ref={stage}
        className={`cluster relative h-[400px] select-none overflow-hidden rounded-2xl border border-line bg-surface sm:h-[480px] lg:h-[560px] ${live ? "cluster-live" : ""}`}
        onPointerMove={onMove}
        onPointerLeave={onStageLeave}
        onPointerEnter={clearLeave}
        onClick={(e) => {
          if (e.target === e.currentTarget) release();
        }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_55%_at_50%_48%,var(--accent-soft),transparent_72%)] opacity-60" />
        {CLUSTER.map((n, i) => {
          const item = bySlug[n.slug];
          const depth = (n.z + 100) / 200; // 0 far → 1 near
          const s = 0.82 + depth * 0.28;
          const o = 0.62 + depth * 0.38;
          const isOn = active === n.slug;
          const dim = (active && !isOn) || (themeHL && item && !item.themes.includes(themeHL));
          return (
            <button
              key={n.slug}
              type="button"
              className={`node ${isOn ? "node-on" : ""} ${dim ? "node-dim" : ""} node-${n.size}`}
              style={{
                left: `${n.x}%`,
                top: `${n.y}%`,
                ["--s" as string]: s.toFixed(3),
                ["--o" as string]: o.toFixed(2),
                ["--d" as string]: depth.toFixed(2),
                ["--orb" as string]: `${ORB_PX[n.size]}px`,
                ["--vf" as string]: n.value.length > 7 ? "0.7" : n.value.length > 4 ? "0.82" : "1",
              }}
              aria-describedby="work-panel"
              aria-pressed={isOn}
              aria-label={`${item?.title ?? n.slug}: ${n.value} ${n.label}`}
              onPointerEnter={(e) => {
                if (e.pointerType !== "touch" && !pinned) hoverIn(n.slug);
              }}
              onFocus={() => hoverIn(n.slug)}
              onClick={(e) => {
                e.stopPropagation();
                onNode(n.slug);
              }}
              onKeyDown={(e) => onKey(e, n.slug)}
            >
              <span className="node-float" style={{ animationDelay: `${-(i * 1.3)}s`, animationDuration: `${6 + (i % 3)}s` }}>
                <span className="node-core">
                  <span className="orb" aria-hidden />
                  <span className="value">{n.value}</span>
                  <span className="label">{n.label}</span>
                </span>
              </span>
            </button>
          );
        })}
        <div className="pointer-events-none absolute bottom-3 left-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
          {pinned ? "tap again to open · tap background to release" : "hover a number · click to open"}
        </div>
      </div>

      {/* ── Card ──────────────────────────────────────────────────────── */}
      <div
        id="work-panel"
        aria-live="polite"
        onPointerEnter={clearLeave}
        onPointerLeave={scheduleLeave}
        className="relative min-h-[420px] rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-24 lg:self-start"
      >
        {current ? (
          <div key={current.slug} className="panel-swap">
            <div className="panel-row flex items-start justify-between gap-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
              <span>{current.themes.join(" · ")}</span>
              {pinned ? (
                <button type="button" onClick={release} className="rounded-full border border-line px-2 py-0.5 normal-case tracking-normal text-muted hover:text-ink">
                  ✕ release
                </button>
              ) : (
                <span>{current.period.split(" · ").slice(0, 2).join(" · ")}</span>
              )}
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
            <p className="panel-row mt-3 text-[14px] leading-relaxed text-muted">Each orb is one production system and the number it&apos;s known for. Hover one to see what it is; click to read how it was built — and what went wrong on the way.</p>
            <div className="panel-row mt-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Themes</div>
            <div className="panel-row mt-2 flex flex-wrap gap-1.5" onMouseLeave={() => setThemeHL(null)}>
              {THEMES.filter((t) => items.some((i) => i.themes.includes(t))).map((t) => (
                <button key={t} type="button" onMouseEnter={() => setThemeHL(t)} onFocus={() => setThemeHL(t)} onBlur={() => setThemeHL(null)} className="rounded-full border border-line px-3 py-1 text-[12.5px] text-muted transition-colors hover:border-accent hover:text-accent">
                  {t}
                </button>
              ))}
            </div>
            <ul className="panel-row mt-6 space-y-1.5 text-[13px] text-muted">
              {items.map((i) => (
                <li key={i.slug}>
                  <Link href={`/work/${i.slug}`} className="transition-colors hover:text-accent" onMouseEnter={() => hoverIn(i.slug)}>
                    {i.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
