"use client";

import { useState, type ReactNode } from "react";

export type Step = { name: string; ms: number; at_ms: number; data: Record<string, unknown>; pending?: boolean };
export type Call = { kind: string; model: string; ms: number; detail: Record<string, unknown> };
export type Trace = { total_ms?: number; steps: Step[]; calls?: Call[]; pipeline?: string; queries?: string[]; question?: string; precomputed?: boolean; cached?: boolean };

type Hit = { rank: number; score: number; sid: string; doc: string; title: string; heading: string; snippet: string; words: number; ranks?: Record<string, number> };

/* ---------- minimal line icons (16px, currentColor) ---------- */
const I = {
  shield: <path d="M8 1.5 13 3.5v4c0 3-2.2 5.3-5 6.5-2.8-1.2-5-3.5-5-6.5v-4z" />,
  cache: <><rect x="2" y="3" width="12" height="10" rx="2" /><path d="M2 7h12" /></>,
  expand: <path d="M3 8h10M8 3v10" />,
  vector: <><circle cx="4" cy="12" r="1.2" /><circle cx="12" cy="4" r="1.2" /><circle cx="11" cy="11" r="1.2" /><path d="M4 12 12 4" /></>,
  dense: <><circle cx="7" cy="7" r="4" /><path d="M10 10l3.5 3.5" /></>,
  sparse: <path d="M5 2v12M11 2v12M2 6h12M2 10h12" />,
  fuse: <path d="M2 4h5l2 8h5M2 12h5l2-8h5" />,
  group: <><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="5.5" y="9" width="5" height="5" rx="1" /></>,
  fetch: <><path d="M4 2h6l3 3v9H4z" /><path d="M10 2v3h3" /></>,
  rerank: <path d="M4 3v10M4 13l-2-2M4 13l2-2M12 13V3M12 3l-2 2M12 3l2 2" />,
  prompt: <><path d="M3 3h10v10H3z" /><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" /></>,
  generate: <path d="M8 2l1.2 3.3L12.5 6.5 9.2 7.8 8 11 6.8 7.8 3.5 6.5l3.3-1.2z" />,
  rewrite: <path d="M3 13l1-3.5L11 2.5l2.5 2.5L6.5 12z" />,
  persona: <><circle cx="8" cy="5.5" r="2.5" /><path d="M3 14c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" /></>,
  dot: <circle cx="8" cy="8" r="2" />,
};
function Icon({ k, className = "" }: { k: keyof typeof I; className?: string }) {
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{I[k]}</svg>;
}
const ICON: Record<string, keyof typeof I> = {
  guard: "shield", followup_rewrite: "rewrite", persona_rewrite: "persona", cache: "cache", query_expansion: "expand", embed_query: "vector", dense_search: "dense",
  sparse_search: "sparse", rrf_fusion: "fuse", multi_query_fusion: "fuse", group_by_parent: "group", fetch_parents: "fetch",
  rerank: "rerank", build_prompt: "prompt", generate: "generate",
};
const LABEL: Record<string, string> = {
  guard: "Guard", followup_rewrite: "Rewrite follow-up", persona_rewrite: "You → Aditya", cache: "Cache", query_expansion: "Expand query", embed_query: "Embed",
  dense_search: "Dense search", sparse_search: "Sparse search", rrf_fusion: "Fuse (RRF)", multi_query_fusion: "Fuse queries",
  group_by_parent: "Group by section", fetch_parents: "Fetch sections", rerank: "Rerank", build_prompt: "Prompt", generate: "Generate",
};
const DESC: Record<string, string> = {
  guard: "Normalise, cap length, flag injection and PII patterns.",
  followup_rewrite: "The question referenced earlier turns; the light model rewrote it to stand alone.",
  persona_rewrite: "Visitors say \"you\"; the documents say \"Aditya\". A deterministic rewrite for the search query only — the answer still sees the original wording.",
  cache: "Answers are cached on the normalised question. Pre-drafted questions are pinned with their trace.",
  query_expansion: "Two alternative phrasings from the light model; each is searched, results are fused.",
  embed_query: "Gemini embedding, RETRIEVAL_QUERY, 768-d, unit-normalised.",
  dense_search: "Nearest neighbours by dot product in Qdrant.",
  sparse_search: "BM25-style sparse vectors, IDF applied in Qdrant — exact technical tokens.",
  rrf_fusion: "Reciprocal-rank fusion of the dense and sparse lists, k = 60.",
  multi_query_fusion: "RRF across the per-query lists.",
  group_by_parent: "Proposition hits grouped by parent section; score = sum of its top-3 propositions.",
  fetch_parents: "The parent section is what the answerer reads.",
  rerank: "One listwise call returns an order and a one-line reason per passage.",
  build_prompt: "Passages numbered [1..n], framed as data; the answer must cite them.",
  generate: "Streamed generation; first token = time to the first chunk.",
};

const ms = (x?: number) => (x == null ? "" : x < 1 ? "<1 ms" : x < 1000 ? `${Math.round(x)} ms` : `${(x / 1000).toFixed(2)} s`);

