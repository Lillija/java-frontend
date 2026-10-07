/**
 * My Blog — Vanilla JS frontend for the Laravel REST API
 * https://github.com/zirodev23/laravel-api
 *
 * Requirements covered:
 *  1) Free public REST APIs called with query parameters (Free API Lab page)
 *  2) AJAX calls to the project's own Laravel API endpoints
 *  3) DOM manipulation — content is rendered without a page reload
 *     Two interchangeable techniques for the SAME tasks:
 *       · XMLHttpRequest + Promises
 *       · Fetch API + async/await
 *  4) Progress bar (top of the page) + spinners while data loads
 */

'use strict';

// ============================================
// CONFIGURATION
// ============================================

const API_BASE = 'http://localhost:8000/api';       // Laravel REST API
const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_API = 'https://api.open-meteo.com/v1/forecast';
const JOKE_API = 'https://icanhazdadjoke.com';

const STORE = {
    token: 'authToken',
    user: 'currentUser',
    likes: 'likedPosts',
    method: 'ajaxMethod',
    comments: 'commentCount'
};

// ============================================
// STATE
// ============================================

let currentMethod = localStorage.getItem(STORE.method) === 'fetch' ? 'fetch' : 'xhr';
let authToken = localStorage.getItem(STORE.token) || null;
let currentUser = readJSON(STORE.user, null);
let posts = [];
let likedPosts = readJSON(STORE.likes, []);
let commentsCache = {};                       // postId -> comments
let commentCount = parseInt(localStorage.getItem(STORE.comments) || '0', 10) || 0;
let activeRequests = 0;
let netlogEntries = 0;

// ============================================
// SMALL HELPERS
// ============================================

const byId = (id) => document.getElementById(id);

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function isLoggedIn() {
    return authToken !== null && currentUser !== null;
}

// Removes every element matching a selector (a post can be rendered on several pages)
function docRemoveAll(selector) {
    document.querySelectorAll(selector).forEach((element) => element.remove());
}

function formatDate(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    } catch (e) {
        return '';
    }
}

function friendlyError(error) {
    const message = (error && error.message) ? error.message : 'Unknown error';
    if (/network error|failed to fetch|load failed/i.test(message)) {
        return 'Cannot reach the Laravel API at http://localhost:8000/api — ' +
               'start it with: cd laravel-api && php artisan serve';
    }
    return message;
}

// ============================================
// PROGRESS BAR / SPINNER / STATUS  (requirement 4)
// ============================================

function beginRequest() {
    activeRequests++;
    byId('top-progress').classList.remove('hidden');
}

function endRequest() {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) {
        setTimeout(() => {
            if (activeRequests === 0) byId('top-progress').classList.add('hidden');
        }, 400);
    }
}

function setStatus(text, kind) {
    const chip = byId('status-chip');
    chip.textContent = text;
    chip.className = 'chip chip-status' + (kind ? ' chip-' + kind : '');
}

function showLoading(text) {
    byId('loading-text').textContent = text || 'Loading...';
    byId('loading').classList.remove('hidden');
}

function hideLoading() {
    byId('loading').classList.add('hidden');
}

function showError(message) {
    const el = byId('error');
    el.textContent = message;
    el.classList.remove('hidden');
    hideLoading();
}

function hideError() {
    byId('error').classList.add('hidden');
}

// The inline error box lives on the Home page. When an action fails while the user
// is on another page (e.g. deleting a post from Profile) the message is shown as a toast.
function reportError(message) {
    if (byId('page-home').classList.contains('hidden')) toast(message, 'error');
    else showError(message);
}

// ---- Toasts -------------------------------------------------

function toast(message, type) {
    const container = byId('toast-container');
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.classList.add('toast-out'), 3000);
    setTimeout(() => el.remove(), 3400);
}

// ---- Network log --------------------------------------------

