"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PipelinePanel, GlyphButton, type Step, type Trace } from "./PipelinePanel";

// The RAG backend on Railway. Override with NEXT_PUBLIC_RAG_API_URL at build time.
export const API = process.env.NEXT_PUBLIC_RAG_API_URL ?? "https://rag-api-production-5a59.up.railway.app";

type Source = { n: number; title: string; heading: string; page_url: string | null; doc_url: string | null; snippet: string; text?: string };
type Msg = { role: "user" | "assistant"; content: string; sources?: Source[]; error?: string; pending?: boolean; trace?: Trace | null; live?: boolean };
type Suggestion = { q: string; group: string; cached: boolean };
type Opts = { pipeline: "a" | "b" | ""; expand: boolean | null; rerank: boolean | null };
const DEFAULT_OPTS: Opts = { pipeline: "", expand: null, rerank: null };

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

/* ---------- answer rendering: paragraphs, bullets, **bold**, `code`, [n] citations ---------- */
function Inline({ text, sources }: { text: string; sources?: Source[] }) {
  const parts = text.split(/(\[\d+\](?:\[\d+\])*|\*\*[^*]+\*\*|`[^`]+`)/g);
  return <>{parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="rounded bg-surface-2 px-1 font-mono text-[12px]">{p.slice(1, -1)}</code>;
    if (!/^\[\d+\]/.test(p)) return <span key={i}>{p}</span>;
    return [...p.matchAll(/\[(\d+)\]/g)].map((x, j) => {
      const n = Number(x[1]); const s = sources?.find((y) => y.n === n); const href = s?.page_url ?? s?.doc_url ?? undefined;
      const sup = <sup key={`${i}-${j}`} className="ml-[1px] font-mono text-[10px] text-accent" title={s ? `${s.title} · ${s.heading}` : undefined}>{n}</sup>;
      return href ? <a key={`${i}-${j}`} href={href} target="_blank" rel="noreferrer">{sup}</a> : sup;
    });
  })}</>;
}
function Answer({ text, sources }: { text: string; sources?: Source[] }) {
  const blocks: { kind: "p" | "ul"; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd(); const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (m) { const last = blocks[blocks.length - 1]; if (last?.kind === "ul") last.lines.push(m[1]); else blocks.push({ kind: "ul", lines: [m[1]] }); }
    else if (!line.trim()) { if (blocks[blocks.length - 1]?.lines.length) blocks.push({ kind: "p", lines: [] }); }
    else { const last = blocks[blocks.length - 1]; if (last?.kind === "p") last.lines.push(line); else blocks.push({ kind: "p", lines: [line] }); }
  }
  return <div className="space-y-2.5 text-[14px] leading-[1.65] text-ink">{blocks.filter((b) => b.lines.length).map((b, i) =>
    b.kind === "ul" ? <ul key={i} className="list-disc space-y-1 pl-5">{b.lines.map((l, j) => <li key={j}><Inline text={l} sources={sources} /></li>)}</ul>
                    : <p key={i}><Inline text={b.lines.join(" ")} sources={sources} /></p>)}</div>;
}

function SourcesLine({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="mt-2 text-[11.5px]">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-faint">
        <span>Sources</span>
        {sources.map((s) => <button key={s.n} onClick={() => setOpen(open === s.n ? null : s.n)} className={`hover:text-accent ${open === s.n ? "text-accent" : "text-muted"}`}><span className="font-mono">{s.n}</span> {s.title}</button>)}
      </div>
      {open != null && (() => { const s = sources.find((x) => x.n === open)!; return (
        <div className="mt-1.5 rounded-lg bg-surface-2/60 p-2.5 text-[12px] text-muted">
          <div className="mb-1 text-faint">{s.heading}</div>
          <div className="line-clamp-6 whitespace-pre-wrap">{s.text ?? s.snippet}</div>
          <div className="mt-1.5 flex gap-3 font-mono text-[11px]">{s.page_url && <a className="text-accent" href={s.page_url} target="_blank" rel="noreferrer">project page ↗</a>}{s.doc_url && <a className="text-accent" href={s.doc_url} target="_blank" rel="noreferrer">document ↗</a>}</div>
        </div>); })()}
    </div>
  );
}

function Settings({ opts, setOpts }: { opts: Opts; setOpts: (o: Opts) => void }) {
  const Sel = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) => (
    <label className="flex items-center justify-between gap-3 py-1"><span className="text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded border border-line bg-bg px-1.5 py-0.5 text-ink">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>);
  return (
    <div className="absolute right-3 top-10 z-10 w-56 rounded-xl border border-line bg-bg p-3 font-mono text-[11px] shadow-xl">
      <Sel label="pipeline" value={opts.pipeline} onChange={(v) => setOpts({ ...opts, pipeline: v as Opts["pipeline"] })} options={[["", "server default"], ["a", "A · sections"], ["b", "B · propositions"]]} />
      <Sel label="expansion" value={opts.expand == null ? "" : String(opts.expand)} onChange={(v) => setOpts({ ...opts, expand: v === "" ? null : v === "true" })} options={[["", "default"], ["true", "on"], ["false", "off"]]} />
      <Sel label="rerank" value={opts.rerank == null ? "" : String(opts.rerank)} onChange={(v) => setOpts({ ...opts, rerank: v === "" ? null : v === "true" })} options={[["", "default"], ["true", "on"], ["false", "off"]]} />
    </div>
  );
}

/* ---------- the panel (used by the widget and the /ask page) ---------- */
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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const v = localStorage.getItem("ask.opts"); if (v) setOpts({ ...DEFAULT_OPTS, ...JSON.parse(v) }); } catch {}
    fetch(`${API}/suggestions`).then((r) => r.json()).then((d) => setSugg(d.items ?? [])).catch(() => {});
  }, []);
  useEffect(() => { try { localStorage.setItem("ask.opts", JSON.stringify(opts)); } catch {} }, [opts]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const patchLast = (f: (m: Msg) => Msg) => setMsgs((m) => [...m.slice(0, -1), f(m[m.length - 1])]);

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
      const res = await fetch(`${API}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok || !res.body) { patchLast((m) => ({ ...m, pending: false, live: false, error: res.status === 429 ? "Too many questions for now — try again in a minute." : `The assistant is unavailable (${res.status}).` })); return; }
      for await (const { event, data } of sse(res)) {
        const d = JSON.parse(data);
        if (event === "step") patchLast((m) => ({ ...m, trace: { ...(m.trace ?? { steps: [] }), steps: [...(m.trace?.steps ?? []), d as Step] } }));
        else if (event === "sources") patchLast((m) => ({ ...m, sources: d as Source[] }));
        else if (event === "token") patchLast((m) => ({ ...m, content: m.content + (d as string), pending: false }));
        else if (event === "trace") patchLast((m) => ({ ...m, trace: { ...(d as Trace), cached: false } }));
        else if (event === "done") patchLast((m) => ({ ...m, live: false, trace: m.trace ? { ...m.trace, cached: !!d.cached } : m.trace }));
        else if (event === "error") patchLast((m) => ({ ...m, pending: false, live: false, error: d.message }));
      }
    } catch { patchLast((m) => ({ ...m, pending: false, live: false, error: "Network error — the assistant could not be reached." })); }
    finally { setBusy(false); patchLast((m) => ({ ...m, pending: false, live: false })); }
  }, [busy, msgs, opts]);

  const inspected = inspect != null ? msgs[inspect] : null;
  const firstSugg = sugg.slice(0, 4);
  const groups = Array.from(new Set(sugg.map((s) => s.group)));

  const chat = (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* header: title + two glyphs, nothing else */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Ask about Aditya</span>
        <div className="flex items-center gap-0.5">
          <GlyphButton label="Pipeline inspector" active={inspectorOpen} onClick={() => { setInspectorOpen((v) => { onInspectorChange?.(!v); return !v; }); }}>
            <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M2 12h12M3 9l3-3 3 3 4-5" /></svg>
          </GlyphButton>
          <GlyphButton label="Settings" active={showSettings} onClick={() => setShowSettings((v) => !v)}>
            <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M2 5h12M2 11h12" /><circle cx="6" cy="5" r="1.6" fill="var(--bg)" /><circle cx="10" cy="11" r="1.6" fill="var(--bg)" /></svg>
          </GlyphButton>
          {extra}
        </div>
      </div>
      {showSettings && <Settings opts={opts} setOpts={setOpts} />}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        {msgs.length === 0 && (
          <div className="pt-2">
            <p className="text-[14px] leading-relaxed text-muted">Grounded in Aditya&apos;s project documents. Every answer cites where it came from.</p>
            <div className="mt-4 flex flex-col items-start gap-1.5">
              {(moreSugg ? [] : firstSugg).map((s) => <button key={s.q} onClick={() => ask(s.q)} className="text-left text-[13px] text-ink/80 hover:text-accent">{s.q}</button>)}
              {moreSugg && groups.map((g) => (
                <div key={g} className="mt-2 w-full">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{g}</div>
                  <div className="flex flex-col items-start gap-1.5">{sugg.filter((s) => s.group === g).map((s) => <button key={s.q} onClick={() => ask(s.q)} className="text-left text-[13px] text-ink/80 hover:text-accent">{s.q}</button>)}</div>
                </div>))}
              {sugg.length > 4 && <button onClick={() => setMoreSugg((v) => !v)} className="mt-1 font-mono text-[11px] text-faint hover:text-accent">{moreSugg ? "fewer" : "more questions"}</button>}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className="mt-5 first:mt-2">
            {m.role === "user" ? (
              <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-surface-2 px-3.5 py-2 text-[14px] text-ink">{m.content}</div></div>
            ) : (
              <div className="pr-2">
                {m.error ? <p className="text-[13px] text-warn">{m.error}</p>
                  : m.pending && !m.content ? <p className="font-mono text-[11.5px] text-faint">{m.trace?.steps?.length ? "thinking…" : "retrieving…"}</p>
                  : <Answer text={m.content} sources={m.sources} />}
                {m.sources && m.sources.length > 0 && !m.pending && <SourcesLine sources={m.sources} />}
                {m.trace && !m.pending && (
                  <button onClick={() => { setInspect(i); setInspectorOpen(true); }} className={`mt-1.5 font-mono text-[10.5px] ${inspect === i && inspectorOpen ? "text-accent" : "text-faint hover:text-accent"}`}>
                    {m.trace.total_ms != null ? `${(m.trace.total_ms / 1000).toFixed(1)} s` : ""}{m.trace.pipeline ? ` · pipeline ${m.trace.pipeline.toUpperCase()}` : ""}{m.trace.steps.length ? ` · ${m.trace.steps.length} steps` : ""}{m.trace.precomputed || m.trace.cached ? " · cached" : ""} · inspect
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 px-4 pb-4 pt-1">
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} disabled={busy} placeholder="Ask about a project, a decision, a number…"
               className="min-w-0 flex-1 rounded-full border border-line bg-bg px-4 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-accent" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-40">
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 13V3M4 7l4-4 4 4" /></svg>
        </button>
      </form>
    </div>
  );

  const inspector = <PipelinePanel trace={inspected?.trace ?? null} live={inspected?.live} onClose={() => setInspectorOpen(false)} />;

  if (full) {
    return (
      <div className={`grid min-h-0 ${inspectorOpen ? "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "grid-cols-1"}`} style={{ height: "min(78dvh, 900px)" }}>
        <div className="flex min-h-0 flex-col">{chat}</div>
        {inspectorOpen && <div className="hidden min-h-0 border-l border-line lg:flex lg:flex-col">{inspector}</div>}
        {inspectorOpen && <div className="min-h-0 border-t border-line lg:hidden" style={{ maxHeight: "40dvh" }}>{inspector}</div>}
      </div>
    );
  }
  return (
    <div className={`grid ${inspectorOpen ? "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-1"}`} style={{ height: "min(72dvh, 620px)" }}>
      <div className="flex min-h-0 flex-col">{chat}</div>
      {inspectorOpen && <div className="hidden min-h-0 border-l border-line sm:flex sm:flex-col">{inspector}</div>}
    </div>
  );
}

/* ---------- floating launcher (root layout); hidden on /ask ---------- */
export function AskWidget() {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  const [wide, setWide] = useState(false);
  useEffect(() => { setPath(window.location.pathname); }, []);
  if (path.startsWith("/ask")) return null;
  return (
    <>
      {open && (
        <div className={`fixed bottom-20 right-4 z-50 overflow-hidden rounded-2xl border border-line bg-bg shadow-2xl ${wide ? "w-[min(880px,calc(100vw-2rem))]" : "w-[min(440px,calc(100vw-2rem))]"}`}>
          <AskPanel onInspectorChange={setWide} extra={
            <span className="ml-1 flex items-center gap-2 font-mono text-[10.5px]">
              <a href="/ask" className="text-faint hover:text-accent">open ↗</a>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-faint hover:text-ink">✕</button>
            </span>} />
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label="Ask about Aditya"
              className="fixed bottom-4 right-4 z-50 grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-ink shadow-lg transition-transform hover:scale-[1.04]">
        <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h10v8H7l-3 2.5V11H3z" /></svg>
      </button>
    </>
  );
}
