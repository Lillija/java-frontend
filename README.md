# My Blog — Vanilla JS frontend + Laravel REST API

Vanilla JavaScript frontend that talks to the course project API
([zirodev23/laravel-api](https://github.com/zirodev23/laravel-api)) over AJAX — **no page reloads**,
everything is rendered with DOM manipulation.

## How to run

Two terminals (or two background processes):

```bash
# 1) Backend REST API  ->  http://localhost:8000/api
cd laravel-api
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed
php artisan serve --host=0.0.0.0 --port=8000

# 2) Frontend  ->  http://localhost:3000
cd ..          # project root
node server.js # or: npm start   /   python3 serve.py (port 8000 alternative)
```

Then open **http://localhost:3000**.

> Note: this machine's system PHP is 8.3 without the required extensions, so the API runs with the
> PHP 8.4 binary from herd-lite: `~/.config/herd-lite/bin/php artisan serve`.

Demo login: **admin@example.com** / **password** (every seeded user uses `password`).

## What is implemented (teacher's requirements)

| # | Requirement | Where |
|---|-------------|-------|
| 1 | Free REST API tested with query parameters | **Free API Lab** page — Open-Meteo geocoding + forecast (`name`, `latitude`, `longitude`, `current`, `daily`, `timezone`…), icanhazdadjoke (`term`, `limit`). The exact request URL with its query string is shown under each card, exactly as it appears in Postman. |
| 2 | Vanilla JS + AJAX to the project's Laravel API | `public/app.js` calls `/api/login`, `/api/logout`, `/api/posts`, `/api/posts/{id}`, `/api/posts/{id}/comments` with a Bearer token. |
| 3 | DOM manipulation without reload **using 2 methods for the same task** | Toolbar switch: **XMLHttpRequest (Promises)** ⇄ **Fetch API (async/await)**. Every action (load/create/delete post, comments, login, weather, jokes) runs through whichever method is selected. |
| 4 | Loading spinner / progress bar | Animated progress bar at the top of the window, spinner while posts load, inline spinners in the API lab, button busy states. |

Extras: 📶 **Network log** (bottom-right) lists every AJAX call with method, URL, status,
which technique was used and its duration — handy when the teacher checks the work.

## Files

```
public/
  index.html   — pages: Home, Free API Lab, Profile, About (SSR/CSR/Hydration), Contact, Login
  app.js       — AJAX layer (XHR + fetch), auth, posts, comments, likes, API lab, network log
  styles.css   — UI styling
server.js      — Express static server on port 3000
serve.py       — alternative Python static server on port 8080
laravel-api/   — the backend REST API (Laravel + Sanctum, SQLite)
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