function logRequest(entry) {
    netlogEntries++;
    byId('netlog-count').textContent = netlogEntries;

    const list = byId('netlog-list');
    const placeholder = list.querySelector('.placeholder');
    if (placeholder) placeholder.remove();

    const item = document.createElement('div');
    item.className = 'netlog-item' + (entry.ok ? '' : ' bad');

    const head = document.createElement('div');
    head.className = 'netlog-item-head';

    const badge = document.createElement('span');
    badge.className = 'netlog-method';
    badge.textContent = entry.method;

    const status = document.createElement('span');
    status.className = 'netlog-status';
    status.textContent = entry.status;

    const via = document.createElement('span');
    via.className = 'netlog-via';
    via.textContent = entry.via === 'xhr' ? 'XHR' : 'fetch';

    const time = document.createElement('span');
    time.className = 'netlog-time';
    time.textContent = Math.round(entry.ms) + ' ms';

    head.appendChild(badge);
    head.appendChild(status);
    head.appendChild(via);
    head.appendChild(time);

    const url = document.createElement('div');
    url.className = 'netlog-url';
    url.textContent = entry.url;
    url.title = entry.url;

    item.appendChild(head);
    item.appendChild(url);
    list.insertBefore(item, list.firstChild);

    while (list.children.length > 60) list.removeChild(list.lastChild);

    setStatus(`${entry.method} ${shortUrl(entry.url)} · ${entry.status} · ${Math.round(entry.ms)} ms`,
              entry.ok ? 'ok' : 'bad');
}

function shortUrl(url) {
    return url.replace(/^https?:\/\//, '').replace(/^localhost:8000\//, '');
}

// ============================================
// AJAX — METHOD 1: XMLHttpRequest + Promises
// ============================================

function buildHeaders(url, body, extra) {
    const headers = Object.assign({ 'Accept': 'application/json' }, extra || {});
    if (body) headers['Content-Type'] = 'application/json';
    if (authToken && url.indexOf(API_BASE) === 0) {
        headers['Authorization'] = 'Bearer ' + authToken;
    }
    return headers;
}

function parsePayload(status, text, statusText) {
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = text;
        }
    }

    if (status >= 200 && status < 300) return data;

    const error = new Error(extractErrorMessage(data, status, statusText));
    error.status = status;
    error.payload = data;
    throw error;
}

function extractErrorMessage(payload, status, statusText) {
    if (payload) {
        if (typeof payload === 'string' && payload.trim()) return payload;
        if (payload.message) return payload.message;
        if (payload.errors) return firstValidationMessage(payload.errors);
    }
    return 'HTTP ' + status + (statusText ? ' ' + statusText : '');
}

function firstValidationMessage(errors) {
    const messages = [];
    Object.keys(errors).forEach((key) => {
        const value = errors[key];
        if (Array.isArray(value)) messages.push(value.join(' '));
        else if (typeof value === 'string') messages.push(value);
    });
    return messages.length ? messages.join(' ') : 'Validation error';
}

function xhrRequest(url, options) {
    const opts = options || {};
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(opts.method || 'GET', url, true);
        xhr.timeout = 20000;

        const headers = buildHeaders(url, opts.body, opts.headers);
        Object.keys(headers).forEach((name) => xhr.setRequestHeader(name, headers[name]));

        xhr.onload = () => {
            try {
                resolve(parsePayload(xhr.status, xhr.responseText, xhr.statusText));
            } catch (error) {
                reject(error);
            }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Network error — request timed out'));
        xhr.send(opts.body ? JSON.stringify(opts.body) : null);
    });
}

// ============================================
// AJAX — METHOD 2: Fetch API + async/await
// ============================================

async function fetchRequest(url, options) {
    const opts = options || {};
    let response;

    try {
        response = await fetch(url, {
            method: opts.method || 'GET',
            headers: buildHeaders(url, opts.body, opts.headers),
            body: opts.body ? JSON.stringify(opts.body) : undefined
        });
    } catch (e) {
        throw new Error('Network error');
    }

    const text = await response.text();
    return parsePayload(response.status, text, response.statusText);
}

