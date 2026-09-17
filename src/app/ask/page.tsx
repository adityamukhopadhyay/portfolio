import type { Metadata } from "next";
import { AskPanel } from "@/components/AskWidget";

export const metadata: Metadata = {
  title: "Ask",
  description: "Ask questions about Aditya's work, answered from his project documents with citations.",
};

export default function AskPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 pt-12 sm:pt-16">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Retrieval-augmented · cites sources</p>
        <h1 className="serif-lesson mt-2 text-[34px] leading-tight text-ink sm:text-[44px]">Ask about Aditya</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Every answer is grounded in the project documents behind this site and links to the page it came from.
          If the documents don&apos;t cover something, it says so rather than guessing.
        </p>
      </header>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <AskPanel full />
      </div>
    </main>
  );
}
