"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PipelinePanel, type Step, type Trace } from "./PipelinePanel";

// The RAG backend on Railway. Override with NEXT_PUBLIC_RAG_API_URL at build time.
export const API = process.env.NEXT_PUBLIC_RAG_API_URL ?? "https://rag-api-production-5a59.up.railway.app";

type Source = { n: number; title: string; heading: string; page_url: string | null; doc_url: string | null; snippet: string; text?: string };
type Msg = { role: "user" | "assistant"; content: string; sources?: Source[]; error?: string; pending?: boolean; trace?: Trace | null; live?: boolean; showSources?: boolean };
type Suggestion = { q: string; group: string; cached: boolean };
type Opts = { pipeline: "a" | "b" | ""; expand: boolean | null; rerank: boolean | null };
const DEFAULT_OPTS: Opts = { pipeline: "", expand: null, rerank: null };
type Quota = { limit: number | null; remaining: number | null };

/** Stable per-browser id so the API can meter live questions per visitor. */
function clientId(): string {
  try {
    let v = localStorage.getItem("ask.cid");
    if (!v) { v = crypto.randomUUID(); localStorage.setItem("ask.cid", v); }
    return v;
  } catch { return "anon"; }
}

/* ────────────────────────── primitives ────────────────────────── */

/** Icon-only button with a hover tooltip. */
export function IconButton({ label, onClick, active, children, className = "" }: { label: string; onClick?: () => void; active?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      <button type="button" onClick={onClick} aria-label={label}
              className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${active ? "bg-accent-soft text-accent" : "text-faint hover:bg-surface-2 hover:text-ink"}`}>
        {children}
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-bg px-2 py-1 font-mono text-[10.5px] text-muted opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </span>
  );
}

const Ic = {
  inspector: <path d="M2 12.5h12M3 9.5l3-3 3 3 4-5" />,
  settings: <><path d="M2 5h12M2 11h12" /><circle cx="6" cy="5" r="1.7" fill="var(--bg)" /><circle cx="10" cy="11" r="1.7" fill="var(--bg)" /></>,
  sources: <><path d="M3 3h6.5a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2z" /><path d="M11.5 5h1.5v9H5" /></>,
  copy: <><rect x="5" y="5" width="8" height="8" rx="1.5" /><path d="M3 10V4a1 1 0 0 1 1-1h6" /></>,
  check: <path d="M3 8.5l3 3 7-7" />,
  send: <path d="M8 13V3M4 7l4-4 4 4" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  open: <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" />,
  spark: <path d="M8 1.5l1.5 4 4 1.5-4 1.5L8 12.5 6.5 8.5l-4-1.5 4-1.5z" />,
  bolt: <path d="M9 1.5 3 9h4l-1 5.5L13 7H9z" />,
  more: <path d="M4 6l4 4 4-4" />,
};
export function Glyph({ k, size = 15, className = "" }: { k: keyof typeof Ic; size?: number; className?: string }) {
  return <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{Ic[k]}</svg>;
}

/** Segmented control. */
function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-bg p-0.5">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
                className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${value === v ? "bg-surface-2 text-ink" : "text-faint hover:text-muted"}`}>{l}</button>
      ))}
    </div>
  );
}

/* ────────────────────────── SSE ────────────────────────── */
async function* sse(res: Response) {
  const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = "";
  const parse = (block: string) => {
    let event = "message", data = "";
    for (const line of block.split("\n")) { if (line.startsWith("event:")) event = line.slice(6).trim(); else if (line.startsWith("data:")) data += line.slice(5).trim(); }
    return data ? { event, data } : null;
  };
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let idx; while ((idx = buf.indexOf("\n\n")) >= 0) { const ev = parse(buf.slice(0, idx)); buf = buf.slice(idx + 2); if (ev) yield ev; }
  }
  const tail = parse(buf.replace(/\r\n/g, "\n")); if (tail) yield tail;
}