// ============================================
// ROUTER: runs every call through the chosen method
// ============================================

function request(url, options) {
    const opts = options || {};
    const method = opts.method || 'GET';
    const via = currentMethod;
    const started = performance.now();

    beginRequest();

    const runner = via === 'xhr' ? xhrRequest(url, opts) : fetchRequest(url, opts);

    return runner.then(
        (data) => {
            endRequest();
            logRequest({
                url: url,
                method: method,
                status: 'OK',
                ms: performance.now() - started,
                via: via,
                ok: true
            });
            return data;
        },
        (error) => {
            endRequest();
            logRequest({
                url: url,
                method: method,
                status: error.status ? 'HTTP ' + error.status : 'ERROR',
                ms: performance.now() - started,
                via: via,
                ok: false
            });
            throw error;
        }
    );
}

// ============================================
// TOOLBAR: switch between the two methods
// ============================================

function setMethod(method) {
    currentMethod = method === 'fetch' ? 'fetch' : 'xhr';
    localStorage.setItem(STORE.method, currentMethod);

    byId('btn-xhr').classList.toggle('active', currentMethod === 'xhr');
    byId('btn-fetch').classList.toggle('active', currentMethod === 'fetch');

    toast(currentMethod === 'xhr'
        ? 'AJAX method: XMLHttpRequest (Promises)'
        : 'AJAX method: Fetch API (async/await)', 'info');
}

// ============================================
// NAVIGATION
// ============================================

