// The resume, verbatim. Source of truth: ../build_resume.py (the reportlab
// generator that produced Aditya_Mukhopadhyay_Resume_canon.pdf). Every string
// here must stay byte-for-byte identical in meaning to the PDF — the web view and
// the PDF are the same document. **bold** marks what the PDF sets in DemiBold.
// "INR" is deliberate: the PDF cannot carry the rupee glyph (see SESSION_HANDOFF).

export type ResumeLeaf = { kind: "sub" | "leaf" | "flat"; text: string };
export type ResumeRole = { title: string; date: string; items: ResumeLeaf[] };

export const resume = {
  name: { first: "Aditya", last: "Mukhopadhyay" },
  subtitle: "AI Engineer — Badho Technologies",
  contact: {
    email: "adul.m.2003@gmail.com",
    phone: "+91-9981861975",
    linkedin: { label: "LinkedIn", href: "https://www.linkedin.com/in/adityamukhopadhyay2003/" },
    github: { label: "GitHub", href: "https://github.com/adityamukhopadhyay/" },
  },
  pdfHref: "/Aditya_Mukhopadhyay_Resume.pdf",

  sidebar: {
    education: [
      { head: "B.Tech, Information Technology", body: "IGEC Sagar (RGPV), Madhya Pradesh", meta: "2021 – 2025 · CGPA 7.5" },
      { head: "Class XII (PCM)", body: "SJC S.S. School, Ranjhi, Jabalpur", meta: "2021 · 93.4%" },
    ],
    links: [
      { head: "LinkedIn", body: "adityamukhopadhyay2003", href: "https://www.linkedin.com/in/adityamukhopadhyay2003/" },
      { head: "GitHub", body: "adityamukhopadhyay", href: "https://github.com/adityamukhopadhyay/" },
    ],
    skills: [
      { head: "Core", body: "Python · TypeScript · SQL · FastAPI · PostgreSQL · Supabase · Docker · AWS (EC2, Lambda, S3) · Railway · Vercel" },
      {
        head: "AI / LLM",
        body: "Claude Agent SDK · Model Context Protocol (MCP) · LangGraph · Claude / GPT / Gemini APIs · FAISS · embeddings & RAG · prompt caching & cost optimization · agent guardrails & evals · n8n",
      },
    ],
    projects: [
      {
        head: "Aditya MCP — Agent-Ops Infrastructure",
        meta: "2026",
        body: "Read-only **MCP server** mining AI coding-session transcripts, git history and handoff docs across every project; powers **scheduled autonomous routines** — daily work reports and cross-session stale-doc nudges. Agents auditing agents.",
      },
      {
        head: "Serverless Multimodal Call QA",
        meta: "2025",
        body: "AWS Lambda + Gemini 2.5 Pro pipeline auditing recorded sales calls, audio fed straight to the model — **100% call coverage**, structured JSON verdicts to Postgres/Metabase, replacing manual QA.",
      },
    ],
  },

  summary:
    "AI Engineer building production multi-agent systems and LLM infrastructure: autonomous agent fleets (Claude Agent SDK), Model Context Protocol (MCP) servers, conversational AI over WhatsApp, and semantic retrieval (FAISS/RAG) — focused on agent safety, honest evaluation and LLM cost engineering.",

  roles: [
    {
      title: "AI Engineer | Badho Technologies Pvt. Ltd.",
      date: "Jun 2025 – Present",
      items: [
        { kind: "sub", text: "Autonomous Delivery Fleet — Multi-Agent Operations (Claude Agent SDK, MCP)" },
        {
          kind: "leaf",
          text: "Built a production fleet where **one AI agent supervises each rider's full delivery day**: 20+ concurrent Claude Agent SDK sessions read live PostgreSQL via an in-process **MCP** toolset, coach riders over WhatsApp in Hinglish, file Freshdesk tickets, and escalate only true anomalies.",
        },
        {
          kind: "leaf",
          text: "Cut agent cost **84% ($67 → $11/day)** via prompt caching, context recycling and a rule/LLM hybrid that moved routine nudges to zero-cost templates (**−96% LLM turns**); enforced safety structurally — recipient guards, invented-number blocking, watchdogs, healthchecks — backed by **23 offline test suites (~800 assertions)**.",
        },
        { kind: "sub", text: "Conversational Commerce — WhatsApp AI Sales Agent + 100-Tool Buyer MCP" },
        {
          kind: "leaf",
          text: "Authored an **MCP server exposing the buyer app as 100 tools** (Hasura GraphQL + REST, phone-OTP OAuth, per-buyer JWT) with exact app-parity cart, coupon and deeplink engines — consumed by production agents, Claude Desktop and Claude Code.",
        },
        {
          kind: "leaf",
          text: "Shipped the live WhatsApp sales bot on top: tool-using worker + tone-controlled reply agent, with deterministic honesty gates — it can never claim an unplaced order, and ticket raises are hard-gated against existing tickets.",
        },
        {
          kind: "leaf",
          text: "Rebuilt attribution after measuring that **75% of credited orders predated first contact**, replacing the vanity metric with exact cart-ID causal matching; every tile reconciles **exactly** against the production replica (**INR 5.0L across 475 orders**) at **$152.50 total LLM spend**.",
        },
        { kind: "sub", text: "Order-Lifecycle WhatsApp Automation (event-driven, incident-hardened)" },
        {
          kind: "leaf",
          text: "Event-time-guarded notification engine — **10 order stages, ~500 messages/day, zero errors over 8 days**; built the guard architecture post-incident so bulk-touched rows can never trigger sends.",
        },
        { kind: "sub", text: "Delhivery Courier Ops Autopilot — Claims & Tickets (MCP + Dashboard)" },
        {
          kind: "leaf",
          text: "Autonomous recovery loop over our courier partner Delhivery's ops API: auto-files **weight-discrepancy claims** and **NDR/lost/damaged tickets**, triaged by Claude Haiku with **vision on exception images** — **698 claims + 370 tickets filed in 24h**, **2,143 closed** to date; a **session-liveness kill switch** halts all loops and AI spend when the upstream session dies.",
        },
        { kind: "sub", text: "Search, Matching & Catalog Intelligence" },
        {
          kind: "leaf",
          text: "Sub-100ms semantic search (**FAISS** + Ollama embeddings + Postgres phonetics); sister-product clustering across **85,000+ SKUs** (HDBSCAN/K-Means); **170,000+ external SKUs** matched via a cost-tiered funnel (Typesense → trigram → batched LLM).",
        },
        { kind: "sub", text: "Rewards & Growth Platforms (live money paths)" },
        {
          kind: "leaf",
          text: "Built and operate real-money systems end-to-end: a referral platform — **Next.js buyer webview** (app-injected auth, one link for every buyer), **Supabase credit service**, poller releasing rewards only on **delivered** orders, **AiSensy WhatsApp** notifications — **361/361 bonuses credited, zero misses**; plus QR scratch cashback with **DB-level double-credit prevention**.",
        },
      ],
    },
    {
      title: "AI Developer (Freelance) | Strix Digital",
      date: "Jul 2023 – May 2025",
      items: [{ kind: "flat", text: "Built AI web-apps (custom **Cold Email Generator** on **Groq**), automation tooling and scrapers; shipped an iOS app for a Houston client." }],
    },
    {
      title: "Data Science Intern | Acmegrade (in collab. with IIT Bombay)",
      date: "Apr 2022 – Jun 2022",
      items: [{ kind: "flat", text: "Built ML models for **movie recommendation, sales forecasting** and **CNN sound classification**; EDA and feature engineering on multi-modal data." }],
    },
  ] as ResumeRole[],

  // The pre-send checklist that was actually run on the canonical PDF
  // (SESSION_HANDOFF.md → "Pre-send checklist"). Shown as the CTA animation.
  checklist: [
    { label: "page count == 1", detail: "no spill to page 2" },
    { label: "no tofu glyphs", detail: "rupee written as INR — the embedded font predates U+20B9" },
    { label: "12 / 12 key numbers survive text extraction", detail: "84%, −96%, 800 assertions, INR 5.0L, 475, $152.50, 361/361, 698, 2,143, 100 tools, 85,000+, 170,000+" },
    { label: "5 link annotations intact", detail: "mailto · LinkedIn ×2 · GitHub ×2" },
  ],
};

const strip = (s: string) => s.replace(/\*\*/g, "");

// What an ATS parser sees: the same content, in the PDF's reading order
// (whole sidebar, then the main column), with no formatting.
export function resumeAsPlainText(): string {
  const r = resume;
  const out: string[] = [];
  out.push(`${r.name.first} ${r.name.last}`, r.subtitle, `${r.contact.email} | ${r.contact.phone} | LinkedIn | GitHub`, "");
  out.push("EDUCATION");
  for (const e of r.sidebar.education) out.push(e.head, e.body, e.meta);
  out.push("", "LINKS");
  for (const l of r.sidebar.links) out.push(l.head, l.body);
  out.push("", "SKILLS");
  for (const s of r.sidebar.skills) out.push(s.head, s.body);
  out.push("", "PROJECTS");
  for (const p of r.sidebar.projects) out.push(p.head, p.meta, strip(p.body));
  out.push("", "SUMMARY", r.summary, "", "WORK EXPERIENCE");
  for (const role of r.roles) {
    out.push(`${role.title}  ${role.date}`);
    for (const it of role.items) out.push((it.kind === "leaf" ? "  ○ " : "• ") + strip(it.text));
  }
  return out.join("\n");
}