/* ────────────────────────── answer rendering ────────────────────────── */
function Inline({ text, sources }: { text: string; sources?: Source[] }) {
  const parts = text.split(/(\[\d+\](?:\[\d+\])*|\*\*[^*]+\*\*|`[^`]+`)/g);
  return <>{parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[12px]">{p.slice(1, -1)}</code>;
    if (!/^\[\d+\]/.test(p)) return <span key={i}>{p}</span>;
    return [...p.matchAll(/\[(\d+)\]/g)].map((x, j) => {
      const n = Number(x[1]); const s = sources?.find((y) => y.n === n); const href = s?.page_url ?? s?.doc_url ?? undefined;
      const chip = <sup key={`${i}-${j}`} className="group relative ml-[2px] inline-grid h-[15px] min-w-[15px] place-items-center rounded-[4px] bg-accent-soft px-[3px] font-mono text-[9.5px] leading-none text-accent align-[3px]">
        {n}{s && <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-1 w-64 rounded-md border border-line bg-bg px-2 py-1.5 text-left font-sans text-[11px] font-normal normal-case leading-snug text-muted opacity-0 shadow-lg transition-opacity group-hover:opacity-100"><span className="text-ink">{s.title}</span><br />{s.heading.split(" › ").slice(1).join(" › ")}</span>}
      </sup>;
      return href ? <a key={`${i}-${j}`} href={href} target="_blank" rel="noreferrer">{chip}</a> : chip;
    });
  })}</>;
}
function Answer({ text, sources }: { text: string; sources?: Source[] }) {
  const blocks: { kind: "p" | "ul"; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd(); const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (m) { const last = blocks[blocks.length - 1]; if (last?.kind === "ul") last.lines.push(m[1]); else blocks.push({ kind: "ul", lines: [m[1]] }); }
    else if (!line.trim()) { if (blocks[blocks.length - 1]?.lines.length) blocks.push({ kind: "p", lines: [] }); }
    else {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "ul" && (/^[\s.,;:!?)\]]+$/.test(line) || /^\s+\S/.test(raw))) last.lines[last.lines.length - 1] = (last.lines[last.lines.length - 1] + (/^[.,;:!?)\]]/.test(line.trim()) ? "" : " ") + line.trim());
      else if (last?.kind === "p") last.lines.push(line);
      else blocks.push({ kind: "p", lines: [line] });
    }
  }
  return <div className="space-y-2.5 text-[14px] leading-[1.65] text-ink/90">{blocks.filter((b) => b.lines.length).map((b, i) =>
    b.kind === "ul" ? <ul key={i} className="space-y-1.5 pl-1">{b.lines.map((l, j) => <li key={j} className="flex gap-2"><span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent/70" /><span><Inline text={l} sources={sources} /></span></li>)}</ul>
                    : <p key={i}><Inline text={b.lines.join(" ")} sources={sources} /></p>)}</div>;
}

function SourceCards({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="mt-3 border-t border-line/70 pt-3">
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <button key={s.n} type="button" onClick={() => setOpen(open === s.n ? null : s.n)} title={s.heading}
                  className={`group inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-[11.5px] transition-colors ${open === s.n ? "border-accent/50 bg-accent-soft text-accent" : "border-line bg-bg text-muted hover:border-rule hover:text-ink"}`}>
            <span className="font-mono text-[10px] text-accent">{s.n}</span><span className="truncate">{s.title}</span>
          </button>))}
      </div>
      {open != null && (() => { const s = sources.find((x) => x.n === open)!; return (
        <div className="mt-2 rounded-lg border border-line bg-bg p-3 text-[12px] leading-relaxed text-muted">
          <div className="mb-1 font-mono text-[10.5px] text-faint">{s.heading}</div>
          <div className="line-clamp-6 whitespace-pre-wrap">{s.text ?? s.snippet}</div>
          <div className="mt-2 flex gap-4 font-mono text-[11px]">{s.page_url && <a className="text-accent hover:underline" href={s.page_url} target="_blank" rel="noreferrer">project page ↗</a>}{s.doc_url && <a className="text-accent hover:underline" href={s.doc_url} target="_blank" rel="noreferrer">source document ↗</a>}</div>
        </div>); })()}
    </div>
  );
}

function SettingsPopover({ opts, setOpts, onClose }: { opts: Opts; setOpts: (o: Opts) => void; onClose: () => void }) {
  const tri = (v: boolean | null): "default" | "on" | "off" => (v == null ? "default" : v ? "on" : "off");
  const fromTri = (v: string) => (v === "default" ? null : v === "on");
  return (
    <div className="absolute right-3 top-12 z-20 w-[260px] rounded-xl border border-line bg-bg p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between"><span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Retrieval settings</span><button onClick={onClose} aria-label="Close" className="text-faint hover:text-ink"><Glyph k="close" size={12} /></button></div>
      {([
        ["Pipeline", "Which index is searched", <Seg key="p" value={opts.pipeline || "default"} onChange={(v) => setOpts({ ...opts, pipeline: v === "default" ? "" : (v as Opts["pipeline"]) })} options={[["default", "auto"], ["a", "A"], ["b", "B"]]} />],
        ["Expansion", "Rewrite the question 2 extra ways", <Seg key="e" value={tri(opts.expand)} onChange={(v) => setOpts({ ...opts, expand: fromTri(v) })} options={[["default", "auto"], ["on", "on"], ["off", "off"]]} />],
        ["Rerank", "Listwise LLM rerank of candidates", <Seg key="r" value={tri(opts.rerank)} onChange={(v) => setOpts({ ...opts, rerank: fromTri(v) })} options={[["default", "auto"], ["on", "on"], ["off", "off"]]} />],
      ] as [string, string, ReactNode][]).map(([l, d, c]) => (
        <div key={l} className="flex items-center justify-between gap-3 py-1.5"><div><div className="text-[12px] text-ink">{l}</div><div className="text-[10.5px] text-faint">{d}</div></div>{c}</div>))}
      <p className="mt-2 text-[10.5px] leading-snug text-faint">A = section chunks · B = atomic propositions → parent section. <em>auto</em> uses the A/B winner.</p>
    </div>
  );
}

/* ────────────────────────── the panel ────────────────────────── */
export function AskPanel({ full = false, extra, onInspectorChange }: { full?: boolean; extra?: ReactNode; onInspectorChange?: (open: boolean) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState<Suggestion[]>([]);
  const [moreSugg, setMoreSugg] = useState(false);
  const [opts, setOpts] = useState<Opts>(DEFAULT_OPTS);
  const [showSettings, setShowSettings] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(full);
  const [inspect, setInspect] = useState<number | null>(null);
  const [health, setHealth] = useState<{ ok: boolean; documents?: number; collections?: Record<string, number> } | null>(null);
  const [quota, setQuota] = useState<Quota>({ limit: null, remaining: null });
  const [copied, setCopied] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const v = localStorage.getItem("ask.opts"); if (v) setOpts({ ...DEFAULT_OPTS, ...JSON.parse(v) }); } catch {}
    fetch(`${API}/suggestions`).then((r) => r.json()).then((d) => setSugg(d.items ?? [])).catch(() => {});
    fetch(`${API}/health`).then((r) => r.json()).then((d) => setHealth({ ok: !!d.ok, documents: d.documents, collections: d.collections })).catch(() => setHealth({ ok: false }));
    fetch(`${API}/quota`, { headers: { "X-Client-Id": clientId() } }).then((r) => r.json()).then((d) => setQuota({ limit: d.limit ?? null, remaining: d.remaining ?? null })).catch(() => {});
  }, []);
  useEffect(() => { try { localStorage.setItem("ask.opts", JSON.stringify(opts)); } catch {} }, [opts]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const patchLast = (f: (m: Msg) => Msg) => setMsgs((m) => [...m.slice(0, -1), f(m[m.length - 1])]);
  const patchAt = (i: number, f: (m: Msg) => Msg) => setMsgs((m) => m.map((x, j) => (j === i ? f(x) : x)));
  const toggleInspector = (next: boolean) => { setInspectorOpen(next); onInspectorChange?.(next); };

  const ask = useCallback(async (q: string) => {
    q = q.trim(); if (!q || busy) return;
    setInput(""); setShowSettings(false);
    const history = msgs.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    const idx = msgs.length + 1;
    setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "", pending: true, live: true, trace: { steps: [] } }]);
    setInspect(idx); setBusy(true);
    try {
      const body: Record<string, unknown> = { question: q, history };
      if (opts.pipeline) body.pipeline = opts.pipeline;
      if (opts.expand != null) body.expand = opts.expand;
      if (opts.rerank != null) body.rerank = opts.rerank;
      const res = await fetch(`${API}/chat`, { method: "POST", headers: { "content-type": "application/json", "X-Client-Id": clientId() }, body: JSON.stringify(body) });
      if (!res.ok || !res.body) {
        let why = `The assistant is unavailable (${res.status}).`;
        if (res.status === 429) { try { why = (await res.json()).detail ?? why; } catch {} if (/used today/i.test(why)) setQuota((q) => ({ ...q, remaining: 0 })); }
        patchLast((m) => ({ ...m, pending: false, live: false, error: why })); return;
      }
      for await (const { event, data } of sse(res)) {
        const d = JSON.parse(data);
        if (event === "step") patchLast((m) => ({ ...m, trace: { ...(m.trace ?? { steps: [] }), steps: [...(m.trace?.steps ?? []), d as Step] } }));
        else if (event === "sources") patchLast((m) => ({ ...m, sources: d as Source[] }));
        else if (event === "token") patchLast((m) => ({ ...m, content: m.content + (d as string), pending: false }));
        else if (event === "trace") patchLast((m) => ({ ...m, trace: { ...(d as Trace), cached: false } }));
        else if (event === "done") { if (d.remaining !== undefined) setQuota((q) => ({ ...q, remaining: d.remaining })); patchLast((m) => ({ ...m, live: false, trace: m.trace ? { ...m.trace, cached: !!d.cached } : m.trace })); }
        else if (event === "error") { if (d.quota) setQuota((q) => ({ ...q, remaining: 0 })); patchLast((m) => ({ ...m, pending: false, live: false, error: d.message })); }
      }
    } catch { patchLast((m) => ({ ...m, pending: false, live: false, error: "Network error — the assistant could not be reached." })); }
    finally { setBusy(false); patchLast((m) => ({ ...m, pending: false, live: false })); }
  }, [busy, msgs, opts]);

  const copy = async (i: number, text: string) => { try { await navigator.clipboard.writeText(text.replace(/\[\d+\]/g, "")); setCopied(i); setTimeout(() => setCopied(null), 1400); } catch {} };

  const inspected = inspect != null ? msgs[inspect] : null;
  const firstSugg = sugg.slice(0, 4);
  const groups = Array.from(new Set(sugg.map((s) => s.group)));

  const chat = (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* header */}
      <div className="flex items-center justify-between border-b border-line/70 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/headshot.jpg" alt="" className="h-full w-full object-cover" />
            <span className={`absolute bottom-0 right-0 h-2 w-2 rounded-full ring-2 ring-surface ${health?.ok ? "bg-accent" : health ? "bg-warn" : "bg-faint"}`} />
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-ink">Aditya Mukhopadhyay</div>
            <div className="font-mono text-[10px] text-faint">
              {health?.ok ? `AI version of me · answers from my ${health.documents ?? "—"} project documents` : health ? "offline right now" : "connecting…"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton label="Pipeline inspector" active={inspectorOpen} onClick={() => toggleInspector(!inspectorOpen)}><Glyph k="inspector" /></IconButton>
          <IconButton label="Retrieval settings" active={showSettings} onClick={() => setShowSettings((v) => !v)}><Glyph k="settings" /></IconButton>
          {extra}
        </div>
      </div>
      {showSettings && <SettingsPopover opts={opts} setOpts={setOpts} onClose={() => setShowSettings(false)} />}

      {/* thread */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 [overflow-wrap:anywhere]">
        {msgs.length === 0 && (
          <div className="rise">
            <p className="max-w-md text-[14px] leading-relaxed text-ink/90">Hi — I&apos;m Aditya. Well, an AI version of me, answering from my own project documents.</p>
            <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted">Ask me how I built something, what went wrong, what a number means, or whether I know a tool. Every answer cites the document it came from, and the inspector shows exactly how it was retrieved.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(moreSugg ? sugg : firstSugg).map((s) => (
                <button key={s.q} type="button" onClick={() => ask(s.q)}
                        className="group flex items-start gap-2.5 rounded-xl border border-line bg-bg px-3.5 py-3 text-left transition-colors hover:border-accent/50 hover:bg-surface">
                  <span className="mt-[3px] text-faint transition-colors group-hover:text-accent"><Glyph k={s.cached ? "bolt" : "spark"} size={12} /></span>
                  <span className="text-[13px] leading-snug text-ink/85 group-hover:text-ink">{s.q}</span>
                </button>))}
            </div>
            {sugg.length > 4 && (
              <button type="button" onClick={() => setMoreSugg((v) => !v)} className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] text-faint hover:text-accent">
                {moreSugg ? "fewer questions" : `${sugg.length - 4} more questions`}<Glyph k="more" size={11} className={moreSugg ? "rotate-180" : ""} />
              </button>)}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`rise ${i ? "mt-5" : ""}`}>
            {m.role === "user" ? (
              <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[14px] leading-relaxed text-accent-ink">{m.content}</div></div>
            ) : (
              <div className="flex gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/headshot.jpg" alt="" className="mt-1 h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-line" />
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line/70 bg-surface px-4 py-3">
                  {m.error ? <p className="text-[13px] text-warn">{m.error}</p>
                    : m.pending && !m.content ? (
                      <div className="flex items-center gap-2 font-mono text-[11.5px] text-faint">
                        <span className="inline-flex gap-0.5"><i className="h-1 w-1 animate-pulse rounded-full bg-accent" /><i className="h-1 w-1 animate-pulse rounded-full bg-accent [animation-delay:150ms]" /><i className="h-1 w-1 animate-pulse rounded-full bg-accent [animation-delay:300ms]" /></span>
                        {m.trace?.steps?.length ? `${m.trace.steps.length} steps · ${m.trace.steps[m.trace.steps.length - 1].name.replace(/_/g, " ")}` : "retrieving"}
                      </div>)
                    : <Answer text={m.content} sources={m.sources} />}
                  {m.showSources && m.sources && m.sources.length > 0 && <SourceCards sources={m.sources} />}
                  {!m.pending && !m.error && (
                    <div className="mt-2.5 -mb-1 -ml-1.5 flex items-center gap-0.5">
                      {m.sources && m.sources.length > 0 && <IconButton label={`${m.sources.length} sources`} active={!!m.showSources} onClick={() => patchAt(i, (x) => ({ ...x, showSources: !x.showSources }))}><Glyph k="sources" size={14} /></IconButton>}
                      {m.trace && <IconButton label={`Inspect · ${m.trace.total_ms != null ? `${(m.trace.total_ms / 1000).toFixed(1)} s` : ""}${m.trace.pipeline ? ` · pipeline ${m.trace.pipeline.toUpperCase()}` : ""}${m.trace.precomputed || m.trace.cached ? " · cached" : ""}`} active={inspect === i && inspectorOpen} onClick={() => { setInspect(i); toggleInspector(true); }}><Glyph k="inspector" size={14} /></IconButton>}
                      <IconButton label={copied === i ? "Copied" : "Copy answer"} onClick={() => copy(i, m.content)}><Glyph k={copied === i ? "check" : "copy"} size={14} /></IconButton>
                      {m.trace?.total_ms != null && <span className="ml-1 font-mono text-[10.5px] text-faint">{(m.trace.total_ms / 1000).toFixed(1)} s{m.trace.precomputed || m.trace.cached ? " · cached" : ""}</span>}
                    </div>)}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="px-4 pb-3 pt-1">
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-bg pl-4 pr-1.5 transition-colors focus-within:border-accent/60">
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} disabled={busy || quota.remaining === 0}
                 placeholder={quota.remaining === 0 ? "Daily limit reached — the suggested questions still work" : "Ask me about my work…"}
                 className="min-w-0 flex-1 bg-transparent py-3 text-[14px] text-ink outline-none placeholder:text-faint" />
          <button type="submit" disabled={busy || !input.trim() || quota.remaining === 0} aria-label="Send" className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-accent-ink transition-opacity disabled:opacity-30"><Glyph k="send" size={14} /></button>
        </div>
        <p className="mt-2 flex items-center justify-center gap-2 text-center font-mono text-[10px] text-faint">
          <span>an AI version of Aditya · retrieval-augmented · cites sources</span>
          {quota.limit != null && quota.remaining != null && <span className="group relative"><span className={quota.remaining === 0 ? "text-warn" : ""}>· {quota.remaining}/{quota.limit} live questions</span>
            <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-56 -translate-x-1/2 rounded-md border border-line bg-bg px-2 py-1.5 text-left normal-case leading-snug text-muted opacity-0 shadow-lg transition-opacity group-hover:opacity-100">Each visitor gets {quota.limit} live questions a day to keep model costs in check. Suggested questions are served from cache and don&apos;t count.</span></span>}
        </p>
      </form>
    </div>
  );

  const inspector = <PipelinePanel trace={inspected?.trace ?? null} live={inspected?.live} onClose={() => toggleInspector(false)} />;

  if (full) {
    return (
      <div className={`grid min-h-0 ${inspectorOpen ? "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "grid-cols-1"}`} style={{ height: "min(78dvh, 900px)" }}>
        <div className="flex min-h-0 flex-col">{chat}</div>
        {inspectorOpen && <div className="hidden min-h-0 border-l border-line/70 bg-bg/40 lg:flex lg:flex-col">{inspector}</div>}
        {inspectorOpen && <div className="min-h-0 border-t border-line/70 lg:hidden" style={{ maxHeight: "40dvh" }}>{inspector}</div>}
      </div>
    );
  }
  return (
    <div className={`grid ${inspectorOpen ? "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-1"}`} style={{ height: "min(74dvh, 640px)" }}>
      <div className="flex min-h-0 flex-col">{chat}</div>
      {inspectorOpen && <div className="hidden min-h-0 border-l border-line/70 bg-bg/40 sm:flex sm:flex-col">{inspector}</div>}
    </div>
  );
}