/* ---------- small building blocks ---------- */
function Meta({ items }: { items: Record<string, unknown> }) {
  const e = Object.entries(items).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!e.length) return null;
  return <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">{e.map(([k, v]) => <span key={k}><span className="text-faint">{k}</span> {String(v)}</span>)}</div>;
}

function More({ n, total, onMore }: { n: number; total: number; onMore: () => void }) {
  return total > n ? <button onClick={onMore} className="mt-1 text-[11px] text-faint hover:text-accent">show all {total}</button> : null;
}

function Hits({ hits, ranks }: { hits: Hit[]; ranks?: boolean }) {
  const [all, setAll] = useState(false);
  const shown = all ? hits : hits.slice(0, 5);
  return (
    <div>
      <ol className="space-y-1.5">
        {shown.map((h) => (
          <li key={h.sid + h.rank} className="grid grid-cols-[1.6rem_1fr] gap-x-1 text-[11.5px]">
            <span className="font-mono text-faint">{h.rank}</span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-ink">{h.title}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-faint">{h.score.toFixed(4)}{ranks && h.ranks ? ` · d${h.ranks["0"] ?? "–"} s${h.ranks["1"] ?? "–"}` : ""}</span>
              </div>
              <div className="truncate text-faint">{h.heading?.split(" › ").slice(1).join(" › ")}</div>
              <div className="line-clamp-2 text-muted">{h.snippet}</div>
            </div>
          </li>
        ))}
      </ol>
      <More n={shown.length} total={hits.length} onMore={() => setAll(true)} />
    </div>
  );
}

function Body({ s }: { s: Step }) {
  const d = s.data as Record<string, any>;
  switch (s.name) {
    case "guard": return <Meta items={{ chars: d.chars, injection: d.injection ? "flagged" : "no", pii: d.pii_ask ? "flagged" : "no" }} />;
    case "persona_rewrite": case "followup_rewrite": return <div className="space-y-0.5 text-[11.5px]"><div className="text-faint">{d.from}</div><div className="text-ink">→ {d.to}</div></div>;
    case "cache": return <Meta items={{ result: d.hit ? (d.precomputed ? "hit · pre-computed" : "hit") : "miss" }} />;
    case "query_expansion": return <ol className="space-y-0.5 text-[11.5px]">{(d.queries ?? []).map((q: string, i: number) => <li key={i} className={i ? "text-ink" : "text-faint"}>{q}</li>)}</ol>;
    case "embed_query": return <Meta items={{ model: d.model, dim: d.dim, queries: d.n }} />;
    case "dense_search": case "sparse_search": return <><Meta items={{ k: d.k, over: d.collection }} /><div className="mt-1.5"><Hits hits={d.hits ?? []} /></div></>;
    case "rrf_fusion": case "multi_query_fusion":
      return <><Meta items={{ kept: d.k, ...(d.both != null ? { "in both": d.both, "dense only": d.only_dense, "sparse only": d.only_sparse } : {}) }} /><div className="mt-1.5"><Hits hits={d.hits ?? []} ranks={s.name === "rrf_fusion"} /></div></>;
    case "group_by_parent": {
      const [allP] = [d.parents ?? []];
      return <ol className="space-y-1.5 text-[11.5px]">{allP.slice(0, 5).map((p: any, i: number) => (
        <li key={p.sid} className="grid grid-cols-[1.6rem_1fr] gap-x-1"><span className="font-mono text-faint">{i + 1}</span>
          <div><span className="font-mono text-[10.5px] text-faint">{p.score.toFixed(4)} · {p.n_props} hit{p.n_props > 1 ? "s" : ""}</span>
            <ul className="text-muted">{p.top_props.slice(0, 2).map((t: string, j: number) => <li key={j} className="line-clamp-1">– {t}</li>)}</ul></div></li>))}</ol>;
    }
    case "fetch_parents": return <Meta items={{ sections: d.n }} />;
    case "rerank": {
      const inp: any[] = d.input ?? []; const moves: any[] = d.moves ?? [];
      return <>
        <Meta items={{ model: d.model?.replace("gemini-", ""), in: d.n_in, out: d.k_out, ...(d.skipped ? { skipped: "yes" } : {}), ...(d.error ? { error: d.error } : {}) }} />
        {moves.length > 0 && <ol className="mt-1.5 space-y-1.5 text-[11.5px]">{moves.map((m: any) => { const c = inp[m.from - 1]; const up = m.delta > 0; return (
          <li key={m.to} className="grid grid-cols-[3.4rem_1fr] gap-x-1">
            <span className="font-mono text-faint">{m.from}→{m.to} <span className={up ? "text-accent" : m.delta < 0 ? "text-warn" : "text-faint"}>{m.delta === 0 ? "" : up ? `↑${m.delta}` : `↓${-m.delta}`}</span></span>
            <div className="min-w-0"><div className="truncate text-ink">{c?.doc} <span className="text-faint">· {c?.heading?.split(" › ").slice(-1)[0]}</span></div>{m.why && <div className="text-muted">{m.why}</div>}</div>
          </li>); })}</ol>}
        {d.dropped?.length > 0 && <div className="mt-1 text-[11px] text-faint">dropped {d.dropped.length}</div>}
      </>;
    }
    case "build_prompt": return <><Meta items={{ passages: d.passages, chars: d.prompt_chars, "≈tokens": d.approx_tokens }} />
      <ol className="mt-1 space-y-0.5 text-[11.5px] text-muted">{(d.final ?? []).map((f: any) => <li key={f.sid} className="truncate">[{f.n}] {f.doc} <span className="text-faint">· {f.heading?.split(" › ").slice(-1)[0]} · {f.words}w</span></li>)}</ol></>;
    case "generate": return <Meta items={{ model: d.model?.replace("gemini-", ""), "first token": ms(d.first_token_ms), chunks: d.chunks, chars: d.output_chars }} />;
    default: return <pre className="whitespace-pre-wrap text-[11px] text-muted">{JSON.stringify(d, null, 1)}</pre>;
  }
}

