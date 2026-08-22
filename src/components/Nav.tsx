import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { profile } from "@/content/profile";

const links = [
  { href: "/#work", label: "Work" },
  { href: "/#experience", label: "Experience" },
  { href: "/#contact", label: "Contact" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 md:bg-bg/85 md:backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
        <Link href="/#about" className="serif-lesson text-[26px] leading-none text-ink transition-colors hover:text-accent">
          Who Am I?
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="nav-link hidden rounded-md px-3 py-1.5 text-muted transition-colors hover:text-ink sm:inline-block"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/resume"
            className="ml-1 rounded-md border border-line px-3 py-1.5 text-muted transition-colors hover:border-rule hover:text-ink"
          >
            Resume
          </Link>
          <span className="ml-2">
            <ThemeToggle />
          </span>
        </nav>
      </div>
    </header>
  );
}
