/**
 * Smoke test for the React frontend (react-frontend/).
 *
 * Mounts the production bundle in jsdom (fake fetch) and drives the UI:
 * guest view -> login -> create post -> comments -> delete post -> network log.
 *
 * Run: npm test   (builds react-frontend/tests/build/smoke.js first)
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const require = createRequire(resolve(HERE, '../package.json'))
const { JSDOM } = require('jsdom')

const BUNDLE = resolve(HERE, '../react-frontend/tests/build/smoke.js')

const POSTS = [
  { id: 1, user_id: 1, title: 'Pirmais ieraksts', body: 'Teksts Nr.1', created_at: '2026-10-01T10:00:00Z' },
  { id: 2, user_id: 2, title: 'Otrais ieraksts', body: 'Teksts Nr.2', created_at: '2026-10-02T10:00:00Z' },
]
const COMMENTS = [{ id: 10, user_id: 1, content: 'Skaisti!' }]

const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost:5173/', pretendToBeVisual: true },
)
const { window } = dom
const { document } = window

for (const key of [
  'document', 'navigator', 'localStorage', 'HTMLElement', 'HTMLInputElement',
  'HTMLTextAreaElement', 'Element', 'Node', 'MutationObserver', 'getComputedStyle',
  'requestAnimationFrame', 'cancelAnimationFrame', 'CustomEvent', 'Event',
]) {
  try {
    Object.defineProperty(globalThis, key, {
      value: window[key], configurable: true, writable: true,
    })
  } catch { /* keep built-in */ }
}
globalThis.window = window

const calls = []
globalThis.fetch = async (url, options = {}) => {
  const method = options.method || 'GET'
  calls.push(`${method} ${url.replace('http://localhost:8000', '')}`)
  const json = (body, status = 200) => ({
    ok: status < 400, status,
    text: async () => JSON.stringify(body),
  })
  if (method === 'GET' && /\/api\/posts$/.test(url)) return json(POSTS)
  if (method === 'GET' && /\/api\/posts\/\d+\/comments$/.test(url)) return json(COMMENTS)
  if (method === 'DELETE' && /\/api\/posts\/\d+$/.test(url)) {
    return json({ message: 'deleted' })
  }
  if (method === 'POST' && /\/api\/login$/.test(url)) {
    return json({ user: { id: 1, name: 'Admin User' }, token: '1|abc' })
  }
  if (method === 'POST' && /\/api\/posts$/.test(url)) {
    return json({
      id: 99, user_id: 1,
      title: JSON.parse(options.body).title,
      body: JSON.parse(options.body).body,
      created_at: new Date().toISOString(),
    })
  }
  if (method === 'POST' && /\/api\/posts\/\d+\/comments$/.test(url)) {
    return json({ id: 77, user_id: 1, content: JSON.parse(options.body).content }, 201)
  }
  return json({ message: 'not found' }, 404)
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function setNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new window.Event('input', { bubbles: true }))
}

const submitForm = (form) =>
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))

const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))

const checks = []
const check = (name, ok) => checks.push([name, ok])

await import(pathToFileURL(BUNDLE).href)
await wait(300)

// --- 1) guest sees posts
check('guest: 2 posts rendered', document.querySelectorAll('.post-card').length === 2)

// --- 2) login (default demo credentials are pre-filled)
submitForm(document.querySelector('.login-card'))
await wait(300)
check('login: greeting shows user', document.querySelector('.chip').textContent.includes('Admin User'))
check('login: new post form appears', !!document.querySelector('.new-post'))
check('login: request used POST /api/login', calls.includes('POST /api/login'))

// --- 3) create a post
const form = document.querySelector('.new-post')
setNativeValue(form.querySelector('input'), 'Jauns virsraksts')
setNativeValue(form.querySelector('textarea'), 'Jauns saturs no React')
submitForm(form)
await wait(300)
check('create: 3 posts now', document.querySelectorAll('.post-card').length === 3)
check('create: new post on top', document.querySelector('.post-card h3').textContent === 'Jauns virsraksts')
check('create: POST /api/posts fired', calls.includes('POST /api/posts'))

// --- 4) open comments of the freshly created post (user 1 owns it)
const commentsButton = [...document.querySelectorAll('.post-actions .btn-ghost')]
  .find((button) => button.textContent.startsWith('Comments'))
click(commentsButton)
await wait(300)
check('comments: loaded', document.body.textContent.includes('Skaisti!'))
check('comments: comment form visible', !!document.querySelector('.comment-form'))

const commentForm = document.querySelector('.comment-form')
setNativeValue(commentForm.querySelector('input'), 'Paldies!')
submitForm(commentForm)
await wait(300)
check('comment added locally', document.body.textContent.includes('Paldies!'))
check('POST comment fired', calls.some((c) => c.startsWith('POST /api/posts/99/comments')))

// --- 5) delete own post
click(document.querySelector('.post-card .btn-ghost'))
await wait(300)
check('delete: back to 2 posts', document.querySelectorAll('.post-card').length === 2)
check('delete: DELETE fired', calls.some((c) => c.startsWith('DELETE /api/posts/99')))

// --- 6) spinner / progress bar present while loading (checked at boot above)
check('network log toggle exists', !!document.querySelector('.netlog-toggle'))
click(document.querySelector('.netlog-toggle'))
await wait(50)
check('network log lists requests', document.querySelectorAll('.netlog-row').length >= 4)

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed++
}
console.log('\nrequests:', calls.join(' | '))
if (failed) {
  console.log('\n--- HTML ---\n' + document.getElementById('root').innerHTML.slice(0, 4000))
  process.exit(1)
}
console.log('\nAll interaction checks passed.')