/* ---------- panel ---------- */
export function PipelinePanel({ trace, live, onClose }: { trace: Trace | null; live?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [showCalls, setShowCalls] = useState(false);
  const total = trace?.total_ms ?? (trace?.steps.length ? Math.max(...trace.steps.map((s) => s.at_ms + s.ms)) : 0);
  const heavy = (trace?.steps ?? []).filter((s) => s.ms > 40);
  return (
    <div className="flex h-full min-h-0 flex-col text-[12px]">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Inspector</span>
        <div className="flex items-center gap-3 font-mono text-[10.5px] text-faint">
          {trace?.pipeline && <span>pipeline {trace.pipeline.toUpperCase()}</span>}
          {total > 0 && <span className="text-muted">{ms(total)}</span>}
          {trace?.precomputed ? <span className="text-accent">cached</span> : trace?.cached ? <span className="text-accent">cached</span> : null}
          {live && <span className="text-warn">live</span>}
          {onClose && <button onClick={onClose} aria-label="Close inspector" className="text-faint hover:text-ink">✕</button>}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {!trace || trace.steps.length === 0 ? (
          <p className="pt-2 text-faint">{live ? "Waiting for the first step…" : "Ask something to see how the answer is produced."}</p>
        ) : (
          <>
            {heavy.length > 0 && (
              <div className="mb-3 space-y-1">
                {heavy.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10.5px]">
                    <span className="w-24 shrink-0 truncate text-faint">{LABEL[s.name] ?? s.name}</span>
                    <div className="relative h-1 flex-1 rounded bg-surface-2"><div className="absolute h-1 rounded bg-accent/60" style={{ left: `${(s.at_ms / total) * 100}%`, width: `${Math.max(0.6, (s.ms / total) * 100)}%` }} /></div>
                    <span className="w-12 shrink-0 text-right font-mono text-faint">{ms(s.ms)}</span>
                  </div>))}
              </div>
            )}
            <ol className="divide-y divide-line/60">
              {trace.steps.map((s, i) => {
                const isOpen = !!open[i];
                return (
                  <li key={i}>
                    <button onClick={() => setOpen((o) => ({ ...o, [i]: !isOpen }))} className="flex w-full items-center gap-2.5 py-2 text-left">
                      <Icon k={ICON[s.name] ?? "dot"} className={isOpen ? "text-accent" : "text-faint"} />
                      <span className="flex-1 text-ink">{LABEL[s.name] ?? s.name}</span>
                      {s.pending ? <span className="font-mono text-[10.5px] text-warn">…</span> : (s.data as any)?.skipped ? <span className="font-mono text-[10.5px] text-faint">off</span> : <span className="font-mono text-[10.5px] text-faint">{ms(s.ms)}</span>}
                      <span className={`text-[10px] text-faint transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                    </button>
                    {isOpen && <div className="pb-3 pl-6"><p className="mb-1.5 text-[11px] text-faint">{DESC[s.name]}</p><Body s={s} /></div>}
                  </li>);
              })}
            </ol>
            {trace.calls && trace.calls.length > 0 && (
              <div className="mt-3 border-t border-line/60 pt-2">
                <button onClick={() => setShowCalls((v) => !v)} className="flex w-full items-center justify-between py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint hover:text-ink">
                  <span>Model calls · {trace.calls.length}</span><span className={`transition-transform ${showCalls ? "rotate-90" : ""}`}>›</span>
                </button>
                {showCalls && <ul className="mt-1 space-y-1 text-[11px]">{trace.calls.map((c, i) => (
                  <li key={i} className="flex items-baseline gap-2"><span className="w-14 shrink-0 font-mono text-faint">{c.kind}</span><span className="flex-1 truncate text-muted">{c.model.replace("models/", "").replace("gemini-", "")}</span>
                    <span className="font-mono text-faint">{Math.round(c.ms)} ms{c.detail?.output_tokens ? ` · ${c.detail.output_tokens} out tok` : ""}{c.detail?.texts ? ` · ${c.detail.texts} text${c.detail.texts === 1 ? "" : "s"}` : ""}</span></li>))}</ul>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function GlyphButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return <button onClick={onClick} aria-label={label} title={label} className={`rounded-md p-1.5 transition-colors ${active ? "text-accent" : "text-faint hover:text-ink"}`}>{children}</button>;
}
