import type { Metadata } from "next";
import { PersonalTracker } from "@/components/PersonalTracker";

export const metadata: Metadata = {
  title: "Ops",
  robots: { index: false, follow: false },
};

export default function PersonalPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 pt-12 sm:pt-16">
      <PersonalTracker />
    </main>
  );
}