function showPage(pageName) {
    document.querySelectorAll('.page').forEach((page) => page.classList.add('hidden'));

    const page = byId('page-' + pageName);
    if (!page) return;
    page.classList.remove('hidden');

    document.querySelectorAll('.nav-links a').forEach((link) => {
        link.classList.toggle('active', link.dataset.page === pageName);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (pageName === 'profile') loadProfile();
}

// ============================================
// AUTH: Login / Logout
// ============================================

function showLoginError(message) {
    const el = byId('login-error');
    el.textContent = message;
    el.classList.remove('hidden');
}

async function handleLogin() {
    const email = byId('login-email').value.trim();
    const password = byId('login-password').value;

    byId('login-error').classList.add('hidden');

    if (!email || !password) {
        showLoginError('Please enter email and password.');
        return;
    }

    const button = byId('btn-login');
    button.disabled = true;
    button.textContent = 'Logging in…';

    try {
        const data = await request(API_BASE + '/login', {
            method: 'POST',
            body: { email: email, password: password }
        });

        // The API answers 200 with an "errors" object when credentials are wrong
        if (data && data.errors) throw new Error(firstValidationMessage(data.errors));
        if (!data || !data.token) throw new Error('The API did not return a token.');

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem(STORE.token, authToken);
        writeJSON(STORE.user, currentUser);

        updateAuthUI();
        toast('Welcome back, ' + currentUser.name + '!', 'success');
        showPage('home');
        loadPosts();
    } catch (error) {
        showLoginError(friendlyError(error));
    } finally {
        button.disabled = false;
        button.textContent = 'Login';
    }
}

async function handleLogout() {
    try {
        await request(API_BASE + '/logout', { method: 'POST' });
        toast('Logged out', 'success');
    } catch (error) {
        // Even if the call fails we clear the local session
        toast('Logged out (token already invalid)', 'info');
    } finally {
        authToken = null;
        currentUser = null;
        localStorage.removeItem(STORE.token);
        localStorage.removeItem(STORE.user);
        updateAuthUI();
        showPage('home');
        loadPosts();
    }
}

function updateAuthUI() {
    const navUser = byId('nav-user');
    const navLoginBtn = byId('nav-login-btn');
    const navLogoutBtn = byId('nav-logout-btn');
    const createSection = byId('create-post-section');

    if (isLoggedIn()) {
        navUser.textContent = 'Hello, ' + currentUser.name;
        navUser.classList.remove('hidden');
        navLoginBtn.classList.add('hidden');
        navLogoutBtn.classList.remove('hidden');
        createSection.classList.remove('hidden');
    } else {
        navUser.classList.add('hidden');
        navLoginBtn.classList.remove('hidden');
        navLogoutBtn.classList.add('hidden');
        createSection.classList.add('hidden');
    }
}

// ============================================
// POSTS: Load / Create / Delete
// ============================================

async function loadPosts() {
    showLoading('Loading posts from the Laravel API...');
    hideError();

    try {
        const data = await request(API_BASE + '/posts');
        posts = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
        renderPosts();
        setStatus(`Loaded ${posts.length} posts`, 'ok');
    } catch (error) {
        showError('Failed to load posts — ' + friendlyError(error));
    } finally {
        hideLoading();
    }
}

async function handleCreatePost() {
    const title = byId('post-title').value.trim();
    const body = byId('post-body').value.trim();

    if (!title || !body) {
        toast('Please enter both title and body', 'error');
        return;
    }
    if (!isLoggedIn()) {
        toast('Please login first', 'error');
        showPage('login');
        return;
    }

    const button = byId('btn-create-post');
    button.disabled = true;
    button.textContent = 'Publishing…';

    try {
        const created = await request(API_BASE + '/posts', {
            method: 'POST',
            body: { title: title, body: body }
        });

        posts.unshift(created);
        renderPosts();

        byId('post-title').value = '';
        byId('post-body').value = '';
        toast('Post published!', 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        showError('Failed to create post — ' + friendlyError(error));
    } finally {
        button.disabled = false;
        button.textContent = 'Publish';
    }
}

async function handleDeletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
        await request(API_BASE + '/posts/' + postId, { method: 'DELETE' });

        posts = posts.filter((post) => post.id !== postId);

        // Remove exactly this card from the DOM (no full re-render needed)
        // A post can be visible on Home and Profile at the same time, so remove all copies
        docRemoveAll('.post-card[data-id="' + postId + '"]');

        const container = byId('posts-container');
        if (container.children.length === 0) {
            container.innerHTML = '<p class="placeholder">No posts found</p>';
        }

        toast('Post deleted', 'success');
    } catch (error) {
        reportError('Failed to delete post — ' + friendlyError(error));
    }
}

// ============================================
// COMMENTS
// ============================================

async function toggleComments(postId) {
    const section = byId('comments-section-' + postId);
    if (!section) return;

    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        if (commentsCache[postId]) {
            renderComments(commentsCache[postId], byId('comments-' + postId));
        } else {
            await loadComments(postId);
        }
    } else {
        section.classList.add('hidden');
    }
}

async function loadComments(postId) {
    const container = byId('comments-' + postId);
    if (container) container.innerHTML = '<p class="placeholder">Loading comments…</p>';

    try {
        const data = await request(API_BASE + '/posts/' + postId + '/comments');
        const comments = Array.isArray(data) ? data : [];
        commentsCache[postId] = comments;
        renderComments(comments, container);
        updateCommentCount(postId, comments.length);
    } catch (error) {
        renderComments([], container);
        toast('Comments: ' + friendlyError(error), 'error');
    }
}

function updateCommentCount(postId, count) {
    document.querySelectorAll('.post-card[data-id="' + postId + '"] .btn-comments')
        .forEach((button) => { button.textContent = 'Comments (' + count + ')'; });
}

