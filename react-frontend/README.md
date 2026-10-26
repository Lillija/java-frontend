# React frontend · Laravel REST API

React (Vite) single-page client for the course backend
[zirodev23/laravel-api](https://github.com/zirodev23/laravel-api) — the **second** implementation of the
same task that lives in this repository next to the vanilla JavaScript one (`public/`).

## What it does

| Feature | Where |
|---|---|
| AJAX calls without page reload — **Fetch API + async/await** | `src/api.ts` |
| REST endpoints: `GET/POST /posts`, `DELETE /posts/{id}`, `GET/POST /posts/{id}/comments`, `POST /login`, `POST /logout` | `src/api.ts` → `fetchPosts`, `createPost`, … |
| DOM rendered by React from JSON (`useState` / `useEffect`) | `src/App.tsx`, `src/components/PostCard.tsx` |
| Loading spinner + top progress bar (requirement 4) | `src/components/Spinner.tsx`, `.top-progress` in `src/index.css` |
| Live request log (proof of background requests) | `src/components/NetworkLog.tsx` |
| Session (Sanctum Bearer token) kept in `localStorage` | `src/api.ts` → `saveSession` / `getToken` |
| Strict **TypeScript** types for every API shape (`User`, `Post`, `Comment`, …) | `src/api.ts` → `interface`s |
| Automated tests: 18 Vitest unit tests + jsdom smoke tests | `tests/unit/`, `../tests/react-smoke.mjs` |
| CI on every push to `main` (lint → typecheck → build → test) | `../.github/workflows/ci.yml` |

## Run it

```bash
# 1) API on :8000 (from the repository root)
npm run api          # = cd laravel-api && php artisan serve --port=8000

# 2) React dev server on :5173
npm run react        # = npm --prefix react-frontend run dev
```

Open **http://localhost:5173** and log in with `admin@example.com` / `password`.

The API answers with `Access-Control-Allow-Origin: *`, so the browser accepts cross-origin calls from
`:5173` (and from the vanilla app on `:3000`). Point the client to another host with
`VITE_API_BASE=http://localhost:8000/api npm run react`.

```bash
npm run react:build   # production build → react-frontend/dist
```

## CSR in one paragraph

Vite ships a nearly empty `index.html` (`<div id="root">` + one JS bundle). The browser downloads the
bundle, React renders the whole interface client-side and re-renders it after every API response — the
document itself is **never** reloaded. That is *Client-Side Rendering*; the alternative
(*Server-Side Rendering* and *Hydration*) is described in the root `README.md` and on the
**About** page of the vanilla app.

## Project structure

```
react-frontend/
  index.html          — the CSR shell (empty #root)
  vite.config.ts      — dev server + React plugin
  vitest.config.ts    — Vitest (jsdom environment) for the unit tests
  tsconfig.json       — strict TS compiler options (check only, Vite emits)
  src/
    main.tsx          — createRoot(...).render(<App />)
    App.tsx           — state, data loading, layout
    api.ts            — Fetch wrapper, auth token, network log, API types
    vite-env.d.ts     — VITE_* env variable declarations
    index.css         — styling
    components/
      Spinner.tsx         loading indicator
      LoginForm.tsx       POST /api/login
      NewPostForm.tsx     POST /api/posts
      PostCard.tsx        post + comments (GET/POST /posts/{id}/comments, DELETE /posts/{id})
      NetworkLog.tsx      in-page request log
  tests/
    setup.ts          — jest-dom matchers + cleanup between tests
    unit/             — Vitest + Testing Library tests (AI-generated)
    smoke-entry.tsx   — app entry bundled for the jsdom smoke test
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR (port 5173) |
| `npm run build` | Type-check (`tsc --noEmit`) + production build to `dist/` |
| `npm run typecheck` | TypeScript check only, no output files |
| `npm run preview` | Serve the production build |
| `npm run lint` | oxlint (understands `.ts`/`.tsx` natively) |
| `npm test` | Vitest unit tests (jsdom) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:smoke` | Bundle the app and drive it in jsdom (`../tests/react-smoke.mjs`) |

## TypeScript vs JavaScript — what changed

* **Types at compile time**: `interface Post { id: number; user_id: number; … }` — typos like
  `post.userid` or `post.id.toFixed()` on a string are caught by `tsc`, not by the browser console.
* **`strict` mode**: `strictNullChecks` forces explicit handling of `null`/`undefined`
  (e.g. `document.getElementById('root')` returns `HTMLElement | null`).
* **`catch (err)` is `unknown`**: every error is narrowed (`err instanceof Error ? err.message : …`)
  via the shared `errorMessage()` helper instead of blindly reading `.message`.
* **Generics instead of `any`**: `api<Post[]>('/posts')` returns a typed promise, so
  `setPosts(await fetchPosts())` is checked end-to-end. `unknown` is used where the shape is
  genuinely dynamic (JSON parsed from the network).
* **No runtime cost**: types are erased (`erasableSyntaxOnly`); esbuild/Vite transpiles as before.

## Continuous integration

`.github/workflows/ci.yml` (repository root) runs on **every push to `main`**:

1. **Lint & typecheck** — `oxlint` + `tsc --noEmit`
2. **Build** — `npm run build` (strict type-check must pass first)
3. **Test** — Vitest unit tests, the React jsdom smoke test and the vanilla JS regression test

Follow the runs under **GitHub → Actions**.
