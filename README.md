# website

The public site for **Rebuilt Health** — [rebuilt.health](https://rebuilt.health).

This repo holds the built, static output only. The source lives in
[Belfiore/work-own-hero](https://github.com/Belfiore/work-own-hero) (TanStack Start, synced with Lovable).

## Updating the site

In the source repo:

```sh
bun run build
node scripts/export-static.mjs
```

Then copy `dist/static/` over this repo's root (keep `CNAME`, `og.png`, `og.html`, `README.md`) and push to `main`.

## Local preview

```sh
python3 -m http.server 8088
# → http://localhost:8088
```

## Deploy

Served via GitHub Pages from `main` (repo root). Custom domain `rebuilt.health` is set in `CNAME`. The social-preview card (`og.png`) is generated from `og.html`.
