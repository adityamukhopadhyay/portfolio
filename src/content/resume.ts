// The resume, verbatim. Source of truth: ../applications/build_resume_v2.py
// (variant `ai_engineer`, the reportlab generator that produced
// Aditya_Mukhopadhyay_Resume_canon.pdf). Every string here must stay byte-for-byte
// identical in meaning to the PDF — the web view and the PDF are the same document.
// Every project is ONE point: what was wrong, what was built, what it produced.
// **bold** marks what the PDF sets in DemiBold.
// "INR" is deliberate: the PDF cannot carry the rupee glyph (see SESSION_HANDOFF).

export type ResumeLeaf = { kind: "sub" | "leaf" | "flat"; text: string };
export type ResumeRole = { title: string; date: string; items: ResumeLeaf[] };

export const resume = {
  name: { first: "Aditya", last: "Mukhopadhyay" },
  subtitle: "AI Engineer — Badho Technologies",
  contact: {
    email: "adul.m.2003@gmail.com",
    phone: "+91-9981861975",
    portfolio: { label: "Portfolio", href: "https://adityamukhopadhyay.vercel.app" },
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
      { head: "Portfolio", body: "adityamukhopadhyay.vercel.app", href: "https://adityamukhopadhyay.vercel.app" },
      { head: "LinkedIn", body: "adityamukhopadhyay2003", href: "https://www.linkedin.com/in/adityamukhopadhyay2003/" },
      { head: "GitHub", body: "adityamukhopadhyay", href: "https://github.com/adityamukhopadhyay/" },
    ],
    skills: [
      { head: "Core", body: "Python · TypeScript · SQL · GraphQL (Hasura) · FastAPI · PostgreSQL · Supabase · Docker · AWS (EC2, Lambda, S3) · Railway · Vercel" },
      { head: "AI / LLM", body: "Claude Agent SDK · Model Context Protocol (MCP) · LangGraph · Claude / GPT / Gemini APIs · FAISS · embeddings & RAG · prompt caching & cost optimization · agent guardrails & evals · n8n" },
    ],
    projects: [
      {
        head: "Aditya MCP — agent-ops infrastructure",
        meta: "2026",
        body: "Work across many AI coding sessions was hard to report. Read-only **MCP server** over session transcripts, git history and handoff docs; powers a daily work report and stale-doc nudges.",
      },
      {
        head: "Serverless Multimodal Call QA",
        meta: "2025",
        body: "Call QA sampled a few calls by hand. AWS Lambda feeds audio straight to **Gemini 2.5 Pro** with campaign questions, writing strict JSON to PostgreSQL/Metabase. **100% call coverage.**",
      },
    ],
  },

  summary:
    "AI Engineer who takes LLM systems from idea to production and keeps them running: multi-agent orchestration on the Claude Agent SDK, MCP servers with real auth, WhatsApp agents for retailers, and semantic search and matching pipelines — Python, TypeScript, PostgreSQL, n8n and AWS, with deterministic guardrails and cost design built in.",

  roles: [
    {
      title: "AI Engineer | Badho Technologies Pvt. Ltd.",
      date: "Jun 2025 – Present",
      items: [
        { kind: "sub", text: "Autonomous Delivery Fleet — a multi-agent tree per rider (Claude Agent SDK, MCP)" },
        {
          kind: "leaf",
          text: "Delivery problems surfaced only when someone noticed a rider was stuck. Built a fleet where a root **orchestrator agent** runs each rider's day (**~20 concurrent**) and delegates to **sub-agents** — an **empath** drafting every Hinglish message, a **driver-profile analyst** setting tone from history, an **escalation governor**, a **judgement tiebreaker**, a **Google Maps route planner** — over one in-process **MCP server**: trip snapshot, log deltas, telemetry, SQL, **WhatsApp, push, Freshdesk tickets, vision on rider photos**. Runs unattended for **13-hour shifts**, plus an **“Ask the fleet”** agent for operators; guards below the model, **23 offline test suites**.",
        },
        { kind: "sub", text: "Buyer MCP — the buyer app as 100 agent tools (TypeScript, Hasura GraphQL)" },
        {
          kind: "leaf",
          text: "Agents had no safe way to act inside the buyer app. Wrote an MCP server exposing it as **100 typed tools** — **product search, carts, coupons and schemes, cart deeplinks, orders and cancellations, wallet and vouchers, support tickets** — behind phone-OTP OAuth and **per-buyer JWTs**, importing the app's own cart and coupon functions so prices never differ. Serves the production sales agent, Claude Desktop and Claude Code.",
        },
        { kind: "sub", text: "WhatsApp AI Sales Agent (Claude Agent SDK + Buyer MCP)" },
        {
          kind: "leaf",
          text: "Retailers ask questions and abandon carts on WhatsApp faster than a sales team can answer. Shipped a live agent that **searches the catalogue, builds carts, applies coupons, sends order deeplinks, answers order and cancellation questions from live state, handles complaints and images, and raises support tickets**: a tool-using worker reasons, a tool-less reply agent is the only voice, deterministic gates stop it claiming an unplaced order or filing duplicate tickets. Handles buyer chats end to end in production.",
        },
        { kind: "sub", text: "Courier Ops Autopilot — claims & tickets (FastAPI, remote MCP, Claude Haiku)" },
        {
          kind: "leaf",
          text: "Weight overcharges and failed deliveries with the courier partner went unclaimed; filing was manual. Built a backend, dashboard and remote MCP over the courier's API that **auto-files weight claims with vision over sorter images, raises NDR/lost/damaged tickets and drafts vendor replies**; one liveness gate halts every loop and model call if the vendor session dies. **698 claims and 370 tickets filed in 24 hours; 2,143 closed** to date.",
        },
        { kind: "sub", text: "Search, Matching & Catalog Intelligence (FAISS, HDBSCAN, n8n, PostgreSQL)" },
        {
          kind: "leaf",
          text: "Retailers search in Hinglish and phonetic spellings, **85,000+ SKUs** had no variant grouping, and **170,000+ competitor SKUs** needed mapping to the catalog. Built sub-100 ms hybrid search (FAISS + local embeddings + PostgreSQL metaphone), sister-product clustering (MiniLM embeddings, HDBSCAN/K-Means) and an n8n matching funnel ending in a GPT-4o-mini decision. **~40,000 product groups** mapped, **170,000+ SKUs** matched.",
        },
        { kind: "sub", text: "Order-Lifecycle WhatsApp Notifications (event-driven, PostgreSQL, Supabase)" },
        {
          kind: "leaf",
          text: "Buyers heard nothing as their orders moved. Built an event-driven notification engine over the read replica — pollers per stage, an idempotent send ledger, event-time guards, per-flow scope gates and boot-time template checks — sending WhatsApp updates through approved templates. **10 order stages, ~500 messages a day** to the whole buyer base.",
        },
        { kind: "sub", text: "Live Money Paths — referral credits & QR cashback (Next.js, Supabase, PostgreSQL)" },
        {
          kind: "leaf",
          text: "Reward programmes on real money must never pay twice or pay early. Built a referral engine (buyer webview with app-injected auth, rewards released only on the referred buyer's first delivered order) and carton-QR cashback where double credit is blocked by a **partial unique index on the wallet ledger**. **407 buyers referred, INR 48.1K paid out**, **114 orders** from referred buyers and **155 orders (INR 1.03L)** across both cohorts since referral.",
        },
      ],
    },
    {
      title: "AI Developer (Freelance) | Strix Digital",
      date: "Jul 2023 – May 2025",
      items: [{ kind: "flat", text: "Small clients wanted AI features without an in-house team. Built AI web apps (a cold-email generator on **Groq**), scrapers and automation tooling, and shipped an iOS app for a Houston client." }],
    },
    {
      title: "Data Science Intern | Acmegrade (in collab. with IIT Bombay)",
      date: "Apr 2022 – Jun 2022",
      items: [{ kind: "flat", text: "Built ML models for **movie recommendation**, **sales forecasting** and **CNN sound classification**; EDA and feature engineering on multi-modal datasets." }],
    },
  ] as ResumeRole[],

  // Checks that were actually run on the canonical PDF before it was published.
  // Shown as the "Open the PDF" animation.
  checklist: [
    { label: "Fits on one page", detail: "nothing spills to a second page" },
    { label: "Reads cleanly as plain text", detail: "applicant-tracking systems get every line" },
    { label: "All key figures present", detail: "100 tools, ~20 agents, 23 test suites, 698 + 370, 2,143, 85,000+, 170,000+, 407, INR 48.1K, INR 1.03L" },
    { label: "Links work", detail: "email · Portfolio · LinkedIn · GitHub" },
  ],
};

const strip = (s: string) => s.replace(/\*\*/g, "");

// What an ATS parser sees: the same content, in the PDF's reading order
// (whole sidebar, then the main column), with no formatting.
export function resumeAsPlainText(): string {
  const r = resume;
  const out: string[] = [];
  out.push(`${r.name.first} ${r.name.last}`, r.subtitle, `${r.contact.email} | ${r.contact.phone} | Portfolio | LinkedIn | GitHub`, "");
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
