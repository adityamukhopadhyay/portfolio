"use client";

import { useState } from "react";

export type Step = { name: string; ms: number; at_ms: number; data: Record<string, unknown>; pending?: boolean };
export type Call = { kind: string; model: string; ms: number; detail: Record<string, unknown> };
export type Trace = { total_ms?: number; steps: Step[]; calls?: Call[]; pipeline?: string; queries?: string[]; question?: string; precomputed?: boolean; cached?: boolean };

type Hit = { rank: number; score: number; sid: string; doc: string; title: string; heading: string; snippet: string; words: number; ranks?: Record<string, number> };

const LABEL: Record<string, string> = {
  guard: "Input guard", followup_rewrite: "Follow-up rewrite", cache: "Answer cache", query_expansion: "Query expansion",
  embed_query: "Embed query", dense_search: "Dense search", sparse_search: "Sparse search (BM25)", rrf_fusion: "RRF fusion",
  multi_query_fusion: "Multi-query fusion", group_by_parent: "Group propositions → sections", fetch_parents: "Fetch parent sections",
  rerank: "Rerank (listwise LLM)", build_prompt: "Build prompt", generate: "Generate answer",
};
const DESC: Record<string, string> = {
  guard: "Normalise, strip control characters, cap length, flag injection / PII patterns. Deterministic.",
  followup_rewrite: "The question referenced earlier turns, so the light model rewrote it to stand alone.",
  cache: "Answers are cached on the normalised question. Pre-drafted questions are pinned with their full trace.",
  query_expansion: "The light model writes 2 alternative phrasings; each is searched and the results are fused.",
  embed_query: "Gemini embedding, task=RETRIEVAL_QUERY, truncated to 768-d and unit-normalised.",
  dense_search: "Nearest neighbours by dot product over the dense vectors in Qdrant.",
  sparse_search: "BM25-style sparse vectors; IDF is applied inside Qdrant. Catches exact technical tokens.",
  rrf_fusion: "Reciprocal-rank fusion of the dense and sparse lists (k=60). No score normalisation needed.",
  multi_query_fusion: "RRF again across the per-query fused lists.",
  group_by_parent: "Pipeline B: proposition hits are grouped by their parent section; a section scores the sum of its top-3 propositions.",
  fetch_parents: "Pipeline B: the parent section text is what the answerer reads (small-to-big).",
  rerank: "One listwise call: the model receives the candidates and returns an order with a one-line reason each.",
  build_prompt: "Final passages are numbered [1]..[n] and framed as data; the answer must cite them.",
  generate: "Streamed generation; first-token latency is the time to the first streamed chunk.",
};

function ms(x?: number) { return x == null ? "" : x < 1 ? "<1 ms" : x < 1000 ? `${Math.round(x)} ms` : `${(x / 1000).toFixed(2)} s`; }

