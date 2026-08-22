import type { Metadata } from "next";
import { ResumeSheet } from "@/components/ResumeSheet";
import { resume } from "@/content/resume";

export const metadata: Metadata = {
  title: "Resume",
  description: "The same one-page resume, on the web — identical to the PDF, verified by text extraction.",
};

export default function ResumePage() {
  return (
    <main>
      <div className="mx-auto max-w-4xl px-5 pt-12 sm:pt-16">
        <p className="rise font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Resume · generated from source · verified by text extraction</p>
        <h1 className="rise mt-3 text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[44px]" style={{ animationDelay: "80ms" }}>
          The same one page, on the web.
        </h1>
        <p className="rise mt-4 max-w-2xl text-[16px] leading-relaxed text-muted" style={{ animationDelay: "160ms" }}>
          This is the PDF&apos;s exact copy, rendered live. Flip to <em>what an ATS sees</em> for the plain text a parser extracts, or open the
          PDF — it runs the real pre-send checklist on the way out. Typeset in Avenir Next in the PDF; {`${resume.name.first}`}&apos;s web stand-in is
          Nunito Sans.
        </p>
        <div className="rise mt-8" style={{ animationDelay: "240ms" }}>
          <ResumeSheet />
        </div>
      </div>
    </main>
  );
}
