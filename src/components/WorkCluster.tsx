"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CLUSTER, LINKS, ORB_PX } from "@/content/cluster";
import { THEMES, type Theme, type WorkCard } from "@/content/projects";
import { Chip } from "./Section";

// The "number constellation": seven orbs at different depths, each showing one
// headline figure. Hover (or tap) reveals the project in the side panel; click
// (or the panel CTA) opens the deep-dive. Pointer tilt is CSS variables only —
// no React state on mouse move — so every frame is compositor work.

const hoverable = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

export function WorkCluster({ items }: { items: WorkCard[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [themeHL, setThemeHL] = useState<Theme | null>(null);
  const [live, setLive] = useState(false);
  const enterT = useRef<number | null>(null);
  const leaveT = useRef<number | null>(null);

  const bySlug = useMemo(() => Object.fromEntries(items.map((i) => [i.slug, i])), [items]);
  const related = useMemo(() => new Set(LINKS.flatMap(([a, b]) => (a === active ? [b] : b === active ? [a] : []))), [active]);
  const current = active ? bySlug[active] : null;

  // Hold compositor layers only while the section is on screen.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => setLive(es.some((e) => e.isIntersecting)), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = stage.current;
    if (!el || reduce || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-py * 5).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * 6).toFixed(2)}deg`);
  }
  // Hover intent (70 ms) and a leave grace period (140 ms) so the pointer can
  // travel to the panel without the reveal collapsing — WCAG 1.4.13.
  function hoverIn(slug: string) {
    if (leaveT.current) { clearTimeout(leaveT.current); leaveT.current = null; }
    if (enterT.current) clearTimeout(enterT.current);
    enterT.current = window.setTimeout(() => setActive(slug), 70);
  }
  function onLeave() {
    stage.current?.style.setProperty("--rx", "0deg");
    stage.current?.style.setProperty("--ry", "0deg");
    if (enterT.current) { clearTimeout(enterT.current); enterT.current = null; }
    if (!pinned) leaveT.current = window.setTimeout(() => setActive(null), 140);
  }
  function panelEnter() {
    if (leaveT.current) { clearTimeout(leaveT.current); leaveT.current = null; }
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
      {/* ── Stage ─────────────────────────────────────────────────────── */}
      <div
        className={`cluster relative h-[400px] select-none rounded-2xl border border-line bg-surface sm:h-[480px] lg:h-[560px] ${live ? "cluster-live" : ""}`}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onClick={(e) => {
          if (e.target === e.currentTarget) release();
        }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(60%_60%_at_50%_45%,var(--accent-soft),transparent_70%)] opacity-60" />
        <div ref={stage} className="stage absolute inset-0">
          <svg className="lines pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {LINKS.map(([a, b]) => {
              const A = CLUSTER.find((n) => n.slug === a)!;
              const B = CLUSTER.find((n) => n.slug === b)!;
              const on = active === a || active === b;
              return <line key={a + b} x1={A.x} y1={A.y} x2={B.x} y2={B.y} className={on ? "line line-on" : "line"} />;
            })}
          </svg>

          {CLUSTER.map((n, i) => {
            const item = bySlug[n.slug];
            const s = 1 + n.z / 700;
            const o = Math.min(1, Math.max(0.72, 0.72 + n.z / 600));
            const isOn = active === n.slug;
            const dim = (active && !isOn && !related.has(n.slug)) || (themeHL && item && !item.themes.includes(themeHL));
            return (
              <button
                key={n.slug}
                type="button"
                className={`node ${isOn ? "node-on" : ""} ${dim ? "node-dim" : ""} node-${n.size}`}
                style={{ left: `${n.x}%`, top: `${n.y}%`, ["--z" as string]: `${n.z}px`, ["--s" as string]: s.toFixed(3), ["--o" as string]: o.toFixed(2), ["--orb" as string]: `${ORB_PX[n.size]}px` }}
                aria-describedby="work-panel"
                aria-pressed={isOn}
                aria-label={`${item?.title ?? n.slug}: ${n.value} ${n.label}`}
                onPointerEnter={(e) => {
                  if (e.pointerType !== "touch" && !pinned) hoverIn(n.slug);
                }}
                onFocus={() => setActive(n.slug)}
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
        </div>
        <div className="pointer-events-none absolute bottom-3 left-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
          {pinned ? "tap again to open · tap background to release" : "hover a number · click to open"}
        </div>
      </div>

      {/* ── Panel ─────────────────────────────────────────────────────── */}
      <div id="work-panel" aria-live="polite" onPointerEnter={panelEnter} onPointerLeave={() => { if (!pinned) leaveT.current = window.setTimeout(() => setActive(null), 140); }} className="relative min-h-[420px] rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-24 lg:self-start">
        <AnimatePresence mode="wait" initial={false}>
          {current ? (
            <motion.div
              key={current.slug}
              initial={reduce ? false : "hidden"}
              animate="show"
              exit={reduce ? undefined : "exit"}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } }, exit: { opacity: 0, y: 8, transition: { duration: 0.16 } } }}
            >
              <Row>
                <div className="flex items-start justify-between gap-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
                  <span>{current.themes.join(" · ")}</span>
                  {pinned ? (
                    <button type="button" onClick={release} className="rounded-full border border-line px-2 py-0.5 normal-case tracking-normal text-muted hover:text-ink">
                      ✕ release
                    </button>
                  ) : (
                    <span>{current.period.split(" · ").slice(0, 2).join(" · ")}</span>
                  )}
                </div>
              </Row>
              <Row>
                <h3 className="mt-3 text-[22px] font-semibold leading-snug text-ink">{current.title}</h3>
              </Row>
              <Row>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{current.short}</p>
              </Row>
              <Row>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {current.headline.slice(0, 3).map((m) => (
                    <div key={m.label} className="rounded-md border border-line bg-surface-2/60 px-2.5 py-2">
                      <div className="font-mono text-[15px] font-medium leading-tight text-ink">{m.value}</div>
                      <div className="mt-1 text-[11px] leading-tight text-muted">{m.label}</div>
                    </div>
                  ))}
                </div>
              </Row>
              <Row>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {current.stack.slice(0, 5).map((s) => (
                    <Chip key={s}>{s}</Chip>
                  ))}
                </div>
              </Row>
              <Row>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/work/${current.slug}`}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink shadow-[0_12px_30px_-12px_var(--accent)] transition-transform hover:-translate-y-0.5"
                  >
                    {current.cta ?? "Read the deep-dive"} <span aria-hidden>→</span>
                  </Link>
                  {current.readMin ? <span className="font-mono text-[11px] text-faint">{current.readMin} min read</span> : null}
                </div>
              </Row>
              {current.teaser ? (
                <Row>
                  <p className="serif-lesson mt-5 text-[19px] leading-snug text-ink">“{current.teaser}”</p>
                </Row>
              ) : null}
            </motion.div>
          ) : (
            <motion.div key="idle" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: 8, transition: { duration: 0.16 } }} transition={{ duration: 0.3 }}>
              <p className="serif-lesson text-[26px] leading-tight text-ink sm:text-[30px]">Seven systems, one rule: the agent has to be right.</p>
              <p className="mt-3 text-[14px] leading-relaxed text-muted">Each orb is one production system and the number it&apos;s known for. Hover one to see what it is; click to read how it was built — and what went wrong on the way.</p>
              <div className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Themes</div>
              <div className="mt-2 flex flex-wrap gap-1.5" onMouseLeave={() => setThemeHL(null)}>
                {THEMES.filter((t) => items.some((i) => i.themes.includes(t))).map((t) => (
                  <button key={t} type="button" onMouseEnter={() => setThemeHL(t)} onFocus={() => setThemeHL(t)} onBlur={() => setThemeHL(null)} className="rounded-full border border-line px-3 py-1 text-[12.5px] text-muted transition-colors hover:border-accent hover:text-accent">
                    {t}
                  </button>
                ))}
              </div>
              <ul className="mt-6 space-y-1.5 text-[13px] text-muted">
                {items.map((i) => (
                  <li key={i.slug}>
                    <Link href={`/work/${i.slug}`} className="transition-colors hover:text-accent" onMouseEnter={() => setActive(i.slug)} onMouseLeave={() => !pinned && setActive(null)}>
                      {i.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } } }}>
      {children}
    </motion.div>
  );
}
