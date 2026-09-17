"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PipelinePanel, type Step, type Trace } from "./PipelinePanel";

// The RAG backend on Railway. Override with NEXT_PUBLIC_RAG_API_URL at build time.
export const API = process.env.NEXT_PUBLIC_RAG_API_URL ?? "https://rag-api-production-5a59.up.railway.app";

type Source = { n: number; title: string; heading: string; page_url: string | null; doc_url: string | null; snippet: string; text?: string };
type Msg = { role: "user" | "assistant"; content: string; sources?: Source[]; error?: string; pending?: boolean; trace?: Trace | null; live?: boolean };
type Suggestion = { q: string; group: string; cached: boolean };
type Opts = { pipeline: "a" | "b" | ""; expand: boolean | null; rerank: boolean | null; verbose: boolean };

/** Parse an SSE body incrementally: yields {event, data} pairs. */
async function* sse(res: Response) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const parse = (block: string) => {
    let event = "message", data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    return data ? { event, data } : null;
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    // sse-starlette emits CRLF line endings; normalise before splitting on blank lines
    buf += dec.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const ev = parse(buf.slice(0, idx)); buf = buf.slice(idx + 2);
      if (ev) yield ev;
    }
  }
  const tail = parse(buf.replace(/\r\n/g, "\n"));
  if (tail) yield tail;
}

/** Inline: **bold**, `code`, and [n] citation chips. */
function Inline({ text, sources }: { text: string; sources?: Source[] }) {
  const parts = text.split(/(\[\d+\](?:\[\d+\])*|\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
        if (/^`[^`]+`$/.test(p)) return <code key={i} className="rounded bg-surface-2 px-1 font-mono text-[12px]">{p.slice(1, -1)}</code>;
        if (!/^\[\d+\]/.test(p)) return <span key={i}>{p}</span>;
        const ns = [...p.matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1]));
        return ns.map((n, j) => {
          const s = sources?.find((x) => x.n === n);
          const href = s?.page_url ?? s?.doc_url ?? undefined;
          const chip = <sup key={`${i}-${j}`} className="mx-[1px] inline-block rounded-md bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] text-accent align-baseline" title={s ? `${s.title} › ${s.heading}` : undefined}>{n}</sup>;
          return href ? <a key={`${i}-${j}`} href={href} target="_blank" rel="noreferrer">{chip}</a> : chip;
        });
      })}
    </>
  );
}

/** Block-level: paragraphs and bullet lists (the answer prompt allows compact lists). */
function Answer({ text, sources }: { text: string; sources?: Source[] }) {
  const blocks: { kind: "p" | "ul"; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (m) {
      if (blocks.length && blocks[blocks.length - 1].kind === "ul") blocks[blocks.length - 1].lines.push(m[1]);
      else blocks.push({ kind: "ul", lines: [m[1]] });
    } else if (line.trim() === "") {
      if (blocks.length && blocks[blocks.length - 1].kind === "p" && blocks[blocks.length - 1].lines.length) blocks.push({ kind: "p", lines: [] });
    } else {
      if (blocks.length && blocks[blocks.length - 1].kind === "p") blocks[blocks.length - 1].lines.push(line);
      else blocks.push({ kind: "p", lines: [line] });
    }
  }
  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.filter((b) => b.lines.length).map((b, i) =>
        b.kind === "ul"
          ? <ul key={i} className="list-disc space-y-1 pl-5">{b.lines.map((l, j) => <li key={j}><Inline text={l} sources={sources} /></li>)}</ul>
          : <p key={i}><Inline text={b.lines.join(" ")} sources={sources} /></p>)}
    </div>
  );
}

function Sources({ sources }: { sources: Source[] }) {
  const [openN, setOpenN] = useState<number | null>(null);
  return (
    <div className="mt-2.5 border-t border-line pt-2">
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <button key={s.n} onClick={() => setOpenN(openN === s.n ? null : s.n)} title={s.heading}
                  className={`rounded-md px-2 py-1 font-mono text-[10.5px] ${openN === s.n ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted hover:text-accent"}`}>
            <span className="text-accent">[{s.n}]</span> {s.title}
          </button>
        ))}
      </div>
      {openN != null && (() => { const s = sources.find((x) => x.n === openN)!; return (
        <div className="mt-2 rounded-lg border border-line bg-bg p-2.5 text-[12px]">
          <div className="mb-1 text-faint">{s.heading}</div>
          <div className="whitespace-pre-wrap text-muted">{s.text ?? s.snippet}</div>
          <div className="mt-1.5 flex gap-3 font-mono text-[11px]">
            {s.page_url && <a className="text-accent" href={s.page_url} target="_blank" rel="noreferrer">project page ↗</a>}
            {s.doc_url && <a className="text-accent" href={s.doc_url} target="_blank" rel="noreferrer">source document ↗</a>}
          </div>
        </div>); })()}
    </div>
  );
}

