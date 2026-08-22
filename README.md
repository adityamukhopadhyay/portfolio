# adityamukhopadhyay.vercel.app

Personal portfolio — Next.js (static export) + Tailwind + motion.

- Copy lives only in `src/content/*.ts`. The resume page renders the PDF's exact text from `src/content/resume.ts`.
- `public/Aditya_Mukhopadhyay_Resume.pdf` must stay byte-identical to `../Aditya_Mukhopadhyay_Resume_canon.pdf`.

```
npm run dev                       # local
npm run build && npx serve out    # static export, served locally
vercel --global-config ~/.vercel-personal deploy --prod --yes   # deploy (personal Vercel account)
```
