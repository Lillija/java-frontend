# My Blog — Vanilla JS + React frontends for a Laravel REST API

Course project (WEB frontend). **Two frontends** talk to the same backend
([zirodev23/laravel-api](https://github.com/zirodev23/laravel-api)) with AJAX — **no page reloads**,
everything is rendered with DOM manipulation / React state:

| Frontend | Stack | URL | Folder |
|---|---|---|---|
| #1 Vanilla | plain JavaScript, XMLHttpRequest + Fetch API | http://localhost:3000 | `public/` |
| #2 React | React 19 + Vite (CSR) | http://localhost:5173 | `react-frontend/` |
| Backend | Laravel 13 + Sanctum, SQLite | http://localhost:8000/api | `laravel-api/` (git submodule) |

## Requirements → implementation

| # | Requirement | Where |
|---|-------------|-------|
| 1 | Free REST API tested with query parameters (Postman) | **Free API Lab** page — Open-Meteo geocoding + forecast (`name`, `count`, `latitude`, `longitude`, `current`, `daily`, `timezone`, `forecast_days`) and icanhazdadjoke (`term`, `limit`, `page`). The exact request URL with its query string is displayed under every card, exactly as in Postman. Ready-to-run **[Postman collection](postman/README.md)** (14 requests, 47 assertions). |
| 2 | "Vanilla" JS project using AJAX against this project's API | `public/app.js` calls `/api/login`, `/api/logout`, `/api/posts`, `/api/posts/{id}`, `/api/posts/{id}/comments` with a Sanctum Bearer token. |
| 3 | DOM manipulation without page reload, **two methods for the same task** | Toolbar switch: **XMLHttpRequest (Promises)** ⇄ **Fetch API (async/await)**. Every action (load/create/delete post, comments, login, weather, jokes) runs through whichever method is selected — identical result, only the transport changes. |
| 4 | Loading spinner / progress bar | Animated progress bar at the top of the window, spinner while posts load, inline spinners in the API lab, busy states on buttons. |
| 5 | React frontend for the Laravel backend | `react-frontend/` — Vite + React 19 SPA: login, posts, create/delete, comments, spinner, in-page network log. |
| 6 | Research: SSR, CSR, Hydration | [SSR vs CSR vs Hydration](#ssr-vs-csr-vs-hydration) below + the **About** page of the vanilla app. |
| 7 | WSL Ubuntu ready for new React apps | [Setting up WSL for React](#setting-up-wsl-ubuntu-for-react). |

Extras: 📶 **Network log** (bottom-right in both frontends) lists every AJAX call with method, URL,
status, which technique was used and its duration — handy when the work is checked.

## How to run

Three terminals (or background processes):

```bash
# 1) Backend REST API  ->  http://localhost:8000/api
cd laravel-api
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed
php artisan serve --host=0.0.0.0 --port=8000      # or: npm run api  (from the repo root)

# 2) Vanilla JS frontend  ->  http://localhost:3000
npm install
npm start                                          # or: python3 serve.py (port 8080)

# 3) React frontend  ->  http://localhost:5173
npm run react
```

Demo login: **admin@example.com** / **password** (every seeded user uses `password`).

> **PHP note:** this machine's system PHP is 8.3 without the required extensions, so the API runs with
> the PHP 8.4 binary from herd-lite:
> `export PATH="$HOME/.config/herd-lite/bin:$PATH" && php artisan serve`.

Fresh clone of this repository:

```bash
git clone --recurse-submodules https://github.com/Lillija/java-frontend.git
```

(`laravel-api` is a submodule pointing at the teacher's repository.)

## Tests

```bash
npm test
```

Builds the React bundle and mounts **both** frontends in jsdom with fake `XMLHttpRequest`/`fetch`,
then checks every requirement end-to-end (posts rendering, XHR ⇄ Fetch switch, spinner/progress bar,
login, create/delete post, comments, weather + jokes with query parameters).
See `tests/vanilla-smoke.mjs` and `tests/react-smoke.mjs`.

### API tests (Postman / Newman)

```bash
npm run postman        # requires the API on :8000
```

Runs [`postman/Free-API-Lab.postman_collection.json`](postman/README.md) with Newman — the same
engine as Postman — against the live free APIs and the Laravel API: 14 requests, 47 assertions.

## Files

```
public/                — VANILLA JS frontend
  index.html           — pages: Home, Free API Lab, Profile, About (SSR/CSR/Hydration), Contact, Login
  app.js               — AJAX layer (XHR + fetch), auth, posts, comments, likes, API lab, network log
  styles.css           — UI styling
react-frontend/        — REACT frontend (CSR, Vite)
  src/App.jsx          — state + data loading
  src/api.js           — Fetch wrapper, token storage, network log
  src/components/      — Spinner, LoginForm, NewPostForm, PostCard, NetworkLog
  tests/               — jsdom smoke-test entry + Vite config
laravel-api/           — backend REST API (submodule: Laravel + Sanctum + SQLite)
postman/               — task 1: importable Postman collection (free REST APIs + query params)
  Free-API-Lab.postman_collection.json — 14 requests with pm.test assertions
  README.md            — how to run it (Postman or newman) and what every parameter changes
tests/                 — automated smoke tests (npm test)
server.js              — Express static server on port 3000
serve.py               — alternative Python static server on port 8080
```

## API endpoints used

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/login` | — (returns a token) |
| POST | `/api/logout` | Bearer |
| GET | `/api/posts` | — |
| POST | `/api/posts` | Bearer (`title`, `body`) |
| DELETE | `/api/posts/{post}` | Bearer (owner) |
| GET | `/api/posts/{post}/comments` | — |
| POST | `/api/posts/{post}/comments` | Bearer (`content`) |

## Testing free APIs in Postman

Everything below is also callable from the **Free API Lab** page of the vanilla app, and as a
ready-made collection: import [`postman/Free-API-Lab.postman_collection.json`](postman/README.md)
into Postman (or run it headless with `npx newman run postman/Free-API-Lab.postman_collection.json`)
and press **Run** — 14 requests, 47 assertions, all green.

**Open-Meteo geocoding (REST, no key needed)**

```
GET https://geocoding-api.open-meteo.com/v1/search?name=Rīga&count=1&language=en&format=json
```

**Open-Meteo forecast (query parameters: `latitude`, `longitude`, `current`, `daily`, `timezone`, `forecast_days`)**

```
GET https://api.open-meteo.com/v1/forecast?latitude=56.9496&longitude=24.1052
    &current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code
    &daily=temperature_2m_max,temperature_2m_min,weather_code
    &timezone=auto&forecast_days=3
```

**icanhazdadjoke (REST + `term`, `limit`, `page`)**

```
GET https://icanhazdadjoke.com/search?term=food&limit=3      headers: Accept: application/json
GET https://icanhazdadjoke.com/random                        headers: Accept: application/json
```

**Own Laravel API (REST resources + Bearer token)**

```
POST http://localhost:8000/api/login      body: {"email":"admin@example.com","password":"password"}
GET  http://localhost:8000/api/posts      headers: Authorization: Bearer <token from login>
```

All of them follow REST: resources in the URL (`/posts`, `/posts/{id}/comments`), verbs for actions
(`GET`, `POST`, `DELETE`), JSON in the body and `2xx`/`4xx` status codes.

## SSR vs CSR vs Hydration

| | SSR — Server-Side Rendering | CSR — Client-Side Rendering |
|---|---|---|
| **Who builds the HTML** | The server sends complete HTML for every request | The server sends a small shell (`<div id="root">` + JS bundle), the browser builds the DOM |
| **First paint** | Fast — content is in the response | Waits for the JS download + execution |
| **SEO / sharing** | Excellent (crawlers see content) | Weaker (needs prerendering) |
| **Interactivity** | Needs extra work (re-fetch, islands) | Immediate — React state is already in the browser |
| **Examples** | Next.js, Nuxt, SvelteKit, Laravel Blade | CRA, this project, SPA in general |

**Hydration** is the bridge between the two: the server renders the markup, the browser then loads the
same components as JavaScript and React *attaches* event listeners, state and hooks to the already
existing DOM nodes instead of throwing the HTML away and re-creating it. Until hydration finishes, the
page looks right but buttons do not react — which is why frameworks show a loading state for
interactive elements. A React app rendered only on the client (like `react-frontend/`) never hydrates;
it hydrates as soon as you put `renderToString`/`<Suspense>` on a server.

In this project: the **vanilla page** is CSR (HTML skeleton + `app.js`), the **React page** is CSR
(empty `#root` + bundle), Laravel's Blade `welcome` view would be SSR.

## Setting up WSL Ubuntu for React

The workstation is ready — verified versions:

```bash
$ wsl -l -v          # Windows side
$ node -v            # v24.14.0
$ npm -v             # 11.9.0
```

If a fresh WSL Ubuntu install is needed:

```bash
# 1) base tools
sudo apt update && sudo apt install -y curl git build-essential

# 2) Node.js via nvm (LTS)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install --lts
node -v && npm -v

# 3) create a React app
npm create vite@latest my-app -- --template react
cd my-app && npm install && npm run dev      # http://localhost:5173
```

Vite/React dev servers started inside WSL are reachable from Windows browsers at
`http://localhost:...` (WSL2 forwards the ports automatically).
