import type { Metadata } from "next";
import { AskPanel } from "@/components/AskWidget";

export const metadata: Metadata = {
  title: "Ask",
  description: "A retrieval-augmented assistant over Aditya's project documents, with the pipeline visible per question.",
};

export default function AskPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 pt-12 sm:pt-16">
      <header className="mb-6 max-w-2xl">
        <h1 className="serif-lesson text-[34px] leading-tight text-ink sm:text-[44px]">Ask about Aditya</h1>
        <p className="mt-3 text-muted">
          Answers come from the project documents behind this site and cite where they came from. Open the inspector to watch each
          question run through retrieval, fusion, reranking and generation, with the time each step took.
        </p>
      </header>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <AskPanel full />
      </div>
      <p className="mt-4 font-mono text-[11px] text-faint">FastAPI · Qdrant · Gemini · Railway — source on GitHub: adityamukhopadhyay/portfolio-rag</p>
    </main>
  );
}