async function handleAddComment(postId) {
    const input = byId('comment-input-' + postId);
    if (!input) return;

    const content = input.value.trim();
    if (!content) {
        toast('Please enter a comment', 'error');
        return;
    }
    if (!isLoggedIn()) {
        toast('Please login first', 'error');
        showPage('login');
        return;
    }

    try {
        const created = await request(API_BASE + '/posts/' + postId + '/comments', {
            method: 'POST',
            body: { content: content }
        });

        const list = commentsCache[postId] || [];
        list.push(created);
        commentsCache[postId] = list;

        input.value = '';
        renderComments(list, byId('comments-' + postId));
        updateCommentCount(postId, list.length);

        commentCount++;
        localStorage.setItem(STORE.comments, String(commentCount));
        toast('Comment added', 'success');
    } catch (error) {
        toast('Failed to add comment — ' + friendlyError(error), 'error');
    }
}

// ============================================
// LIKES (stored locally)
// ============================================

function handleLike(postId) {
    const index = likedPosts.indexOf(postId);
    if (index === -1) likedPosts.push(postId);
    else likedPosts.splice(index, 1);

    writeJSON(STORE.likes, likedPosts);

    // Update only this like button (the card may exist on Home and Profile)
    document.querySelectorAll('.post-card[data-id="' + postId + '"] .btn-like').forEach((button) => {
        const liked = likedPosts.includes(postId);
        button.classList.toggle('liked', liked);
        button.textContent = liked ? '❤️ Liked' : 'Like';
    });
}

// ============================================
// DOM: render posts (DOM manipulation, no reload)
// ============================================

function authorLabel(post) {
    if (post.user && post.user.name) return post.user.name;
    if (isLoggedIn() && post.user_id === currentUser.id) return 'You (user #' + post.user_id + ')';
    return 'User #' + post.user_id;
}

function renderPosts() {
    const container = byId('posts-container');
    container.innerHTML = '';

    if (!posts || posts.length === 0) {
        container.innerHTML = '<p class="placeholder">No posts found</p>';
        return;
    }

    const fragment = document.createDocumentFragment();
    posts.forEach((post) => fragment.appendChild(createPostCard(post)));
    container.appendChild(fragment);
}

function createPostCard(post) {
    const card = document.createElement('article');
    card.className = 'post-card';
    card.dataset.id = post.id;

    // --- header: title + status badge
    const head = document.createElement('div');
    head.className = 'post-head';

    const title = document.createElement('h3');
    title.textContent = post.title;
    head.appendChild(title);

    if (post.post_status_id) {
        const badge = document.createElement('span');
        const isPrivate = Number(post.post_status_id) === 2;
        badge.className = 'badge ' + (isPrivate ? 'badge-private' : 'badge-public');
        badge.textContent = isPrivate ? 'Private' : 'Public';
        head.appendChild(badge);
    }

    // --- body
    const body = document.createElement('p');
    body.textContent = post.body;

    // --- meta row
    const meta = document.createElement('div');
    meta.className = 'post-meta';

    const author = document.createElement('span');
    author.className = 'post-author';
    author.textContent = authorLabel(post);

    const date = document.createElement('span');
    date.className = 'post-date';
    date.textContent = formatDate(post.created_at);

    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const likeBtn = document.createElement('button');
    const liked = likedPosts.includes(post.id);
    likeBtn.className = 'btn-like' + (liked ? ' liked' : '');
    likeBtn.textContent = liked ? '❤️ Liked' : 'Like';
    likeBtn.addEventListener('click', () => handleLike(post.id));

    const commentsBtn = document.createElement('button');
    commentsBtn.className = 'btn-comments';
    commentsBtn.textContent = 'Comments';
    commentsBtn.addEventListener('click', () => toggleComments(post.id));

    actions.appendChild(likeBtn);
    actions.appendChild(commentsBtn);

    if (isLoggedIn() && post.user_id === currentUser.id) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => handleDeletePost(post.id));
        actions.appendChild(deleteBtn);
    }

    meta.appendChild(author);
    meta.appendChild(date);
    meta.appendChild(actions);

    // --- comments area
    const commentsSection = document.createElement('div');
    commentsSection.className = 'comments-section hidden';
    commentsSection.id = 'comments-section-' + post.id;

    const commentsTitle = document.createElement('h4');
    commentsTitle.textContent = 'Comments';

    const commentsContainer = document.createElement('div');
    commentsContainer.id = 'comments-' + post.id;

    commentsSection.appendChild(commentsTitle);
    commentsSection.appendChild(commentsContainer);

    if (isLoggedIn()) {
        const form = document.createElement('div');
        form.className = 'comment-form';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Write a comment...';
        input.id = 'comment-input-' + post.id;
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') handleAddComment(post.id);
        });

        const button = document.createElement('button');
        button.textContent = 'Post';
        button.addEventListener('click', () => handleAddComment(post.id));

        form.appendChild(input);
        form.appendChild(button);
        commentsSection.appendChild(form);
    }

    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(meta);
    card.appendChild(commentsSection);

    return card;
}