const DEFAULT_OPTS: Opts = { pipeline: "", expand: null, rerank: null, verbose: true };

export function AskPanel({ full = false }: { full?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState<Suggestion[]>([]);
  const [opts, setOpts] = useState<Opts>(DEFAULT_OPTS);
  const [inspect, setInspect] = useState<number | null>(null);   // index of the assistant message shown in the inspector
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const v = localStorage.getItem("ask.opts"); if (v) setOpts({ ...DEFAULT_OPTS, ...JSON.parse(v) }); } catch {}
    fetch(`${API}/suggestions`).then((r) => r.json()).then((d) => setSugg(d.items ?? [])).catch(() => {});
  }, []);
  useEffect(() => { try { localStorage.setItem("ask.opts", JSON.stringify(opts)); } catch {} }, [opts]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const patchLast = (f: (m: Msg) => Msg) => setMsgs((m) => [...m.slice(0, -1), f(m[m.length - 1])]);

  const ask = useCallback(async (q: string) => {
    q = q.trim();
    if (!q || busy) return;
    setInput("");
    const history = msgs.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    const idx = msgs.length + 1;
    setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "", pending: true, live: true, trace: { steps: [] } }]);
    setInspect(idx);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { question: q, history };
      if (opts.pipeline) body.pipeline = opts.pipeline;
      if (opts.expand != null) body.expand = opts.expand;
      if (opts.rerank != null) body.rerank = opts.rerank;
      const res = await fetch(`${API}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok || !res.body) {
        const why = res.status === 429 ? "Too many questions for now — try again in a minute." : `The assistant is unavailable (${res.status}).`;
        patchLast((m) => ({ ...m, pending: false, live: false, error: why }));
        return;
      }
      for await (const { event, data } of sse(res)) {
        const d = JSON.parse(data);
        if (event === "step") patchLast((m) => ({ ...m, trace: { ...(m.trace ?? { steps: [] }), steps: [...(m.trace?.steps ?? []), d as Step] } }));
        else if (event === "sources") patchLast((m) => ({ ...m, sources: d as Source[] }));
        else if (event === "token") patchLast((m) => ({ ...m, content: m.content + (d as string), pending: false }));
        else if (event === "trace") patchLast((m) => ({ ...m, trace: { ...(d as Trace), cached: false } }));
        else if (event === "done") patchLast((m) => ({ ...m, live: false, trace: m.trace ? { ...m.trace, cached: !!d.cached } : m.trace }));
        else if (event === "error") patchLast((m) => ({ ...m, pending: false, live: false, error: d.message }));
      }
    } catch {
      patchLast((m) => ({ ...m, pending: false, live: false, error: "Network error — the assistant could not be reached." }));
    } finally {
      setBusy(false);
      patchLast((m) => ({ ...m, pending: false, live: false }));
    }
  }, [busy, msgs, opts]);

  const inspected = inspect != null ? msgs[inspect] : null;
  const groups = Array.from(new Set(sugg.map((s) => s.group)));

  const chat = (
    <div className={`flex min-h-0 flex-1 flex-col ${full ? "" : "h-[min(72dvh,600px)]"}`}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-3 py-2 font-mono text-[11px] text-muted">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={opts.verbose} onChange={(e) => setOpts({ ...opts, verbose: e.target.checked })} className="accent-[var(--accent)]" /> verbose pipeline</label>
        <label className="flex items-center gap-1">pipeline
          <select value={opts.pipeline} onChange={(e) => setOpts({ ...opts, pipeline: e.target.value as Opts["pipeline"] })} className="rounded border border-line bg-bg px-1 py-0.5 text-ink">
            <option value="">server default</option><option value="a">A · sections</option><option value="b">B · propositions</option></select></label>
        <label className="flex items-center gap-1">expansion
          <select value={opts.expand == null ? "" : String(opts.expand)} onChange={(e) => setOpts({ ...opts, expand: e.target.value === "" ? null : e.target.value === "true" })} className="rounded border border-line bg-bg px-1 py-0.5 text-ink">
            <option value="">default</option><option value="true">on</option><option value="false">off</option></select></label>
        <label className="flex items-center gap-1">rerank
          <select value={opts.rerank == null ? "" : String(opts.rerank)} onChange={(e) => setOpts({ ...opts, rerank: e.target.value === "" ? null : e.target.value === "true" })} className="rounded border border-line bg-bg px-1 py-0.5 text-ink">
            <option value="">default</option><option value="true">on</option><option value="false">off</option></select></label>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-[14px]">
        {msgs.length === 0 && (
          <div className="space-y-3">
            <p className="text-muted">Ask anything about Aditya&apos;s work. Every answer cites its source, and with <em>verbose pipeline</em> on you can watch the retrieval run: the expanded queries, the dense and sparse top-K, the fusion, the reranker&apos;s reordering and its reasons, and every model call with its latency.</p>
            {groups.map((g) => (
              <div key={g}>
                <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">{g}</div>
                <div className="flex flex-wrap gap-1.5">
                  {sugg.filter((s) => s.group === g).map((s) => (
                    <button key={s.q} onClick={() => ask(s.q)} title={s.cached ? "pre-computed — instant, with its full trace" : undefined}
                            className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-[12px] text-ink transition-colors hover:border-accent hover:text-accent">
                      {s.q}{s.cached && <span className="ml-1 text-accent" aria-hidden>⚡</span>}
                    </button>))}
                </div>
              </div>))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 text-accent-ink"
                                              : "max-w-[94%] rounded-2xl rounded-bl-sm border border-line bg-surface px-3.5 py-2.5 text-ink"}>
              {m.role === "user" ? m.content : m.error ? <span className="text-warn">{m.error}</span>
                : m.pending && !m.content ? <span className="font-mono text-[12px] text-faint">{m.trace?.steps?.length ? `${m.trace.steps[m.trace.steps.length - 1].name}…` : "searching Aditya's documents…"}</span>
                : <Answer text={m.content} sources={m.sources} />}
              {m.role === "assistant" && m.sources && m.sources.length > 0 && !m.pending && <Sources sources={m.sources} />}
              {m.role === "assistant" && opts.verbose && m.trace && (
                <div className="mt-2 flex items-center gap-3 font-mono text-[11px]">
                  <button onClick={() => setInspect(inspect === i && full ? null : i)} className={`${inspect === i ? "text-accent" : "text-muted hover:text-accent"}`}>
                    {inspect === i ? "● pipeline shown" : "show pipeline"}
                  </button>
                  {m.trace.total_ms != null && <span className="text-faint">{Math.round(m.trace.total_ms)} ms · {m.trace.steps.length} steps</span>}
                </div>
              )}
              {m.role === "assistant" && opts.verbose && !full && inspect === i && (
                <div className="mt-2 max-h-[50dvh] overflow-y-auto rounded-xl border border-line bg-bg"><PipelinePanel trace={m.trace ?? null} live={m.live} /></div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 border-t border-line p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} disabled={busy} placeholder="Ask about a project, a decision, a number…"
               className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-accent" />
        <button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-accent-ink disabled:opacity-40">{busy ? "…" : "Ask"}</button>
      </form>
    </div>
  );

  if (!full) return chat;
  return (
    <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" style={{ height: "min(80dvh, 960px)" }}>
      <div className="flex min-h-0 flex-col lg:border-r lg:border-line">{chat}</div>
      {opts.verbose && (
        <div className="hidden min-h-0 flex-col lg:flex">
          <div className="border-b border-line px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Pipeline inspector</div>
          <div className="min-h-0 flex-1 overflow-y-auto"><PipelinePanel trace={inspected?.trace ?? null} live={inspected?.live} /></div>
        </div>
      )}
    </div>
  );
}

/** Floating launcher, mounted once in the root layout. Hidden on the /ask page. */
export function AskWidget() {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  useEffect(() => { setPath(window.location.pathname); }, []);
  if (path.startsWith("/ask")) return null;
  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-bg shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Ask about Aditya</span>
            <div className="flex items-center gap-3">
              <a href="/ask" className="font-mono text-[11px] text-muted hover:text-accent">full view with inspector ↗</a>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-ink">✕</button>
            </div>
          </div>
          <AskPanel />
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label="Ask about Aditya"
              className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-[13px] font-semibold text-accent-ink shadow-lg transition-transform hover:scale-[1.03]">
        <span aria-hidden>✦</span> Ask
      </button>
    </>
  );
}
