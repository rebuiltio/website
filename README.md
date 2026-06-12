# website

The public landing page for **Rebuilt Health** — [rebuilt.health](https://rebuilt.health).

A single static `index.html`, zero build step. On-brand via `@rebuilt/ui` token values (mirrored inline so it deploys as one file).

## Local preview

```bash
python3 -m http.server 8088
# → http://localhost:8088
```

## Deploy

Served via **GitHub Pages** from `main` (repo root). Custom domain `rebuilt.health` is set in `CNAME`. The social-preview card (`og.png`) is generated from `og.html`.
