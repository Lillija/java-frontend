/**
 * Smoke test for the vanilla JavaScript frontend (public/).
 *
 * Loads public/index.html + public/app.js into jsdom with fake XMLHttpRequest/fetch
 * implementations and checks the course requirements:
 *   1) free REST API calls with query parameters (Free API Lab),
 *   2) AJAX calls to the Laravel API,
 *   3) DOM rendering without a page reload,
 *   3b) the same task through BOTH XMLHttpRequest and Fetch API,
 *   4) progress bar + spinner while data loads.
 *
 * Run: npm test
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'))
const { JSDOM } = require('jsdom')

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const html = readFileSync(`${ROOT}/public/index.html`, 'utf8')
const appSource = readFileSync(`${ROOT}/public/app.js`, 'utf8')

const POSTS = [
  { id: 1, user_id: 1, title: 'Pirmais ieraksts', body: 'Teksts Nr.1', created_at: '2026-10-01T10:00:00Z' },
  { id: 2, user_id: 2, title: 'Otrais ieraksts', body: 'Teksts Nr.2', created_at: '2026-10-02T10:00:00Z' },
]

const calls = []
function route(url, method) {
  calls.push(`${method} ${url}`)
  const u = new URL(url)
  const json = (body, status = 200) => ({
    status,
    text: JSON.stringify(body),
  })

  const isApi = u.hostname === 'localhost' && u.port === '8000'
  if (isApi && u.pathname === '/api/posts' && method === 'GET') {
    return json(POSTS)
  }
  if (isApi && u.pathname === '/api/login') {
    return json({ user: { id: 1, name: 'Admin User' }, token: '1|abc' })
  }
  if (u.hostname === 'geocoding-api.open-meteo.com') {
    return json({
      results: [{ id: 1, name: 'Rīga', latitude: 56.9496, longitude: 24.1052,
        country: 'Latvia', admin1: 'Riga' }],
    })
  }
  if (u.hostname === 'api.open-meteo.com') {
    return json({
      latitude: 56.95, longitude: 24.1, timezone: 'Europe/Riga',
      current: {
        time: '2026-10-06T12:00', temperature_2m: 11.4,
        relative_humidity_2m: 72, wind_speed_10m: 14, weather_code: 3,
      },
      current_units: { temperature_2m: '°C', relative_humidity_2m: '%', wind_speed_10m: 'km/h' },
      daily: {
        time: ['2026-10-06', '2026-10-07', '2026-10-08'],
        weather_code: [3, 61, 0],
        temperature_2m_max: [13, 11, 9],
        temperature_2m_min: [6, 5, 2],
      },
    })
  }
  if (u.hostname === 'icanhazdadjoke.com') {
    return json({
      results: [{ joke: 'Why did the chicken cross the road?' }],
      total_jokes: 1, search_term: 'food', current_page: 1, total_pages: 1,
    })
  }
  return json({ message: 'not found' }, 404)
}

/* ------------------------------------------------- fake XMLHttpRequest */
class FakeXHR {
  open(method, url) {
    this.method = method
    this.url = url
  }
  setRequestHeader(name, value) {
    this.headers = this.headers || {}
    this.headers[name] = value
  }
  send() {
    const response = route(this.url, this.method)
    this.status = response.status
    this.statusText = ''
    this.responseText = response.text
    setTimeout(() => this.onload && this.onload(), 40)
  }
}

const dom = new JSDOM(html.replace(
  '<script src="app.js"></script>',
  `<script>${appSource}</script>`,
), {
  url: 'http://localhost:3000/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.XMLHttpRequest = FakeXHR
    window.fetch = async (url, options = {}) => {
      const response = route(String(url), options.method || 'GET')
      return {
        status: response.status,
        statusText: '',
        ok: response.status < 400,
        text: async () => response.text,
      }
    }
  },
})

const { window } = dom
const { document } = window
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
const checks = []
const check = (name, ok) => checks.push([name, ok])

await wait(400) // let DOMContentLoaded + initial loadPosts finish

const html2 = () => document.getElementById('posts-container').innerHTML
/* ---- requirement 2+3: AJAX posts, DOM rendered, no reload ---- */
check('posts rendered by DOM manipulation', (html2().match(/post-card/g) || []).length >= 2)
check('first post title visible', html2().includes('Pirmais ieraksts'))
check('spinner hidden after load', document.getElementById('loading').classList.contains('hidden'))
check('network log recorded the call', document.querySelectorAll('.netlog-item').length >= 1)

/* ---- requirement 4: spinner + progress bar while the request runs ---- */
click(document.getElementById('btn-load-posts'))
await wait(15)
check('progress bar visible during request', !document.getElementById('top-progress').classList.contains('hidden'))
check('loading spinner visible during request', !document.getElementById('loading').classList.contains('hidden'))
await wait(700)
check('progress bar hidden after request', document.getElementById('top-progress').classList.contains('hidden'))

/* ---- requirement 3b: second AJAX technique (fetch) does the same job ---- */
click(document.getElementById('btn-fetch'))
check('method switch stored', window.localStorage.getItem('ajaxMethod') === 'fetch')
click(document.getElementById('btn-load-posts'))
await wait(400)
const viaTags = [...document.querySelectorAll('.netlog-via')].map((el) => el.textContent)
check('fetch technique used for the same task', viaTags[0] === 'fetch' && viaTags.includes('XHR'))

/* ---- login (AJAX, no reload) ---- */
click(document.getElementById('nav-login-btn'))
await wait(50)
check('login page shown', !document.getElementById('page-login').classList.contains('hidden'))
click(document.getElementById('btn-login'))
await wait(400)
check('logged in without reload', document.getElementById('nav-user').textContent.includes('Admin User'))
check('create-post form revealed', !document.getElementById('create-post-section').classList.contains('hidden'))

/* ---- requirement 1: free REST API with query parameters ---- */
const apiLabLink = [...document.querySelectorAll('[data-page]')]
  .find((el) => el.dataset.page === 'apilab')
click(apiLabLink)
await wait(50)
check('API Lab page visible', !document.getElementById('page-apilab').classList.contains('hidden'))

click(document.getElementById('btn-weather'))
await wait(200)
const weatherBox = document.getElementById('weather-result').innerHTML
check('weather rendered (geocoding + forecast)', weatherBox.includes('Rīga') && weatherBox.includes('11.4'))
check('query string shown in trace',
  document.getElementById('weather-trace-geo').textContent.includes('name=R') &&
  document.getElementById('weather-trace-forecast').textContent.includes('latitude=56.9496'))

click(document.getElementById('btn-joke-search'))
await wait(200)
check('jokes rendered with term/limit params',
  document.getElementById('joke-result').textContent.includes('chicken') &&
  document.getElementById('joke-trace').textContent.includes('term=food&limit=3'))

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed++
}
console.log('\nrequests:', calls.length, 'calls')
if (failed) process.exit(1)
console.log('\nAll vanilla JS checks passed.')
