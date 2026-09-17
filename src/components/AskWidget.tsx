"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The RAG backend on Railway. Override with NEXT_PUBLIC_RAG_API_URL at build time.
const API = process.env.NEXT_PUBLIC_RAG_API_URL ?? "https://portfolio-rag-api.up.railway.app";

type Source = { n: number; title: string; heading: string; page_url: string | null; doc_url: string | null; snippet: string };
type Msg = { role: "user" | "assistant"; content: string; sources?: Source[]; error?: string; pending?: boolean };

const SUGGESTIONS = [
  "How does the WhatsApp agent avoid lying about orders?",
  "What is the Buyer MCP and how is it authenticated?",
  "Explain the delivery fleet's concurrency model.",
  "What was the updated_at incident and what rule came out of it?",
];

/** Parse an SSE body incrementally: yields {event, data} pairs. */
async function* sse(res: Response) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, idx); buf = buf.slice(idx + 2);
      let event = "message", data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) yield { event, data };
    }
  }
}

/** Render [n] markers as small citation chips. */
function Answer({ text, sources }: { text: string; sources?: Source[] }) {
  const parts = text.split(/(\[\d+\](?:\[\d+\])*)/g);
  return (
    <div className="whitespace-pre-wrap leading-relaxed">
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d+)\]/);
        if (!m) return <span key={i}>{p}</span>;
        const ns = [...p.matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1]));
        return ns.map((n, j) => {
          const s = sources?.find((x) => x.n === n);
          const href = s?.page_url ?? s?.doc_url ?? undefined;
          const chip = (
            <sup key={`${i}-${j}`} className="mx-[1px] inline-block rounded-md bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] text-accent no-underline align-baseline"
                 title={s ? `${s.title} › ${s.heading}` : undefined}>
              {n}
            </sup>
          );
          return href ? <a key={`${i}-${j}`} href={href} target="_blank" rel="noreferrer">{chip}</a> : chip;
        });
      })}
    </div>
  );
}

export function AskPanel({ full = false }: { full?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const ask = useCallback(async (q: string) => {
    q = q.trim();
    if (!q || busy) return;
    setInput("");
    const history = msgs.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "", pending: true }]);
    setBusy(true);
    const ac = new AbortController(); abortRef.current = ac;
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, history }), signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const why = res.status === 429 ? "Too many questions for now — try again in a minute." : `The assistant is unavailable (${res.status}).`;
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: "", error: why }]);
        return;
      }
      for await (const { event, data } of sse(res)) {
        if (event === "sources") {
          const sources = JSON.parse(data) as Source[];
          setMsgs((m) => [...m.slice(0, -1), { ...m[m.length - 1], sources }]);
        } else if (event === "token") {
          const tok = JSON.parse(data) as string;
          setMsgs((m) => [...m.slice(0, -1), { ...m[m.length - 1], content: m[m.length - 1].content + tok, pending: false }]);
        } else if (event === "error") {
          setMsgs((m) => [...m.slice(0, -1), { ...m[m.length - 1], pending: false, error: JSON.parse(data).message }]);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: "", error: "Network error — the assistant could not be reached." }]);
    } finally {
      setBusy(false);
      setMsgs((m) => m.map((x) => ({ ...x, pending: false })));
    }
  }, [busy, msgs]);

  return (
    <div className={`flex flex-col ${full ? "h-[min(78dvh,900px)]" : "h-[min(70dvh,560px)]"}`}>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-[14px]">
        {msgs.length === 0 && (
          <div className="space-y-3">
            <p className="text-muted">Ask anything about Aditya&apos;s work — how a system was built, what failed, what it measured. Answers cite the source document.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)}
                        className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-[12px] text-ink transition-colors hover:border-accent hover:text-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user"
              ? "max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 text-accent-ink"
              : "max-w-[92%] rounded-2xl rounded-bl-sm border border-line bg-surface px-3.5 py-2.5 text-ink"}>
              {m.role === "user" ? m.content : m.error ? <span className="text-warn">{m.error}</span>
                : m.pending && !m.content ? <span className="font-mono text-[12px] text-faint">searching Aditya&apos;s documents…</span>
                : <Answer text={m.content} sources={m.sources} />}
              {m.role === "assistant" && m.sources && m.sources.length > 0 && !m.pending && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2">
                  {m.sources.map((s) => {
                    const href = s.page_url ?? s.doc_url ?? undefined;
                    const label = <span className="font-mono text-[10.5px]"><span className="text-accent">[{s.n}]</span> {s.title}</span>;
                    return href
                      ? <a key={s.n} href={href} target="_blank" rel="noreferrer" title={s.heading} className="rounded-md bg-surface-2 px-2 py-1 text-muted hover:text-accent">{label}</a>
                      : <span key={s.n} title={s.heading} className="rounded-md bg-surface-2 px-2 py-1 text-muted">{label}</span>;
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 border-t border-line p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} disabled={busy}
               placeholder="Ask about a project, a decision, a number…"
               className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-accent" />
        <button type="submit" disabled={busy || !input.trim()}
                className="rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-accent-ink disabled:opacity-40">
          {busy ? "…" : "Ask"}
        </button>
      </form>
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
        <div className="fixed bottom-20 right-4 z-50 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-bg shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Ask about Aditya</span>
            <div className="flex items-center gap-3">
              <a href="/ask" className="font-mono text-[11px] text-muted hover:text-accent">open full ↗</a>
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
