# adityamukhopadhyay.vercel.app

Personal portfolio of Aditya Mukhopadhyay — AI Engineer. Next.js (App Router) static export,
Tailwind v4, `motion`. Content lives in `src/content/` (profile, projects, diagrams, resume);
the resume page renders the exact copy of the one-page PDF in `public/`.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export → out/
```

## Deploy (personal Vercel account only)

The CLI's default login on this machine is the **work** account — never use it. Deploy with
the personal scoped token (kept outside the repo) and the personal scope, from this directory:

```bash
vercel deploy --prod --yes \
  --token "$(cat '/Users/adityamukhopadhyay/personal practice/personal/Investments/data/vercel-token')" \
  --scope adityamukhopadhyays-projects
```

Verify the identity first if unsure — it must print `adityamukhopadhyay`:

```bash
vercel whoami --token "$(cat '…/Investments/data/vercel-token')" --scope adityamukhopadhyays-projects
```

## Updating the resume

Regenerate the PDF with `../build_resume.py`, promote it to `../Aditya_Mukhopadhyay_Resume_canon.pdf`,
copy it to `public/Aditya_Mukhopadhyay_Resume.pdf`, and mirror any copy change in `src/content/resume.ts`.
