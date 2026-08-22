// Layout of the "number constellation" on the home page. Positions are
// percentages of the stage; z is depth in px (positive = toward the viewer).
// The number is the hook; the label is two or three words.

export type ClusterNode = { slug: string; x: number; y: number; z: number; size: "lg" | "md" | "sm"; value: string; label: string };

export const CLUSTER: ClusterNode[] = [
  { slug: "delivery-fleet", x: 50, y: 44, z: 90, size: "lg", value: "−84%", label: "agent cost" },
  { slug: "buyer-mcp", x: 21, y: 30, z: 30, size: "md", value: "100", label: "MCP tools" },
  { slug: "whatsapp-sales-agent", x: 79, y: 28, z: 10, size: "md", value: "INR 5.0L", label: "WhatsApp sales" },
  { slug: "delhivery-ops-autopilot", x: 81, y: 72, z: 40, size: "md", value: "2,143", label: "tickets closed" },
  { slug: "live-money-paths", x: 52, y: 84, z: -20, size: "md", value: "361 / 361", label: "bonuses credited" },
  { slug: "order-lifecycle-automation", x: 19, y: 72, z: -50, size: "sm", value: "0", label: "errors / 8 days" },
  { slug: "aditya-mcp", x: 50, y: 10, z: -70, size: "sm", value: "7", label: "read-only tools" },
];

// Hand-picked relatedness (shared themes), kept sparse on purpose.
export const LINKS: [string, string][] = [
  ["delivery-fleet", "buyer-mcp"],
  ["delivery-fleet", "whatsapp-sales-agent"],
  ["delivery-fleet", "delhivery-ops-autopilot"],
  ["buyer-mcp", "whatsapp-sales-agent"],
  ["buyer-mcp", "aditya-mcp"],
  ["delivery-fleet", "aditya-mcp"],
  ["whatsapp-sales-agent", "order-lifecycle-automation"],
  ["order-lifecycle-automation", "live-money-paths"],
  ["delhivery-ops-autopilot", "live-money-paths"],
];

export const ORB_PX = { lg: 116, md: 96, sm: 84 } as const;
