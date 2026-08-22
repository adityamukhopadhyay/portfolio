// Standing facts about Aditya. Source of truth: ../ME.md and the resume
// generator (../build_resume.py). Keep in sync when either changes.

export const profile = {
  name: { first: "Aditya", last: "Mukhopadhyay" },
  role: "AI Engineer",
  company: "Badho Technologies",
  companyUrl: "https://badho.in",
  email: "adul.m.2003@gmail.com",
  links: {
    linkedin: "https://www.linkedin.com/in/adityamukhopadhyay2003/",
    github: "https://github.com/adityamukhopadhyay/",
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
      title: "LLM cost engineering with receipts",
      href: "/work/delivery-fleet",
      body: "$67/day → $11/day (−84%) through prompt caching, context recycling, and moving ~60% of traffic off the LLM entirely — after first discovering the cost figure everyone trusted was 5–10× overstated.",
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
        "Built a production fleet where one AI agent supervises each rider's full delivery day — 20+ concurrent Claude Agent SDK sessions over an in-process MCP toolset.",
        "Authored an MCP server exposing the buyer app as 100 tools, and shipped a live WhatsApp sales agent on top of it with deterministic honesty gates.",
        "Cut agent cost 84% ($67 → $11/day); enforced safety structurally, backed by 23 offline test suites (~800 assertions).",
        "Event-driven order-lifecycle notifications (10 stages, ~500 msgs/day) hardened after a real incident; an autonomous claims-and-tickets loop against our courier partner's API.",
        "Semantic search (FAISS), sister-product clustering across 85,000+ SKUs, 170,000+ external SKUs matched via a cost-tiered LLM funnel.",
        "Live money paths: a referral platform with 361/361 bonuses credited, and QR cashback with DB-level double-credit prevention.",
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
