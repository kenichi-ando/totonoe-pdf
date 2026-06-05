# Totonoe PDF

Browser-based PDF utility for splitting spread pages and interleaving front/back scans.

## End User Guide

For usage instructions, open the website:

- https://totonoe-pdf.pages.dev/

## Developer Notes

This repository is a static web app (HTML/CSS/JavaScript) with no build step.

### Local Development

1. Clone the repository and move into the project directory.
2. Start a local static server (recommended):

```bash
python3 -m http.server 8080
```

3. Open `http://localhost:8080` in your browser.

Alternative:

- Open `index.html` directly in your browser (no server).

### Hosting

Hosted on Cloudflare Pages with GitHub auto-deploy.

One-time setup in the Cloudflare dashboard (Pages → Create a project → Connect to Git):

- Production branch: `main`
- Build command: (leave empty)
- Build output directory: `public`

After connecting, every push to `main` deploys automatically to
`https://totonoe-pdf.pages.dev/`.

#### Manual deploy (fallback)

If the GitHub connection is broken (the Pages project shows
"disconnected from your Git account"), deploy directly with Wrangler:

```bash
wrangler pages deploy public --project-name=pdf-utility --branch=main
```

`--branch=main` makes it a Production deploy so it reaches
`https://totonoe-pdf.pages.dev/`.
