import { profile } from "@/content/profile";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {profile.name.first} {profile.name.last}. Every number on this site is
          measured, not estimated — and says how.
        </p>
        <div className="flex gap-4">
          <a className="hover:text-ink" href={`mailto:${profile.email}`}>
            Email
          </a>
          <a className="hover:text-ink" href={profile.links.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="hover:text-ink" href={profile.links.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}
