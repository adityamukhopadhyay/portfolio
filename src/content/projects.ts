// Portfolio content. Source of truth for numbers: ../projects.md (verified from git,
// handoff docs and live production). Mechanism detail comes from the per-project
// handoff docs with identifiers stripped. Nothing here is estimated.

export type Theme = "Agents" | "MCP" | "Conversational AI" | "Safety & cost" | "Money paths" | "Retrieval & matching" | "Pipelines";

export type Metric = {
  value: string;
  label: string;
  note?: string;
  count?: { to: number; prefix?: string; suffix?: string; decimals?: number };
};

export type Mechanism = { title: string; body: string };

export type Project = {
  slug: string;
  title: string;
  short: string;
  tier: 1 | 2;
  themes: Theme[];
  period: string;
  stack: string[];
  headline: Metric[];
  // Deep-dive fields (tier 1)
  context?: string[];
  mechanisms?: Mechanism[];
  metrics?: Metric[];
  honesty?: string;
  lessons?: string[];
  links?: { label: string; href: string }[];
  chart?: "fleet-cost";
  // Tier-2 expandable detail
  detail?: string[];
};

export const THEMES: Theme[] = ["Agents", "MCP", "Conversational AI", "Safety & cost", "Money paths", "Retrieval & matching", "Pipelines"];

