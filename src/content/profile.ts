// Standing facts about Aditya. Source of truth: ../ME.md and the resume
// generator (../build_resume.py). Keep in sync when either changes.

export const profile = {
  name: { first: "Aditya", last: "Mukhopadhyay" },
  role: "AI Engineer",
  company: "Badho Technologies",
  companyUrl: "https://badho.in",
  email: "adul.m.2003@gmail.com",
  phone: "+91-9981861975",
  links: {
    linkedin: "https://www.linkedin.com/in/adityamukhopadhyay2003/",
    github: "https://github.com/adityamukhopadhyay/",
    projectDocs: "https://drive.google.com/drive/folders/1zYhjtbmRBKxq09_61hzhWWnQZ2N1uAtj?usp=sharing",
  },
  resumeHref: "/Aditya_Mukhopadhyay_Resume.pdf",

  tagline:
    "I build production multi-agent systems and the MCP infrastructure they run on — with a working obsession for agent safety, honest evaluation and LLM cost engineering.",

  intro: [
    "I'm an AI Engineer at Badho, a B2B distribution platform in India. My work is the unglamorous half of AI: agents that run unattended for a full working day, MCP servers that real products call, WhatsApp agents that talk to thousands of retailers — and the guards, ledgers and kill switches that keep all of it honest.",
    "Everything here ran in production. Every number was measured, and each one says how. Where a figure is flattering but not causal, I say so.",
  ],

  // The five things that actually differentiate the work. First person, no hedging.
  signals: [
    {
      title: "Agent fleets that run unattended in production",
      href: "/work/delivery-fleet",
      body: "~20 concurrent Claude Agent SDK sessions, one per rider per day, talking to real riders over WhatsApp for a 13-hour shift. Not a demo.",
    },
    {
      title: "I build MCP servers, not just consume them",
      href: "/work/buyer-mcp",
      body: "A 100-tool buyer-app MCP with real auth (phone-OTP OAuth → per-buyer JWT), a bearer-gated remote MCP over a courier's ops API, and a personal agent-ops MCP.",
    },
    {
      title: "Deterministic where it can be, the model where it must be",
      href: "/work/delivery-fleet",
      body: "Routine rider nudges run as deterministic templates filled from the live snapshot and re-checked at send time; the LLM is kept for judgement, escalation and real replies. The same rule/LLM split that makes the fleet reliable is what keeps it cheap to run at scale.",
    },
    {
      title: "Agents must not be able to lie",
      href: "/work/whatsapp-sales-agent",
      body: "Structural guards below the model — recipient guards, invented-number blocking, ticket gates, a reply agent that can't see tool narration — not prompt-level pleading.",
    },
    {
      title: "Live money paths",
      href: "/work/live-money-paths",
      body: "Referral credits and cashback with DB-level double-credit prevention. Real rupees, adversarially audited against production.",
    },
  ],

  skills: {
    core: ["Python", "TypeScript", "SQL", "FastAPI", "PostgreSQL", "Supabase", "Docker", "AWS (EC2, Lambda, S3)", "Railway", "Vercel", "Next.js"],
    ai: [
      "Claude Agent SDK",
      "Model Context Protocol (MCP)",
      "Claude / GPT / Gemini APIs",
      "LangGraph",
      "FAISS",
      "embeddings & RAG",
      "prompt caching & cost optimization",
      "agent guardrails & evals",
      "n8n",
    ],
  },

  experience: [
    {
      role: "AI Engineer",
      org: "Badho Technologies Pvt. Ltd.",
      period: "Jun 2025 – Present",
      bullets: [
        "Built a delivery fleet where a root orchestrator agent runs each rider's day (~20 concurrent) and delegates to sub-agents — empath, driver-profile analyst, escalation governor, judgement tiebreaker, Google Maps route planner — over one in-process MCP server with WhatsApp, push, Freshdesk tickets and vision on rider photos.",
        "Authored an MCP server exposing the buyer app as 100 typed tools behind phone-OTP OAuth and per-buyer JWTs, and shipped a live WhatsApp sales agent on it that searches the catalogue, builds carts, applies coupons, sends deeplinks and raises tickets — with deterministic honesty gates.",
        "Guards below the model — recipient guard, invented-number blocking, watchdog, healthcheck — pinned by 23 offline test suites; routine nudges run as deterministic templates so the model is used only for judgement.",
        "An autopilot over the courier partner's API that auto-files weight claims with vision over sorter images and raises NDR/lost/damaged tickets — 698 claims and 370 tickets filed in 24 hours, 2,143 closed to date.",
        "Sub-100 ms hybrid search (FAISS + PostgreSQL metaphone), sister-product clustering across 85,000+ SKUs, and 170,000+ external SKUs matched through an n8n funnel ending in an LLM decision.",
        "Event-driven order-lifecycle notifications (10 stages, ~500 messages a day) and live money paths — a referral engine (407 buyers referred, INR 48.1K paid out, 155 orders across both cohorts) and QR cashback with DB-level double-credit prevention.",
      ],
    },
    {
      role: "AI Developer (Freelance)",
      org: "Strix Digital",
      period: "Jul 2023 – May 2025",
      bullets: ["Built AI web-apps (a custom cold-email generator on Groq), automation tooling and scrapers; shipped an iOS app for a Houston client."],
    },
    {
      role: "Data Science Intern",
      org: "Acmegrade (in collaboration with IIT Bombay)",
      period: "Apr 2022 – Jun 2022",
      bullets: ["ML models for movie recommendation, sales forecasting and CNN sound classification; EDA and feature engineering on multi-modal data."],
    },
  ],

  education: [
    { degree: "B.Tech, Information Technology", school: "IGEC Sagar (RGPV), Madhya Pradesh", period: "2021 – 2025", note: "CGPA 7.5" },
    { degree: "Class XII (PCM)", school: "SJC S.S. School, Ranjhi, Jabalpur", period: "2021", note: "93.4%" },
  ],
} as const;