function HitTable({ hits, showRanks }: { hits: Hit[]; showRanks?: boolean }) {
  return (
    <table className="w-full text-[11.5px]">
      <thead className="text-faint"><tr><th className="pr-2 text-left font-normal">#</th><th className="pr-2 text-left font-normal">score</th>{showRanks && <th className="pr-2 text-left font-normal">dense/sparse</th>}<th className="text-left font-normal">passage</th></tr></thead>
      <tbody>
        {hits.map((h) => (
          <tr key={h.sid + h.rank} className="border-t border-line/60 align-top">
            <td className="pr-2 py-1 font-mono text-faint">{h.rank}</td>
            <td className="pr-2 py-1 font-mono text-muted">{h.score.toFixed(4)}</td>
            {showRanks && <td className="pr-2 py-1 font-mono text-muted">{h.ranks ? `${h.ranks["0"] ?? "–"} / ${h.ranks["1"] ?? "–"}` : ""}</td>}
            <td className="py-1"><span className="text-ink">{h.title}</span> <span className="text-faint">› {h.heading?.split(" › ").slice(1).join(" › ")}</span>
              <div className="text-muted">{h.snippet}</div></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StepBody({ s }: { s: Step }) {
  const d = s.data as Record<string, any>;
  switch (s.name) {
    case "guard": return <KV items={{ chars: d.chars, injection_pattern: String(d.injection), pii_pattern: String(d.pii_ask) }} />;
    case "followup_rewrite": return <div className="space-y-1"><div><span className="text-faint">from:</span> {d.from}</div><div><span className="text-faint">to:</span> {d.to}</div></div>;
    case "cache": return <KV items={{ hit: String(d.hit), ...(d.precomputed ? { precomputed: "yes — pre-drafted question" } : {}) }} />;
    case "query_expansion": return <ol className="list-decimal space-y-0.5 pl-4">{(d.queries ?? []).map((q: string, i: number) => <li key={i}>{q}{i === 0 && <span className="text-faint"> (original)</span>}</li>)}</ol>;
    case "embed_query": return <KV items={{ model: d.model, dim: d.dim, queries: d.n }} />;
    case "dense_search": case "sparse_search":
      return <><KV items={{ collection: d.collection, k: d.k, query: d.query, ...(d.metric ? { metric: d.metric } : {}), ...(d.method ? { method: d.method } : {}) }} /><HitTable hits={d.hits ?? []} /></>;
    case "rrf_fusion": case "multi_query_fusion":
      return <><KV items={{ k: d.k, rrf_k: d.rrf_k, ...(d.both != null ? { in_both_lists: d.both, dense_only: d.only_dense, sparse_only: d.only_sparse } : {}) }} /><HitTable hits={d.hits ?? []} showRanks={s.name === "rrf_fusion"} /></>;
    case "group_by_parent":
      return <><div className="text-faint">{d.rule}</div><ol className="mt-1 space-y-1.5 pl-4 list-decimal">{(d.parents ?? []).map((p: any) => (
        <li key={p.sid}><span className="font-mono text-muted">{p.score.toFixed(4)}</span> · {p.n_props} proposition{p.n_props > 1 ? "s" : ""} hit
          <ul className="ml-3 list-disc text-muted">{p.top_props.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></li>))}</ol></>;
    case "fetch_parents": return <KV items={{ sections: d.n, collection: d.collection }} />;
    case "rerank": {
      const inp: any[] = d.input ?? []; const moves: any[] = d.moves ?? [];
      return <>
        <KV items={{ model: d.model, candidates_in: d.n_in, kept: d.k_out, ...(d.skipped ? { skipped: "yes" } : {}), ...(d.error ? { error: d.error } : {}) }} />
        {moves.length > 0 && (
          <table className="mt-1 w-full text-[11.5px]"><thead className="text-faint"><tr><th className="text-left font-normal pr-2">in → out</th><th className="text-left font-normal pr-2">passage</th><th className="text-left font-normal">reranker&apos;s reason</th></tr></thead>
            <tbody>{moves.map((m: any) => { const c = inp[m.from - 1]; const up = m.delta > 0; return (
              <tr key={m.to} className="border-t border-line/60 align-top">
                <td className="py-1 pr-2 font-mono whitespace-nowrap">{m.from} → {m.to} <span className={up ? "text-accent" : m.delta < 0 ? "text-warn" : "text-faint"}>{m.delta === 0 ? "=" : up ? `▲${m.delta}` : `▼${-m.delta}`}</span></td>
                <td className="py-1 pr-2"><span className="text-ink">{c?.doc}</span> <span className="text-faint">› {c?.heading?.split(" › ").slice(-1)[0]}</span></td>
                <td className="py-1 text-muted">{m.why ?? ""}</td></tr>); })}</tbody></table>)}
        {d.dropped?.length > 0 && <div className="mt-1 text-faint">dropped: {d.dropped.join(", ")}</div>}
      </>;
    }
    case "build_prompt": return <><KV items={{ model: d.model, passages: d.passages, prompt_chars: d.prompt_chars, approx_tokens: d.approx_tokens }} />
      <ol className="mt-1 list-decimal pl-4 text-muted">{(d.final ?? []).map((f: any) => <li key={f.sid}>[{f.n}] {f.doc} › {f.heading?.split(" › ").slice(-1)[0]} <span className="text-faint">({f.words} words)</span></li>)}</ol></>;
    case "generate": return <KV items={{ model: d.model, streamed: String(d.streamed), first_token: ms(d.first_token_ms), chunks: d.chunks, output_chars: d.output_chars, temperature: d.temperature }} />;
    default: return <pre className="whitespace-pre-wrap text-[11px] text-muted">{JSON.stringify(d, null, 1)}</pre>;
  }
}

function KV({ items }: { items: Record<string, unknown> }) {
  const e = Object.entries(items).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px]">{e.map(([k, v]) => <span key={k}><span className="text-faint">{k}:</span> <span className="font-mono text-muted">{String(v)}</span></span>)}</div>;
}

export function PipelinePanel({ trace, live }: { trace: Trace | null; live?: boolean }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  if (!trace || trace.steps.length === 0)
    return <div className="p-4 text-[12px] text-faint">{live ? "Waiting for the first step…" : "Ask something to see the pipeline run."}</div>;
  const total = trace.total_ms ?? Math.max(...trace.steps.map((s) => s.at_ms + s.ms));
  const heavy = trace.steps.filter((s) => s.ms > 50);
  return (
    <div className="space-y-3 p-3 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Pipeline {trace.pipeline?.toUpperCase() ?? ""}</span>
        <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink">{ms(total)} total</span>
        {trace.precomputed && <span className="rounded-md bg-accent-soft px-2 py-0.5 font-mono text-[11px] text-accent">pre-computed · replayed from cache</span>}
        {trace.cached && !trace.precomputed && <span className="rounded-md bg-accent-soft px-2 py-0.5 font-mono text-[11px] text-accent">cache hit</span>}
        {live && <span className="font-mono text-[11px] text-warn">● live</span>}
      </div>
      {/* Timeline: proportional bars for anything that took real time */}
      {heavy.length > 0 && (
        <div className="space-y-1">
          {heavy.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="w-36 shrink-0 truncate text-muted">{LABEL[s.name] ?? s.name}</span>
              <div className="relative h-2.5 flex-1 rounded bg-surface-2">
                <div className="absolute h-2.5 rounded bg-accent/70" style={{ left: `${(s.at_ms / total) * 100}%`, width: `${Math.max(0.8, (s.ms / total) * 100)}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right font-mono text-muted">{ms(s.ms)}</span>
            </div>
          ))}
        </div>
      )}
      {/* Step list */}
      <ol className="space-y-1">
        {trace.steps.map((s, i) => {
          const isOpen = open[i] ?? (s.name === "rerank" || s.name === "rrf_fusion" || s.name === "query_expansion" || s.name === "group_by_parent");
          return (
            <li key={i} className="rounded-lg border border-line bg-surface">
              <button onClick={() => setOpen((o) => ({ ...o, [i]: !isOpen }))} className="flex w-full items-center gap-2 px-3 py-1.5 text-left">
                <span className="font-mono text-[10px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 text-ink">{LABEL[s.name] ?? s.name}</span>
                {s.pending ? <span className="font-mono text-[11px] text-warn">running…</span> : <span className="font-mono text-[11px] text-muted">{ms(s.ms)}</span>}
                <span className="text-faint">{isOpen ? "▾" : "▸"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-line px-3 py-2">
                  <div className="mb-1.5 text-[11px] text-faint">{DESC[s.name]}</div>
                  <StepBody s={s} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {trace.calls && trace.calls.length > 0 && (
        <div>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Model calls</div>
          <table className="w-full text-[11.5px]"><thead className="text-faint"><tr><th className="text-left font-normal pr-2">kind</th><th className="text-left font-normal pr-2">model</th><th className="text-right font-normal pr-2">ms</th><th className="text-left font-normal">detail</th></tr></thead>
            <tbody>{trace.calls.map((c, i) => (
              <tr key={i} className="border-t border-line/60"><td className="py-1 pr-2 font-mono">{c.kind}</td><td className="py-1 pr-2 font-mono text-muted">{c.model.replace("models/", "")}</td>
                <td className="py-1 pr-2 text-right font-mono text-muted">{Math.round(c.ms)}</td>
                <td className="py-1 text-muted">{Object.entries(c.detail ?? {}).filter(([, v]) => v != null).map(([k, v]) => `${k}=${v}`).join("  ")}</td></tr>))}</tbody></table>
        </div>
      )}
    </div>
  );
}
