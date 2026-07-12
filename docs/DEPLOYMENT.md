# Deployment Guide

InsightForge builds to a folder of static files (HTML/CSS/JS) — it can be
hosted anywhere that serves static files: GitHub Pages, Netlify, Vercel,
Cloudflare Pages, S3, or your own web server. No server-side runtime is
required.

## Local build

```bash
npm install
npm run build
```

Output goes to `dist/`. Preview it locally with `npm run preview`.

## GitHub Pages (used for the official demo)

1. Set `base` in `vite.config.ts` to `/<your-repo-name>/` if deploying to a
   project page (already set for the official demo).
2. Build: `npm run build`.
3. Publish the `dist/` folder to the `gh-pages` branch (a GitHub Actions
   workflow can automate this — see `.github/workflows/deploy.yml` if
   included in your package).
4. Enable GitHub Pages in the repository settings, pointing at the `gh-pages`
   branch (or `docs/` folder, depending on your chosen workflow).

## Netlify / Vercel

Both platforms auto-detect a Vite project:
- Build command: `npm run build`
- Output directory: `dist`
- No environment variables are required.

## Any static file server

Copy the contents of `dist/` to your web root. The app is a single-page
application with no client-side routing that depends on server rewrites (all
navigation is in-memory), so no special server configuration is needed beyond
serving `index.html` and the static assets.

## Custom domain / subpath

If deploying to a subpath (e.g. `example.com/tools/insightforge/`), set the
`base` option in `vite.config.ts` to match before building.

## What you do NOT need to deploy

- A database
- A backend API
- Environment secrets
- A CDN for external chart/map assets (none are used)
