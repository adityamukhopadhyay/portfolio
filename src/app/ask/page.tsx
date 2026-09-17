import type { Metadata } from "next";
import { AskPanel } from "@/components/AskWidget";

export const metadata: Metadata = {
  title: "Ask",
  description: "A retrieval-augmented assistant over Aditya's project documents — with the whole pipeline visible per query.",
};

export default function AskPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 pt-12 sm:pt-16">
      <header className="mb-6 max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Retrieval-augmented · hybrid dense + BM25 · listwise rerank · cites sources</p>
        <h1 className="serif-lesson mt-2 text-[34px] leading-tight text-ink sm:text-[44px]">Ask about Aditya</h1>
        <p className="mt-3 text-muted">
          Every answer is grounded in the project documents behind this site and links to where it came from. The panel on the right
          shows the pipeline for each question as it runs — expanded queries, the dense and sparse top-K, the fusion, the reranker&apos;s
          reordering with its reasons, and every model call with its latency. If the documents don&apos;t cover something, it says so.
        </p>
      </header>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <AskPanel full />
      </div>
      <p className="mt-4 font-mono text-[11px] text-faint">
        Backend: FastAPI + Qdrant on Railway, Gemini for embeddings, reranking and generation. Source: github.com/adityamukhopadhyay/portfolio-rag
      </p>
    </main>
  );
}
