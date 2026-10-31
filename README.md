# Chess Coach

Chess Coach is a dependency-free static website for learning chess through play. It runs on GitHub Pages, Vercel, or any static host.

## Run locally

```bash
npm run dev
```

The site uses a lightweight in-browser coach today: legal move validation, simple positional evaluation, move suggestions, and explanations after every move. The engine status is intentionally surfaced in the UI so a future Stockfish WebAssembly worker can replace the fallback without changing the teaching interface.

## Deploy

- **GitHub Pages:** enable Pages for the repository's main branch and select the root (`/`) as the source.
- **Vercel:** import the repository, leave the build command empty (or use `npm run build`), and set the output directory to `.`.
