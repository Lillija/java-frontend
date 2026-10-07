# React frontend · Laravel REST API

React (Vite) single-page client for the course backend
[zirodev23/laravel-api](https://github.com/zirodev23/laravel-api) — the **second** implementation of the
same task that lives in this repository next to the vanilla JavaScript one (`public/`).

## What it does

| Feature | Where |
|---|---|
| AJAX calls without page reload — **Fetch API + async/await** | `src/api.js` |
| REST endpoints: `GET/POST /posts`, `DELETE /posts/{id}`, `GET/POST /posts/{id}/comments`, `POST /login`, `POST /logout` | `src/api.js` → `fetchPosts`, `createPost`, … |
| DOM rendered by React from JSON (`useState` / `useEffect`) | `src/App.jsx`, `src/components/PostCard.jsx` |
| Loading spinner + top progress bar (requirement 4) | `src/components/Spinner.jsx`, `.top-progress` in `src/index.css` |
| Live request log (proof of background requests) | `src/components/NetworkLog.jsx` |
| Session (Sanctum Bearer token) kept in `localStorage` | `src/api.js` → `saveSession` / `getToken` |

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
  vite.config.js      — dev server + React plugin
  src/
    main.jsx          — createRoot(...).render(<App />)
    App.jsx           — state, data loading, layout
    api.js            — Fetch wrapper, auth token, network log
    index.css         — styling
    components/
      Spinner.jsx         loading indicator
      LoginForm.jsx       POST /api/login
      NewPostForm.jsx     POST /api/posts
      PostCard.jsx        post + comments (GET/POST /posts/{id}/comments, DELETE /posts/{id})
      NetworkLog.jsx      in-page request log
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR (port 5173) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | oxlint |