/* ────────────────────────── floating launcher ────────────────────────── */
export function AskWidget() {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  const [wide, setWide] = useState(false);
  useEffect(() => { setPath(window.location.pathname); }, []);
  if (path.startsWith("/ask")) return null;
  return (
    <>
      {open && (
        <div className={`rise fixed bottom-20 right-4 z-50 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_80px_-20px_rgba(0,0,0,.6)] ${wide ? "w-[min(920px,calc(100vw-2rem))]" : "w-[min(460px,calc(100vw-2rem))]"}`}>
          <AskPanel onInspectorChange={setWide} extra={<>
            <IconButton label="Open full page" onClick={() => { window.location.href = "/ask"; }}><Glyph k="open" size={14} /></IconButton>
            <IconButton label="Close" onClick={() => setOpen(false)}><Glyph k="close" size={13} /></IconButton>
          </>} />
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label={open ? "Close" : "Ask Aditya"}
              className="group fixed bottom-4 right-4 z-50 flex h-12 items-center gap-2 rounded-full bg-accent pl-4 pr-5 text-[13px] font-semibold text-accent-ink shadow-lg transition-transform hover:scale-[1.03]">
        <Glyph k={open ? "close" : "spark"} size={15} />{open ? "Close" : "Ask me"}
      </button>
    </>
  );
}
