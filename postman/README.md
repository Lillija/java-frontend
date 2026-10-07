# Postman collection — task Nr. 1 (free REST API + query parameters)

Importable collection that covers the first task of the lab:

> *"Find a free API service (jokes, weather, …) and test it with Postman using different
> parameters (query parameters). Find an API service that uses the REST architecture."*

* **Collection:** [`Free-API-Lab.postman_collection.json`](./Free-API-Lab.postman_collection.json)
  (Postman Collection **v2.1** — 3 folders, 14 requests, 47 test assertions)

## How to run it

**Postman (GUI)**

1. Postman → *Collections → **Import*** → choose `postman/Free-API-Lab.postman_collection.json`.
2. Press **Run** (or send the requests one by one). Every request carries `pm.test` assertions that
   check the status code, the `Content-Type` and that the query parameters actually change the answer.
3. Folder **3 · laravel-api** must be run in order: `POST /login` stores the Bearer token in the
   collection variable `{{token}}`, `POST /posts` stores the new id in `{{postId}}`,
   `DELETE /posts/{{postId}}` uses it.

**Command line (the same engine Postman uses — Newman)**

```bash
npx newman run postman/Free-API-Lab.postman_collection.json
```

Last run on this machine: **14/14 requests, 47/47 assertions, 0 failures** (the Laravel API had to be
running on `http://localhost:8000` for folder 3 — `npm run api`).

## What is tested with which parameters

| # | Request | Query parameters | Why it is different |
|---|---------|------------------|---------------------|
| 1 | Open-Meteo geocoding `…/v1/search` | `name=Rīga`, `count=1`, `language=en`, `format=json` | baseline |
| 2 | Open-Meteo geocoding | `name=Berlin`, `count=3`, `language=de` | other `count` + other `language` → 3 German results |
| 3 | Open-Meteo geocoding | `name=xyzabc123` | edge case → `200` but **no** `results` field |
| 4 | Open-Meteo forecast `…/v1/forecast` | `latitude`, `longitude`, `current=…`, `timezone=auto` | current weather block |
| 5 | Open-Meteo forecast | `daily=…`, `timezone=Europe/Riga`, `forecast_days=7`, `format=csv` | other parameters + other response format (`text/csv`) |
| 6 | icanhazdadjoke `/search` | `term=food`, `limit=1` | baseline, exactly one joke |
| 7 | icanhazdadjoke `/search` | `term=food`, `limit=3`, `page=2` | other `limit` + pagination `page` |
| 8 | icanhazdadjoke `/` | — (header `Accept: application/json`) | resource identified by the path, not by a query string |
| 9 | `GET /api/posts` | — | REST resource list, no auth |
| 10 | `POST /api/login` | body `email`/`password` | → saves `{{token}}` |
| 11 | `POST /api/login` (wrong password) | body | negative case → `errors` object |
| 12 | `GET /api/user` | header `Authorization: Bearer {{token}}` | protected resource |
| 13 | `POST /api/posts` | JSON body `title`/`body` | creates → saves `{{postId}}` |
| 14 | `DELETE /api/posts/{{postId}}` | — | deletes the resource created in #13 |

The responses saved inside the collection are the real bodies returned by these APIs
(2026-10-07), so the collection can be inspected offline as well.

## Same requests from the browser

Every request of folder 1 and 2 is also reachable from the **Free API Lab** page of the vanilla
frontend (`public/index.html` → *Free API Lab*), executed with the AJAX method selected in the
toolbar and rendered with DOM manipulation — see `public/app.js` (`getWeather`, `searchJokes`).

## Why these APIs are REST

* resources live in the URL (`/v1/search`, `/posts`, `/posts/{id}/comments`),
* HTTP verbs express the action (`GET`, `POST`, `DELETE`),
* state is transferred as JSON (or CSV) with meaningful status codes (`200`, `201`, `401`, `422`).

Open-Meteo (weather + geocoding) and icanhazdadjoke (jokes) are both free, need no API key and
answer with `Access-Control-Allow-Origin: *`, which is why the browser calls them directly.