export const projects: Project[] = [
  {
    slug: "delivery-fleet",
    title: "Autonomous Delivery Fleet",
    short: "One Claude agent per rider, per day, supervising real deliveries over WhatsApp — about twenty at once, unattended for a 13-hour shift.",
    tier: 1,
    themes: ["Agents", "MCP", "Safety & cost"],
    period: "2026 · Badho",
    stack: ["Python", "Claude Agent SDK", "MCP", "FastAPI", "PostgreSQL", "Supabase", "WAHA", "Freshdesk", "Railway", "React"],
    headline: [
      { value: "−84%", label: "agent cost per day", count: { to: 84, prefix: "−", suffix: "%" } },
      { value: "~20", label: "concurrent sessions", count: { to: 20, prefix: "~" } },
      { value: "−96%", label: "nudge LLM turns", count: { to: 96, prefix: "−", suffix: "%" } },
    ],
    context: [
      "Badho runs a fleet of last-mile riders. Anomaly detection used to be reactive and human: someone noticed a rider was late, or a distributor called. I built a system where **one Claude Agent SDK session supervises one rider's entire day** — it pulls log deltas, decides whether each event is an anomaly, coaches the rider in Hinglish over WhatsApp, alerts the distributor, files a ticket, and escalates only when something is genuinely wrong.",
      "It replaced a LangGraph orchestration with the Agent SDK plus an in-process MCP server, and it runs without anyone watching: sessions auto-start inside the shift window, refill after deploys, and are structurally gated off on Sundays. The brief from the CEO was explicit — riders must experience a supportive partner, not a robotic alerting system.",
    ],
    mechanisms: [
      {
        title: "The bill was wrong before it was high",
        body: "The SDK's `total_cost_usd` is cumulative per session; summing it per turn had multiplied every prior spend figure by 5–10×. Reconciling against the console came first. Then the real levers: 66% of spend was cache re-priming, so a 1-hour prompt-cache TTL; context recycling bounded at 60k tokens; 25 unused built-in tools dropped. **$67/day → $26.84 → $10.72**, traced turn by turn.",
      },
      {
        title: "The ~60% lever: nudges were templates all along",
        body: "Heartbeats, chases, pickup reminders and greetings were ~60% of the bill at 2–3× the cost of a judgement turn — because every draft consulted the empath subagent. Sampling the corpus showed every one was \"{name}, {facts} — {action}?\". They became deterministic Python over the already-fetched snapshot: **nudge LLM turns 35.3/hr → 1.4/hr**, empath calls 575 → 42. Escalation evaluation, inbound replies and log-delta judgement stay with the model, pinned by tests that assert no rule branch near them.",
      },
      {
        title: "Freshness guard — templates can't think, so re-check at send time",
        body: "Sweeps decide off a snapshot up to five minutes old. The LLM path compensated by instruction (\"call get_trip_snapshot first\"); a template can't. So every rule-based send re-fetches at the moment of sending and re-verifies its condition: **send** with fresh values, **abort** if the condition cleared, or **fall back to the LLM** if the rider spoke recently — degrade to intelligence, never to a wrong message. It fails open on a fetch failure, deliberately: freshness is an upgrade, not a new dependency.",
      },
      {
        title: "Guards below the model, with a deliberate asymmetry",
        body: "Prompts drift; gates don't. The recipient guard sits at the single path every agent message must take, and **blocks only on a proven mismatch** — the trip's resolved rider phone versus a different plain number — while **allowing every uncertainty**. Blocking on uncertainty would take the whole fleet down on a read-replica blip, which is far worse than the risk it prevents. Alongside it: a respect guard (riders are always `aap`), a figure guard (no invented numbers), sanitised agent-authored tickets, a watchdog that alarms when the *agents* go quiet, and a container that fails its healthcheck if it can't run agents.",
      },
      {
        title: "The outage that looked like health",
        body: "An unpinned transitive dependency (`mcp` 2.0.0) removed an API the SDK called. All 25 auto-started sessions died at start — and stayed registered as running, so the dashboard showed *more* agents than riders, and recovery was impossible because the next start found the corpse. 5h 20m unmonitored. Fixed the same day: rollback on start failure, a test pinning the invariant (N failed spawns ⇒ 0 agents live), and the transitive dep pinned separately. An unpinned transitive dep is a time bomb with a random fuse.",
      },
      {
        title: "Quality that tests cannot see",
        body: "Reading real rider threads found six defects no suite could catch: **35% of sends were content-free** (one rider got eight in a day; fleet reply rate 4%); **12.6% used `tu`/`tum`**; a deadline quoted after it had passed; verbatim repeats across restarts; a stall the counters couldn't see; silence toward a rider who had just explained himself. Each got a structural fix. The design rule that came out of it: be proactive — say what has *not* happened and for how long, and never ask a rider for an update the lifecycle already shows.",
      },
    ],
    metrics: [
      { value: "$67 → $11", label: "per day, Aug 1 → Aug 11", note: "Traced per turn from the orchestrator session: $10.72 across 580 turns and 22 riders. Auxiliary sessions were un-instrumented at the time and the console read ~$13 — so the honest figure is \"$11–13\", and −84% is against the Aug-1 baseline." },
      { value: "35.3 → 1.4", label: "nudge LLM turns per hour", note: "Measured after rule-based nudges shipped; empath subagent calls fell 575 → 42. Rider replies to templates still cost — that is the intended win." },
      { value: "~20", label: "concurrent sessions, one per rider", note: "Auto-started for every active rider in the 08:00–21:00 IST window; 22 riders traced on Aug 11. Sundays gated off at every spawn path.", count: { to: 20, prefix: "~" } },
      { value: "23 / ~800", label: "offline test suites / assertions", note: "Run before every deploy. They pin the guard asymmetries, the registry rollback, the rule/LLM boundary and the figure rules — by construction, templates cannot write numbers." },
      { value: "5–10×", label: "how far the first cost figure was off", note: "Cumulative `total_cost_usd` summed per turn. Found by reconciling traces against the billing console; every earlier figure was retracted." },
      { value: "5h 20m", label: "the outage I own", note: "25 sessions dead at start, registered as live. Same-day fix, invariant test, dependency pinned." },
    ],
    chart: "fleet-cost",
    honesty: "The cost figures on this page are traced, not billed. Only the orchestrator session emitted per-turn cost when they were taken; the operator chat, fleet chat and ritual sessions did not, and the console read about $13 against $10.72 traced. I report both numbers rather than the flattering one.",
    lessons: ["Prompts drift; gates don't. Put every invariant below the model.", "Measure the bill before optimising it — the first number was wrong by an order of magnitude.", "Tests can't see tone. Read the threads."],
  },

  {
    slug: "buyer-mcp",
    title: "Buyer MCP — the app as 100 agent tools",
    short: "A Model Context Protocol server that exposes the whole buyer marketplace as typed tools, with real OAuth and exact app parity — consumed by production agents, Claude Desktop and Claude Code.",
    tier: 1,
    themes: ["MCP", "Agents", "Safety & cost"],
    period: "2026 · Badho",
    stack: ["TypeScript", "MCP SDK", "Hasura GraphQL", "REST", "OAuth 2.0 / JWT", "Railway"],
    headline: [
      { value: "100", label: "typed tools", count: { to: 100 } },
      { value: "1", label: "buyer per session, row-scoped", count: { to: 1 } },
      { value: "0", label: "genuine failures in the tool sweep", count: { to: 0 } },
    ],
    context: [
      "I build MCP servers, not just consume them. This one mirrors what a buyer can do in the Badho app — catalogue, sellers, cart, coupons, orders, support tickets, addresses, payouts, wallet, referrals, even the home-screen layout — by replaying the app's **exact** GraphQL and REST calls, scoped to one authenticated buyer per session. \"Nothing more, nothing less\" is enforced by the platform's buyer role and the buyer's own JWT.",
      "It is the substrate the WhatsApp sales agent stands on, and it connects to Claude Desktop through OAuth where the login screen is the buyer's real login: phone number, OTP.",
    ],
    mechanisms: [
      {
        title: "Auth that is real, not a shadow identity",
        body: "OAuth 2.0 with dynamic client registration and PKCE, where the **authorize step is phone + OTP** against the production auth service, and the access token the client receives *is* the buyer's app JWT. Programmatic consumers (the WhatsApp agent) mint a per-buyer JWT server-side; the secret that allows it never leaves the auth layer. Every tool then runs as exactly one buyer, and the data layer's row scoping does the rest.",
      },
      {
        title: "Parity by import, not by test",
        body: "The cart, coupon and deeplink maths are the app's own pure functions imported verbatim, so the agent and the app cannot disagree on a price. When the app's GraphQL operations drifted from live Hasura, thin local overrides were added for just those operations rather than forking the whole layer.",
      },
      {
        title: "The cart that vanished",
        body: "Adding an item worked; opening the cart emptied it. The app's own validation archives any cart whose SKUs aren't orderable from that seller, and the tool had been sourcing SKUs from the global catalogue. Fix: source from the seller-scoped catalogue and price exactly as the app does — MRP × (1 − margin) with the slab picked by quantity. Proven end-to-end: `archivedCart=false, removedItems=[], priceUpdates=[]`.",
      },
      {
        title: "Honest absence",
        body: "Upstream coupon gates fail open and are non-deterministic. A tool that returned an empty list would push the agent into saying \"this brand has no offers\" — which is frequently false. So coupon lookups return the SKUs *without* coupons and a caveat explaining why, and the agent is forbidden from claiming absence. A tool that can't say \"I don't know why\" will be forced to lie.",
      },
      {
        title: "The ₹0-discount bug and the staleness channel",
        body: "A relative-path import silently kept a stale copy of the coupon engine, so the MCP quoted ₹0 on every uncapped coupon while the app charged full price. It was caught by a **cross-surface check** — quote the same cart through the MCP and through the app, compare the totals exactly — before any buyer saw it. Documented as a permanent rule: every shared module needs a staleness channel, or parity is an assumption.",
      },
      {
        title: "A finding reported upstream",
        body: "While building the voucher tools I found an authorization gap in a platform role. It wasn't mine to fix and it wasn't mine to work around; it was reported with a reproduction to the team that owns it.",
      },
    ],
    metrics: [
      { value: "100", label: "tools, each typed and row-scoped", note: "Grew 87 → 93 → 100 across the summer as batches landed: support forms, addresses, payouts, rewards, orders, notifications, referrals, folds, media.", count: { to: 100 } },
      { value: "180 days", label: "refresh-token lifetime", note: "Per-buyer JWT with long refresh, so a Claude Desktop connection survives without re-login; the OTP screen is the only credential a buyer ever types." },
      { value: "48 / 48", label: "read tools OK in the live sweep", note: "A full sweep of the read tools against live Hasura: 48 OK, 0 genuine failures, 1 new bug found and fixed." },
      { value: "₹0", label: "the quote the stale import produced", note: "On every uncapped coupon, while the app charged full price. Caught by the cross-surface check, never seen by a buyer." },
    ],
    honesty: "Business-impact numbers for the MCP itself are not measured yet — its usage flows through the WhatsApp agent's analytics, and attributing revenue to infrastructure would be inference. I'd rather say \"not yet measured\" than invent a number.",
    lessons: ["A tool that can't say \"I don't know why\" will be forced to lie.", "Parity is a property you import, not a test you write.", "Every shared module needs a staleness channel."],
    links: [{ label: "Badho", href: "https://badho.in" }],
  },

  {
    slug: "whatsapp-sales-agent",
    title: "WhatsApp AI Sales Agent",
    short: "A live, tool-using sales agent for retailers that is architecturally unable to claim an order it didn't place — and whose analytics deliberately report worse numbers than they could.",
    tier: 1,
    themes: ["Conversational AI", "Agents", "MCP", "Safety & cost"],
    period: "2026 · Badho · live since Jul 2026",
    stack: ["Python", "Claude Agent SDK", "Buyer MCP", "AiSensy", "Supabase", "Railway"],
    headline: [
      { value: "INR 5.0L", label: "potential value · 475 orders" },
      { value: "₹11,690", label: "causal, exact cart-ID match" },
      { value: "$152.50", label: "total LLM spend", count: { to: 152.5, prefix: "$", decimals: 2 } },
    ],
    context: [
      "Retailers message a WhatsApp number; a Claude agent answers in Hinglish, looks up live prices and offers through the Buyer MCP, builds a cart, sends a deeplink, and files support tickets when something has gone wrong with an order. It is live for every registered buyer.",
      "Two things make it different from a chatbot demo: it is **structurally prevented from lying** about money and orders, and its dashboard reconciles **exactly** against the production replica — including the uncomfortable finding that most of the revenue it looked responsible for wasn't.",
    ],
    mechanisms: [
      {
        title: "Two agents, one voice",
        body: "The tool-using worker reasons; its text is only a draft. A separate **tool-less reply agent** rewrites the final message from that draft plus a FACTS bundle — payable amount, cart link, ticket number — captured from tool results, never from prose. It structurally cannot emit \"waiting for my tools to connect\", and it enforces `aap`, gender-aware address, and `__NO_REPLY__` when a chat is genuinely concluded. On its own failure it fails open to the guarded worker draft.",
      },
      {
        title: "Honesty gates that fire even under bypass",
        body: "`place_order` is blocked for this consumer, so \"your order has been placed\" is always false — and therefore never said. Cancellations are answered from live order state; seller rejections are owned with the refund surfaced. Ticket creation passes three deterministic PreToolUse gates: **callback-only is always denied** (the buyer gets the support line instead), **you must have looked** at existing tickets first (a recorder hook witnesses it), and **no duplicate within 12 hours**. These fire even when the agent runs with permissions bypassed.",
      },
      {
        title: "Reporting worse numbers on purpose",
        body: "Naive attribution credited every order by any buyer who had ever engaged. I measured it: **75% of those orders predated the buyer's first contact** (118 of 157; 64% on the subset where first contact is certain). So the headline tile became \"ordered from our cart\" — an exact `cartId` match on the order, the only causal claim the system can defend — and the other tiles stayed, labelled as correlation. RTO was carved out of Rejected because they were double-counting.",
      },
      {
        title: "The silent-truncation family",
        body: "Supabase caps every select at 1,000 rows with no signal; `.limit(50000)` returns 1,000. **37% of engaged buyers were invisible to attribution.** `list_orders` capped at 10, so the best repeat buyers were truncated. Six background sweeps had died after one run because nothing held a reference and the GC took them mid-sleep — frequent redeploys had masked it. The cost ledger itself was being pruned at seven days, which made \"all-time spend\" structurally impossible. Fixed all four and broadcast the class of bug across every project.",
      },
      {
        title: "Taking the automation tool out of the hot path",
        body: "Replies were arriving hours late, then not at all: the provider's webhooks went through an automation tool whose 15,000-deep FIFO queue had stalled. AiSensy now posts directly; the endpoint acknowledges in ~1 ms, ingests in the background with a held reference, and dedups at ingest so the cutover couldn't double-process.",
      },
      {
        title: "Model tiering and true cost",
        body: "Haiku for greetings, Sonnet for reasoning, and the reply agent rides the same tier as the worker. Every raw SDK call is priced from token usage — cache reads and writes included — so the dashboard's \"LLM cost\" is the real one, and it reconciles exactly to the console.",
      },
    ],
    metrics: [
      { value: "₹5,00,817", label: "full potential value · 475 orders", note: "Every order by a bot-engaged buyer. Correlation, not causation — see the 75% figure. Kept on the dashboard, labelled as such." },
      { value: "₹11,690", label: "ordered from a cart the agent built · 14 orders", note: "Exact cart-ID match on the order. The only number here I would call *caused* by the agent; ₹1,263 of it delivered at the time of measurement." },
      { value: "$152.50", label: "total LLM spend, whole programme", note: "Reconciled exactly to the Anthropic console: buyers $81.60, pre-ledger $70.90, test/dev $0.00. About three weeks of early traces were lost to a retention bug, so the ledger was rebuilt from the console.", count: { to: 152.5, prefix: "$", decimals: 2 } },
      { value: "75%", label: "of naively-credited orders predated first contact", note: "118 of 157 orders on Aug 4; 64% on the gold-standard subset. This is why the headline tile changed.", count: { to: 75, suffix: "%" } },
      { value: "37%", label: "of engaged buyers were invisible to attribution", note: "157 of 429, hidden by the 1,000-row cap. Fixing it added 41 orders to the counts immediately.", count: { to: 37, suffix: "%" } },
      { value: "~1 ms", label: "webhook acknowledgement", note: "Down from hours through the stalled queue. Verified end-to-end with a raw provider payload: 200 in 0.5 s, one inbound, one two-bubble reply, the duplicate deduped." },
    ],
    honesty: "\"INR 5.0L across 475 orders\" is the pipeline's full potential value, not revenue caused by the agent. The defensible causal number is ₹11,690 across 14 orders. I show both because the gap between them is the most useful thing the dashboard says.",
    lessons: ["The metric you report should be the one you'd defend under cross-examination.", "Every paginated API truncates by default until proven otherwise.", "If the agent can't do it, it can't claim it — make the claim impossible, not discouraged."],
    links: [{ label: "Public demo of the WhatsApp agent", href: "https://badho-whatsapp-agent-demo.vercel.app" }],
  },

  {
    slug: "order-lifecycle-automation",
    title: "Order-Lifecycle WhatsApp Automation",
    short: "Event-driven order notifications to the entire buyer base — ten stages, ~500 messages a day, zero errors across eight consecutive days — with its guard architecture built from a real incident.",
    tier: 1,
    themes: ["Pipelines", "Safety & cost", "Conversational AI"],
    period: "2026 · Badho · live since Jul 2026",
    stack: ["Python", "asyncpg", "PostgreSQL (read replica)", "Supabase", "AiSensy", "Railway"],
    headline: [
      { value: "10", label: "order stages", count: { to: 10 } },
      { value: "~500", label: "messages / day", count: { to: 500, prefix: "~" } },
      { value: "0", label: "errors over 8 days", count: { to: 0 } },
    ],
    context: [
      "Every buyer gets told when their order is confirmed, dispatched, out for delivery, delivered, returned, cancelled or partially delivered — in Hindi, with a deeplink, from Meta-approved templates. Four pollers read the order and courier-shipment tables on the read replica; a ledger makes every (order, stage) pair idempotent; an admin dashboard shows every send and has a stop switch.",
      "The interesting part is not the happy path. It is what the system learned from the night it sent 469 wrong messages in fifteen minutes.",
    ],
    mechanisms: [
      {
        title: "The incident",
        body: "An external weight-recomputation job stamped **15,018 order rows with one identical `updated_at`**. The main tick keyed its fetch on that column, saw \"fresh\" COMPLETED rows, mapped them to `delivered`, found nothing in the ledger (they pre-dated go-live), and sent **469 stale \"your order has been delivered\"** messages for orders up to two years old — most as \"your first order\", because the old order usually was. A second, earlier wave had leaked 28 more. Forensics in the audit table proved the trigger was a backend backfill — `updatedColumns = {updated_at, totalWeightInGram}` — not any order activity.",
      },
      {
        title: "The standing rule: `updated_at` is not an event",
        body: "Bulk touches turned out to be routine — six waves over 2,000 rows in fourteen days. So: **no trigger may key on `updated_at` as an event signal, on any table.** Scanning on it is fine (it's the only indexed change signal); every staged message must pass an event-time check — `markedDeliveredTime`, `created_at`, `archiveTime` — or the bulk-cluster guard. Replaying the incident window with the clock frozen: the guard blocked 2,140 stale rows and passed 64 genuine ones.",
      },
      {
        title: "A guard for the tick that has no event column",
        body: "The courier tick can't gate on an event time — the only candidate is missing on ~20% of legitimate rows. Its defence is the bulk job's own signature: **any same-timestamp cluster larger than 50 rows is dropped whole**. The largest natural cluster measured was 9; the bulk waves were 2,600–15,000. Both guards fired in production within minutes of deploy — the cluster guard on a real 276-row reconciliation touch nobody had predicted.",
      },
      {
        title: "Deleting a mapping instead of patching it",
        body: "`COMPLETED → delivered` was removed outright once measured that 100% of marketplace deliveries (1,158 of 1,158 in fourteen days) have a courier row; the main tick's only \"delivered\" output in a week had been 28 stale leaks. The whole stale-delivered attack surface went with it. An earlier version of this change had asked the wrong question of the data and would have silently killed delivery messages for half of all orders — an audit caught it.",
      },
      {
        title: "Scope gates that match on flags, never names",
        body: "Other order flows share the same tables and must never get these messages. Every fetcher joins on the seller's D2R flag. One brand had **seven seller rows with the flag true on exactly one**; a name filter would have silenced a top seller. Verified zero non-D2R sellers across all five fetchers over fourteen days before deploy, at a cost of zero real messages.",
      },
      {
        title: "Fail loud at boot, never infer a refund",
        body: "Three of twelve templates had once been silently dead in production, hidden for hours behind a per-order log line. Now the stage vocabulary is checked against the database constraint at startup and logs loudly on mismatch. And a message that promises a refund is gated on the actual refundable-amount column — a claim-bearing message is never derived from a status.",
      },
    ],
    metrics: [
      { value: "10", label: "stages wired", note: "Confirmed, dispatched, out-for-delivery, delivered, first-delivered, partial, RTO in transit, RTO delivered, cancelled, and a driver-onboarding flow added later.", count: { to: 10 } },
      { value: "~500", label: "messages per day", note: "All buyers, D2R orders only. Expected volume re-measured when the cadence changed.", count: { to: 500, prefix: "~" } },
      { value: "0", label: "errors across 8 consecutive days", note: "Audited against the send ledger and the provider's responses; zero poller failures in the same window.", count: { to: 0 } },
      { value: "497", label: "stale messages — the incident I own", note: "469 in the main wave plus 28 from an earlier one. The rows stay in the ledger as history; deleting them was asked for and declined.", count: { to: 497 } },
      { value: "2,140", label: "stale rows blocked in the replay", note: "Incident fetch window re-run with \"now\" frozen at 20:41 UTC; 64 genuine sends passed.", count: { to: 2140 } },
      { value: "276", label: "rows in the cluster guard's first real catch", note: "A reconciliation job on shipments, twelve mixed statuses, within minutes of deploy. Genuine sends continued in the same tick.", count: { to: 276 } },
    ],
    honesty: "The zero-error figure is real and so is the 497. A notification system that has never sent a wrong message has not been running long enough; what matters is whether the class of failure can recur. Here it cannot, by construction, and the proof is a replay, not a promise.",
    lessons: ["`updated_at` is not an event.", "When a mapping exists only to cover a case you can measure is empty, delete the mapping.", "Match on the flag, never on the name."],
  },

  {
    slug: "delhivery-ops-autopilot",
    title: "Delhivery Ops Autopilot",
    short: "An agent that files real weight claims and tickets against our courier partner's API with no human in the loop — and a single kill switch that stops all of it, and all AI spend, the moment the vendor session dies.",
    tier: 1,
    themes: ["Agents", "MCP", "Safety & cost", "Money paths"],
    period: "2026 · Badho",
    stack: ["Python", "FastAPI", "MCP", "Claude Haiku 4.5", "Supabase", "Railway", "Vercel", "Next.js"],
    headline: [
      { value: "698 + 370", label: "claims + tickets filed in 24 h" },
      { value: "2,143", label: "tickets closed to date", count: { to: 2143 } },
      { value: "1", label: "predicate gates the money", count: { to: 1 } },
    ],
    context: [
      "Couriers overcharge on weight, lose parcels, and leave shipments stuck. Recovering that money used to mean a person filing claims one at a time in a vendor portal. This is a standalone ops product — dashboard, backend, and a bearer-gated remote MCP — that does it autonomously: detects weight discrepancies and files overcharge claims (with **vision over the vendor's own exception photos**), raises NDR / lost / damaged / RTO tickets, chases stuck and overdue shipments, dedups against every open ticket before filing, and drafts replies to vendor responses.",
      "It is the clearest case in my work of an agent taking real, irreversible actions against an external system. The guardrails exist because the failure modes are filing junk claims at a vendor, or burning spend against a dependency that has quietly died.",
    ],
    mechanisms: [
      {
        title: "Session-liveness kill switch",
        body: "`TokenManager.live()` is one predicate on all eight background loops *and* every AI entry point. It is true only while the refresh chain is genuinely usable: token expiry in the future **and** no `_dead` latch. The latch matters because **a revoked token can still look unexpired by its own clock** — it trips the moment the auth server answers `invalid_grant`, and clears when a fresh token is pasted in the dashboard. No redeploy. It fails *open* on a non-JWT refresh token so a healthy session is never falsely paused.",
      },
      {
        title: "Before the fix, 'ready' meant a file existed",
        body: "The readiness check had returned true for any token file that merely existed. With a months-dead session the loops were hitting the vendor's auth server roughly every 2.8 minutes forever — **76 `invalid_grant` responses in 3.5 hours of logs** — free, but pointless traffic against someone else's infrastructure. After: zero in four hours. The AI paths had been safe only by accident, because each happened to hit the vendor first and die there.",
      },
      {
        title: "Fail fast in the client",
        body: "Post-deploy logs showed the loops silent but an 11-call burst in 12 seconds from one MCP client, each call costing a round trip to die. Now every on-demand call — all 30 MCP tools, every dashboard read — short-circuits on a dead session with \"paste a fresh token\" and **zero network traffic**. It still can't die silently: a one-shot Slack alarm fires on the live→dead transition, then everything goes quiet by design.",
      },
      {
        title: "A judge without thresholds",
        body: "The first triage queue was deterministic and produced nonsense like \"0 days past promised — expedite\". Version two lets Claude decide what's critical per stream with a forced tool call. Two tuning bugs worth keeping: ~19 concurrent calls rate-limited the weight stream to *empty* (fixed with a shared semaphore of five), and a \"be thorough\" prompt overran `max_tokens` and truncated to empty (fixed with batches of 25 and a bigger budget). Both failed silently until the run logs carried per-source errors.",
      },
      {
        title: "Writes that can't hammer the vendor",
        body: "Bulk auto-filing is throttled with 429/503 backoff. Every real submission is recorded in a write ledger and surfaced with a deeplink to the vendor's record; dry-run previews the exact payload without firing. Before raising, the system re-queries the vendor per shipment and skips anything that already has an open ticket or claim, so stale flags never double-file. Writes for claim types whose payloads weren't yet captured live stay in preview until they are.",
      },
    ],
    metrics: [
      { value: "698 + 370", label: "weight claims + tickets auto-filed in 24 h", note: "Snapshot 2026-08-12, plus 19 responses drafted and sent to vendor replies." },
      { value: "2,143", label: "tickets closed to date", note: "Cumulative at the same snapshot.", count: { to: 2143 } },
      { value: "₹41,480 / ₹12,736", label: "claims raised / recovered", note: "Raised is not recovered; both shown. The wallet view tracks ₹13.8L on delivered against ₹8.8L of RTO loss." },
      { value: "76 → 0", label: "pointless auth calls per 3.5 h", note: "Keycloak `invalid_grant` responses from the loops before and after the liveness gate; verified in production logs." },
      { value: "30", label: "MCP tools, bearer-gated", note: "The same capability exposed to any Claude client, guarded by the same liveness predicate.", count: { to: 30 } },
    ],
    honesty: "Claims raised and money recovered are different numbers and I show both. Throughput figures are a one-day snapshot, not a sustained rate — the session was deliberately left paused for a period while the guards above were built and verified.",
    lessons: ["An agent that acts on an external system needs a way to stop that doesn't depend on the thing that broke.", "Expiry is not liveness.", "A deterministic threshold you can't justify is worse than a judgement you can audit."],
  },

  {
    slug: "live-money-paths",
    title: "Live money paths — referral credits & QR cashback",
    short: "Two real-rupee systems run end to end: a multi-leg refer-and-earn with 361 of 361 bonuses credited, and carton-QR cashback where double credit is physically impossible.",
    tier: 1,
    themes: ["Money paths", "Safety & cost", "Pipelines"],
    period: "2026 · Badho",
    stack: ["Next.js", "Supabase", "Python poller", "Hasura", "PostgreSQL", "AiSensy", "GA4", "Vercel", "Railway"],
    headline: [
      { value: "361 / 361", label: "bonuses credited, zero misses" },
      { value: "₹42,030", label: "paid out across three legs" },
      { value: "1", label: "unique index is the whole guarantee", count: { to: 1 } },
    ],
    context: [
      "**Refer-and-earn:** an existing buyer shares a code, a new buyer enters it at signup, and wallet cash goes to both — ₹100 to the referred buyer at signup, ₹50 to the referrer on the referred buyer's **first delivered order**, never on signup alone. A Next.js buyer webview with app-injected auth (one link serves every buyer), a Supabase credit service, a poller that releases rewards on delivery, and WhatsApp status updates.",
      "**Package scratch:** every carton carries the same QR. Scan it in the app, scratch a card, and get 5% of the delivered order value back, capped at ₹100. Designed so that a QR on a discarded box is worth nothing to anyone.",
    ],
    mechanisms: [
      {
        title: "The QR is not a bearer token",
        body: "The code is constant across every package and carries **no order, no buyer, no secret**. Identity comes from the app, which substitutes the logged-in buyer's token on open. If buyer B scans buyer A's carton, the page opens as B, looks up B's own delivered orders, and pays B only what B is owed — or shows \"no reward yet\". The cross-buyer theft case isn't defended against; it is designed out.",
      },
      {
        title: "No double credit — structural, not best-effort",
        body: "One partial unique index on the wallet ledger is the entire guarantee. The claim **writes first and lets Postgres arbitrate** — a second insert is physically unstorable and comes back as `ALREADY_CLAIMED`. There is no check-then-write window because there is no gap. It holds under double-tap, two devices, a retried serverless call, a redeploy mid-flight, replica lag, and a different buyer entirely — the key is the order alone, deliberately. The wallet table *is* the claim ledger; there is no second source of truth on a money path.",
      },
      {
        title: "Identity proven upstream, no secret to leak",
        body: "The buyer ID is read only from signed token claims, never from a URL or body parameter, and then proven by calling the platform *as that buyer*. A forged or expired token is rejected there and never reaches the credit path. The service holds no signing secret. Every gate re-runs at payment time, not just at preview, and already-claimed is read from the primary, not the lagging replica.",
      },
      {
        title: "Adversarial audit against live production",
        body: "Probed the deployed money path directly. No identity → `MISSING_TOKEN`. Forged buyer ID in body *and* query → ignored, `AUTH_FAILED`. Nominated order and `amount: 99999` → both ignored. **Valid-shaped JWT with a real buyer ID and a fake signature → `REJECTED_UPSTREAM`.** Dev-mode probe as a non-dev → nothing returned. Every attempt failed closed; the client cannot choose anything, and a tampered amount is not just rejected — it is never consulted.",
      },
      {
        title: "Referrals: pay on delivery, backfill on failure",
        body: "The credit poller reads pending referrals every 180 seconds, finds the referred buyer's first delivered order on the read replica, credits through the platform, and flips the row. It also backfills the referred buyer's signup bonus if that credit ever failed. Both legs are idempotent through a partial unique index of their own. A ₹10 referrer-signup leg was added later, modularly, and proven live on real money.",
      },
    ],
    metrics: [
      { value: "361 / 361", label: "signup bonuses paid", note: "Every referred buyer got ₹100; zero missed credits across 361 referrals from 254 referrers. Live figures, 2026-08-19." },
      { value: "₹42,030", label: "paid out across all three legs", note: "₹36,100 to referred buyers, ₹5,930 to referrers (₹50 delivery + ₹10 signup legs)." },
      { value: "5 / 5", label: "attack paths failed closed", note: "Adversarial audit against the live scratch endpoint; see the table in the mechanism above." },
      { value: "5% · cap ₹100", label: "scratch reward rule", note: "`min`, not `max`, of 5% of delivered order value and ₹100 — confirmed against the live config, one scratch per delivered order." },
      { value: "1", label: "partial unique index", note: "`WHERE comment = 'Package scratch reward'` — the predicate is mandatory because 96,663 orders already carry more than one wallet row. Verified valid on production before go-live.", count: { to: 1 } },
    ],
    honesty: "The 100%-paid figure is the one that matters engineering-wise: a money path with zero missed credits. Conversion and activation are product metrics and I leave them to the product dashboard.",
    lessons: ["Fail closed on money. Guarantees belong at the database, never in app logic.", "Don't defend against the attack — design it out.", "A retry that can never double-pay is a retry you can offer the user."],
  },

  {
    slug: "aditya-mcp",
    title: "Aditya MCP — agents auditing agents",
    short: "A read-only MCP server that mines my own AI coding sessions, git history and handoff docs across every project, and powers scheduled routines that keep documentation honest.",
    tier: 1,
    themes: ["MCP", "Agents", "Pipelines"],
    period: "2026 · personal",
    stack: ["Python", "MCP (stdio)", "git", "Claude Code scheduled tasks"],
    headline: [
      { value: "7", label: "read-only tools", count: { to: 7 } },
      { value: "26 / 27", label: "repos / handoff docs found live" },
      { value: "0", label: "network calls, secrets, writes", count: { to: 0 } },
    ],
    context: [
      "I run many projects, each with a handoff doc that a new session reads first. Docs go stale; sessions get forgotten; \"what did I do yesterday\" becomes an archaeology task. This server answers it from ground truth: it walks two folders on every call, discovers every git repo, every `*HANDOFF*.md`, and every Claude Code session whose recorded working directory falls under them — **nothing project-specific is a static list**.",
      "It powers two scheduled routines: a daily cross-project work report, and a companion that detects handoff docs older than their project's last activity and messages the responsible session to fix them. The research for this website was done through it.",
    ],
    mechanisms: [
      {
        title: "Fully dynamic discovery",
        body: "Drop a new project folder under a scan root and it's covered immediately — no config edit, no restart of the discovery logic. Same-named docs in different worktrees are labelled by relative path so they never collide. Sessions are matched by peeking each candidate's recorded `cwd`, not by folder naming, which is how a session started from a brand-new folder gets caught.",
      },
      {
        title: "Correct about its own blind spots",
        body: "`git log` cannot see uncommitted work, which in worktrees can be thousands of lines. A session that was resumed inside the window but whose content is from another day should not count. The server's own handoff documents a known omission in one date-range query rather than hiding it, and instructs every consumer to reconcile its session list against a second, independent source before reporting \"no activity\".",
      },
      {
        title: "Dashboard links that discover themselves",
        body: "A curated, human-labelled link map is the only hand-maintained part. Every other production URL on an allow-listed domain found inside a handoff doc or README is surfaced automatically, grouped by project — so a new project's prod URL shows up the moment it's written down.",
      },
    ],
    metrics: [
      { value: "26 / 27", label: "git repos / handoff docs discovered", note: "Live scan result on 2026-08-22, across two scan roots. The number changes whenever a folder appears." },
      { value: "7", label: "tools", note: "sessions, commits, handoff entries, freshness, known projects, dashboard links, and one bundled work-report call.", count: { to: 7 } },
      { value: "0", label: "network calls, secrets, writes", note: "Local stdio only; `git log` and file reads. Registered both project-scoped and globally so scheduled tasks can use it.", count: { to: 0 } },
    ],
    honesty: "This is infrastructure for my own workflow, not a product; its value is that the reports it produces are verified against git and session logs rather than remembered. Its one known defect is documented in its own handoff.",
    lessons: ["A report you can't verify is a story.", "Tell consumers what you cannot see."],
  },

  // ── Tier 2 ───────────────────────────────────────────────────────────────
  {
    slug: "semantic-search",
    title: "Semantic Search Engine",
    short: "Sub-100 ms product search combining semantic, phonetic and exact matching for Indian-English spelling variation.",
    tier: 2,
    themes: ["Retrieval & matching"],
    period: "2025 · Badho",
    stack: ["Python", "Flask", "FAISS", "Ollama", "PostgreSQL", "Docker", "EC2"],
    headline: [{ value: "<100 ms", label: "query latency" }],
    detail: [
      "An in-memory FAISS index with query embeddings computed on the fly by a local Ollama container (`nomic-embed-text`), fused with Postgres full-text search and `dmetaphone` so that \"parle\", \"parley\" and \"paarle\" land on the same product. Multi-container Docker on EC2.",
    ],
  },
  {
    slug: "sister-products",
    title: "Sister Products Clustering",
    short: "Grouping same-brand, different-size products across 85,000+ SKUs with an algorithm that switches itself by brand size.",
    tier: 2,
    themes: ["Retrieval & matching"],
    period: "2025 · Badho",
    stack: ["Python", "FastAPI", "scikit-learn", "HDBSCAN", "K-Means", "all-MiniLM-L6-v2", "Docker", "Nginx"],
    headline: [{ value: "85,000+", label: "SKUs clustered", count: { to: 85000, suffix: "+" } }, { value: "40% → 60%", label: "sister-product conversion" }],
    detail: [
      "HDBSCAN finds density blobs on small and medium brands; above ~1,000 SKUs it switches to K-Means to hold sub-second latency. Similarity is a hybrid of semantic (Euclidean over MiniLM embeddings) and string (Levenshtein) distance. Impact: the sister-product modal opened 5× more often and conversion through it rose from 40% to 60%.",
    ],
  },
  {
    slug: "product-matcher",
    title: "AI Product Matcher & Price Intelligence",
    short: "Mapping 170,000+ external SKUs from Amazon, ApnaKlub and Hyperpure onto the internal catalogue with a cost-tiered funnel.",
    tier: 2,
    themes: ["Retrieval & matching", "Safety & cost"],
    period: "2025 · Badho",
    stack: ["Typesense", "PostgreSQL (pg_trgm)", "LLMs", "n8n", "Hasura", "React"],
    headline: [{ value: "170,000+", label: "external SKUs matched", count: { to: 170000, suffix: "+" } }],
    detail: [
      "Exact match → trigram candidates → a batched LLM only for genuine ambiguity (100 g versus 200 g), so token spend is proportional to difficulty rather than volume. Extended into a brand-scoped price-gap dashboard comparing internal against competitor pricing.",
    ],
  },
  {
    slug: "call-qa",
    title: "Serverless Multimodal Call QA",
    short: "Automated auditing of every recorded sales call, replacing a manual QA sample with 100% coverage.",
    tier: 2,
    themes: ["Pipelines"],
    period: "2025 · Badho",
    stack: ["AWS Lambda", "Node.js", "Gemini 2.5 Pro", "API Gateway", "PostgreSQL", "Metabase"],
    headline: [{ value: "100%", label: "call coverage", count: { to: 100, suffix: "%" } }],
    detail: [
      "Audio is fed directly to the model alongside campaign-specific questions — was the combo pitched? what was the tone? — returning structured JSON verdicts into Postgres and Metabase. No transcription step, no sampling.",
    ],
  },
  {
    slug: "catalog-metadata",
    title: "Catalog Metadata Standardization",
    short: "Turning unstructured product descriptions into filterable facets, without letting the model invent new keys.",
    tier: 2,
    themes: ["Pipelines"],
    period: "2025 · Badho",
    stack: ["n8n", "Gemma 12B", "OpenAI Batch API", "PostgreSQL"],
    headline: [{ value: "25,000+ → ~5,000", label: "legacy keys → canonical keys" }],
    detail: [
      "A two-step, schema-first flow: generate a strict category schema, then inject it as context so the extraction model cannot hallucinate new keys. Normalised 25,000+ fragmented legacy keys into about 5,000 canonical ones.",
    ],
  },
];

export const tier1 = projects.filter((p) => p.tier === 1);
export const tier2 = projects.filter((p) => p.tier === 2);
export const bySlug = (slug: string) => projects.find((p) => p.slug === slug);

// Headline numbers for the home page strip. Each says how it was measured.
export const heroMetrics: Metric[] = [
  { value: "−84%", label: "agent cost per day", note: "$67 → $11, traced per turn", count: { to: 84, prefix: "−", suffix: "%" } },
  { value: "100", label: "MCP tools, row-scoped per buyer", note: "one OAuth login, one JWT", count: { to: 100 } },
  { value: "361 / 361", label: "referral bonuses credited", note: "zero misses, real rupees" },
  { value: "2,143", label: "courier tickets closed by an agent", note: "plus 698 claims in one day", count: { to: 2143 } },
  { value: "0", label: "errors in 8 days of order messaging", note: "~500 messages a day", count: { to: 0 } },
];