function renderComments(comments, container) {
    if (!container) return;
    container.innerHTML = '';

    if (!comments || comments.length === 0) {
        container.innerHTML = '<p class="placeholder">No comments yet. Be the first!</p>';
        return;
    }

    const fragment = document.createDocumentFragment();
    comments.forEach((comment) => {
        const card = document.createElement('div');
        card.className = 'comment-card';

        const author = document.createElement('div');
        author.className = 'comment-author';

        if (isLoggedIn() && comment.user_id === currentUser.id) {
            author.textContent = 'You';
        } else if (comment.user && comment.user.name) {
            author.textContent = comment.user.name;
        } else {
            author.textContent = comment.user_id ? 'User #' + comment.user_id : 'Anonymous';
        }

        const body = document.createElement('div');
        body.className = 'comment-body';
        body.textContent = comment.content || comment.body || '';

        card.appendChild(author);
        card.appendChild(body);
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

// ============================================
// PROFILE
// ============================================

async function loadProfile() {
    if (!isLoggedIn()) {
        showPage('login');
        return;
    }

    byId('profile-name').textContent = currentUser.name;
    byId('profile-email').textContent = currentUser.email;
    byId('profile-initial').textContent = currentUser.name.charAt(0).toUpperCase();
    byId('profile-bio').textContent = 'Welcome back, ' + currentUser.name + '! This is your personal space.';

    const container = byId('user-posts-container');

    if (posts.length === 0) {
        // Spinner lives inside the container so it is visible on this page too
        container.innerHTML =
            '<div class="loading"><div class="spinner"></div><p>Loading your posts...</p></div>';
        try {
            const data = await request(API_BASE + '/posts');
            posts = Array.isArray(data) ? data : [];
        } catch (error) {
            container.innerHTML = '';
            toast('Failed to load posts — ' + friendlyError(error), 'error');
            return;
        }
    }

    const userPosts = posts.filter((post) => post.user_id === currentUser.id);

    byId('stat-posts').textContent = userPosts.length;
    byId('stat-likes').textContent = likedPosts.length;
    byId('stat-comments').textContent = commentCount;

    container.innerHTML = '';

    if (userPosts.length === 0) {
        container.innerHTML = '<p class="placeholder">You haven\'t posted anything yet</p>';
        return;
    }

    const fragment = document.createDocumentFragment();
    userPosts.forEach((post) => fragment.appendChild(createPostCard(post)));
    container.appendChild(fragment);
}

// ============================================
// FREE API LAB — weather + jokes with query params
// ============================================

function setLabLoading(name, isLoading) {
    byId(name + '-loading').classList.toggle('hidden', !isLoading);
}

function showLabError(name, message) {
    const el = byId(name + '-error');
    el.textContent = message;
    el.classList.remove('hidden');
}

function hideLabError(name) {
    byId(name + '-error').classList.add('hidden');
}

const WEATHER_CODES = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Rain showers', 81: 'Rain showers', 82: 'Violent rain showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail'
};

function weatherEmoji(code) {
    if (code === 0 || code === 1) return '☀️';
    if (code === 2) return '⛅';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '🌨️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code >= 95) return '⛈️';
    return '🌤️';
}

async function getWeather() {
    const cityInput = byId('weather-city');
    const city = cityInput.value.trim();

    hideLabError('weather');
    if (!city) {
        showLabError('weather', 'Enter a city name first.');
        return;
    }

    setLabLoading('weather', true);

    try {
        // 1) geocode the city — query parameters: name, count, language, format
        const geoUrl = `${GEO_API}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
        byId('weather-trace-geo').textContent = '1) GET ' + geoUrl;

        const geo = await request(geoUrl);
        const place = geo && geo.results && geo.results[0];
        if (!place) throw new Error(`No city found for "${city}"`);

        // 2) forecast — query parameters: latitude, longitude, current, daily, timezone, forecast_days
        const fcUrl = `${FORECAST_API}?latitude=${place.latitude}&longitude=${place.longitude}` +
            '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code' +
            '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
            '&timezone=auto&forecast_days=3';
        byId('weather-trace-forecast').textContent = '2) GET ' + fcUrl;

        const forecast = await request(fcUrl);
        renderWeather(place, forecast);
        toast('Weather loaded for ' + place.name, 'success');
    } catch (error) {
        showLabError('weather', friendlyError(error));
    } finally {
        setLabLoading('weather', false);
    }
}

function renderWeather(place, forecast) {
    const container = byId('weather-result');
    container.innerHTML = '';

    const current = forecast.current || {};
    const units = forecast.current_units || {};
    const daily = forecast.daily || {};

    const head = document.createElement('div');
    head.className = 'weather-head';

    const placeName = document.createElement('h4');
    placeName.textContent = `${place.name}${place.admin1 ? ', ' + place.admin1 : ''} · ${place.country}`;
    head.appendChild(placeName);

    const now = document.createElement('span');
    now.className = 'weather-time';
    now.textContent = current.time ? current.time.replace('T', ' ') : '';
    head.appendChild(now);

    const currentBox = document.createElement('div');
    currentBox.className = 'weather-current';

    const emoji = document.createElement('span');
    emoji.className = 'weather-emoji';
    emoji.textContent = weatherEmoji(current.weather_code);

    const temp = document.createElement('span');
    temp.className = 'weather-temp';
    temp.textContent = `${current.temperature_2m ?? '–'}${units.temperature_2m || '°C'}`;

    const desc = document.createElement('span');
    desc.className = 'weather-desc';
    desc.textContent = WEATHER_CODES[current.weather_code] || 'Unknown';

    currentBox.appendChild(emoji);
    currentBox.appendChild(temp);
    currentBox.appendChild(desc);

    const details = document.createElement('div');
    details.className = 'weather-details';
    details.innerHTML =
        `<span>💧 Humidity: <strong>${current.relative_humidity_2m ?? '–'}${units.relative_humidity_2m || '%'}</strong></span>` +
        `<span>💨 Wind: <strong>${current.wind_speed_10m ?? '–'}${units.wind_speed_10m || ' km/h'}</strong></span>`;

    container.appendChild(head);
    container.appendChild(currentBox);
    container.appendChild(details);

    if (daily.time && daily.time.length) {
        const list = document.createElement('div');
        list.className = 'weather-days';
        daily.time.forEach((day, index) => {
            const row = document.createElement('div');
            row.className = 'weather-day';
            row.innerHTML =
                `<span>${new Date(day + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}</span>` +
                `<span>${weatherEmoji(daily.weather_code ? daily.weather_code[index] : null)}</span>` +
                `<span><strong>${daily.temperature_2m_max[index]}°</strong> / ${daily.temperature_2m_min[index]}°</span>`;
            list.appendChild(row);
        });
        container.appendChild(list);
    }
}

async function searchJokes() {
    const term = byId('joke-term').value.trim();
    const limit = byId('joke-limit').value;

    hideLabError('joke');
    setLabLoading('joke', true);

    try {
        // Query parameters: term + limit (+ page for pagination)
        const url = `${JOKE_API}/search?term=${encodeURIComponent(term)}&limit=${limit}`;
        byId('joke-trace').textContent = 'GET ' + url;

        const data = await request(url);
        const results = (data && data.results) || [];

        if (results.length === 0) {
            byId('joke-result').innerHTML =
                `<p class="placeholder">No jokes found for "${escapeHTML(data && data.search_term ? data.search_term : term)}"</p>`;
            return;
        }

        renderJokes(results.map((item) => item.joke),
            `${data.total_jokes} jokes match "${data.search_term}" — showing page ${data.current_page} of ${data.total_pages}`);
    } catch (error) {
        showLabError('joke', friendlyError(error));
    } finally {
        setLabLoading('joke', false);
    }
}

async function randomJoke() {
    hideLabError('joke');
    setLabLoading('joke', true);

    try {
        const url = `${JOKE_API}/`;
        byId('joke-trace').textContent = `GET ${JOKE_API}/  (Accept: application/json)`;

        const data = await request(url);
        renderJokes([data && data.joke ? data.joke : 'No joke returned'], 'Random joke');
        toast('Joke loaded', 'success');
    } catch (error) {
        showLabError('joke', friendlyError(error));
    } finally {
        setLabLoading('joke', false);
    }
}

function renderJokes(jokes, meta) {
    const container = byId('joke-result');
    container.innerHTML = '';

    const metaLine = document.createElement('p');
    metaLine.className = 'lab-meta';
    metaLine.textContent = meta;
    container.appendChild(metaLine);

    jokes.forEach((joke) => {
        const item = document.createElement('div');
        item.className = 'joke-item';
        item.textContent = joke;
        container.appendChild(item);
    });
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
}

// ============================================
// EVENT BINDING + INIT
// ============================================

function bindEvents() {
    // Navigation (works from code too — no reliance on the global "event")
    document.querySelectorAll('[data-page]').forEach((element) => {
        element.addEventListener('click', (event) => {
            event.preventDefault();
            showPage(element.dataset.page);
        });
    });

    byId('nav-logout-btn').addEventListener('click', handleLogout);
    byId('btn-login').addEventListener('click', handleLogin);
    byId('btn-load-posts').addEventListener('click', loadPosts);
    byId('btn-create-post').addEventListener('click', handleCreatePost);

    // AJAX method switch
    byId('btn-xhr').addEventListener('click', () => setMethod('xhr'));
    byId('btn-fetch').addEventListener('click', () => setMethod('fetch'));

    // Free API Lab
    byId('btn-weather').addEventListener('click', getWeather);
    byId('weather-city').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') getWeather();
    });
    byId('btn-joke-search').addEventListener('click', searchJokes);
    byId('btn-joke-random').addEventListener('click', randomJoke);
    byId('joke-term').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') searchJokes();
    });

    // Network log panel
    byId('netlog-toggle').addEventListener('click', () => byId('netlog').classList.toggle('hidden'));
    byId('netlog-close').addEventListener('click', () => byId('netlog').classList.add('hidden'));

    // Login: Enter key
    ['login-email', 'login-password'].forEach((id) => {
        byId(id).addEventListener('keydown', (event) => {
            if (event.key === 'Enter') handleLogin();
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('My Blog loaded — AJAX method:', currentMethod);

    // Restore the saved method
    byId('btn-xhr').classList.toggle('active', currentMethod === 'xhr');
    byId('btn-fetch').classList.toggle('active', currentMethod === 'fetch');

    bindEvents();
    updateAuthUI();
    setStatus('Ready', '');

    // Show data immediately (AJAX, no page reload)
    loadPosts();
});
