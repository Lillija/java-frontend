/**
 * My Blog - Vanilla JS Frontend
 * Login, Logout, Create Post, Delete Post, Comment, Like
 * Two AJAX methods: XMLHttpRequest and Fetch API
 */

// ============================================
// CONFIGURATION
// ============================================

const LARAVEL_API_URL = 'http://localhost:8000/api';
const DEMO_API_URL = 'https://jsonplaceholder.typicode.com';

const API_MODE = 'demo';
let currentMethod = 'xhr';
let authToken = localStorage.getItem('authToken') || null;
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let posts = [];
let likedPosts = JSON.parse(localStorage.getItem('likedPosts')) || [];
let localComments = JSON.parse(localStorage.getItem('localComments')) || {};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getApiUrl() {
    return API_MODE === 'laravel' ? LARAVEL_API_URL : DEMO_API_URL;
}

function setMethod(method) {
    currentMethod = method;
    document.getElementById('btn-xhr').classList.toggle('active', method === 'xhr');
    document.getElementById('btn-fetch').classList.toggle('active', method === 'fetch');
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('posts-container').classList.add('hidden');
    document.getElementById('error').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('posts-container').classList.remove('hidden');
}

function showError(message) {
    const errorEl = document.getElementById('error');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    hideLoading();
}

function hideError() {
    document.getElementById('error').classList.add('hidden');
}

function isLoggedIn() {
    return authToken !== null;
}

// ============================================
// METHOD 1: XMLHttpRequest
// ============================================

function xhrRequest(url, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Accept', 'application/json');
        if (authToken) {
            xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
        }

        xhr.onreadystatechange = function () {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch (e) {
                        resolve(xhr.responseText);
                    }
                } else {
                    reject(new Error(`Error ${xhr.status}: ${xhr.statusText}`));
                }
            }
        };

        xhr.onerror = function () {
            reject(new Error('Network error'));
        };

        xhr.send(body ? JSON.stringify(body) : null);
    });
}

// ============================================
// METHOD 2: Fetch API
// ============================================

async function fetchRequest(url, method = 'GET', body = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    if (authToken) {
        options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
    return response.json();
}

// ============================================
// ROUTER: Call correct method
// ============================================

function apiRequest(url, method = 'GET', body = null) {
    if (currentMethod === 'xhr') {
        return xhrRequest(url, method, body);
    }
    return fetchRequest(url, method, body);
}

// ============================================
// NAVIGATION
// ============================================

function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    // Show selected page
    document.getElementById(`page-${pageName}`).classList.remove('hidden');
    // Update nav active state
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    event.target.classList.add('active');
    // Load data if needed
    if (pageName === 'profile' && isLoggedIn()) {
        loadProfile();
    }
}

// ============================================
// AUTH: Login / Logout
// ============================================

function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }

    // Demo mode: simulate login
    if (API_MODE === 'demo') {
        setTimeout(() => {
            authToken = 'demo-token-' + Date.now();
            currentUser = { id: 1, name: email.split('@')[0], email: email };
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateAuthUI();
            showPage('home');
            loadPosts();
        }, 800);
        return;
    }

    // Laravel mode
    apiRequest(`${getApiUrl()}/login`, 'POST', { email, password })
        .then(data => {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateAuthUI();
            showPage('home');
            loadPosts();
        })
        .catch(error => {
            alert(`Login failed: ${error.message}`);
        });
}

function handleLogout() {
    if (API_MODE === 'demo') {
        setTimeout(() => {
            authToken = null;
            currentUser = null;
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            updateAuthUI();
            showPage('home');
        }, 500);
        return;
    }

    apiRequest(`${getApiUrl()}/logout`, 'POST')
        .then(() => {
            authToken = null;
            currentUser = null;
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            updateAuthUI();
            showPage('home');
        })
        .catch(error => {
            alert(`Logout failed: ${error.message}`);
        });
}

function updateAuthUI() {
    const navUser = document.getElementById('nav-user');
    const navLoginBtn = document.getElementById('nav-login-btn');
    const navLogoutBtn = document.getElementById('nav-logout-btn');
    const createSection = document.getElementById('create-post-section');

    if (isLoggedIn()) {
        navUser.textContent = `Hello, ${currentUser.name}`;
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

function loadPosts() {
    showLoading();
    hideError();

    apiRequest(`${getApiUrl()}/posts?_limit=10`)
        .then(data => {
            posts = data;
            hideLoading();
            displayPosts();
        })
        .catch(error => {
            showError(`Failed to load posts: ${error.message}`);
        });
}

function handleCreatePost() {
    const title = document.getElementById('post-title').value.trim();
    const body = document.getElementById('post-body').value.trim();

    if (!title || !body) {
        alert('Please enter both title and body');
        return;
    }

    if (!isLoggedIn()) {
        alert('Please login first');
        return;
    }

    showLoading();

    const postData = {
        title: title,
        body: body,
        userId: currentUser.id
    };

    apiRequest(`${getApiUrl()}/posts`, 'POST', postData)
        .then(newPost => {
            newPost.id = newPost.id || Date.now();
            newPost.userId = currentUser.id;
            posts.unshift(newPost);
            hideLoading();
            displayPosts();
            document.getElementById('post-title').value = '';
            document.getElementById('post-body').value = '';
        })
        .catch(error => {
            showError(`Failed to create post: ${error.message}`);
        });
}

function handleDeletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;

    showLoading();

    apiRequest(`${getApiUrl()}/posts/${postId}`, 'DELETE')
        .then(() => {
            posts = posts.filter(p => p.id !== postId);
            hideLoading();
            displayPosts();
        })
        .catch(error => {
            showError(`Failed to delete post: ${error.message}`);
        });
}

// ============================================
// COMMENTS: Load / Add
// ============================================

function loadComments(postId, container) {
    // Get local comments for this post
    const local = localComments[postId] || [];

    apiRequest(`${getApiUrl()}/posts/${postId}/comments`)
        .then(apiComments => {
            // Merge API comments with local comments
            const allComments = [...apiComments, ...local];
            displayComments(allComments, container);
        })
        .catch(error => {
            // If API fails, show only local comments
            displayComments(local, container);
        });
}

function handleAddComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();

    if (!content) {
        alert('Please enter a comment');
        return;
    }

    if (!isLoggedIn()) {
        alert('Please login first');
        return;
    }

    // Create comment object
    const newComment = {
        id: Date.now(),
        post_id: postId,
        email: currentUser.email,
        name: currentUser.name,
        body: content
    };

    // Save to localStorage
    if (!localComments[postId]) {
        localComments[postId] = [];
    }
    localComments[postId].push(newComment);
    localStorage.setItem('localComments', JSON.stringify(localComments));

    // Clear input
    input.value = '';

    // Immediately display the comment
    const container = document.getElementById(`comments-${postId}`);
    if (container) {
        // If container is empty or showing placeholder, reload all comments
        const currentComments = container.querySelectorAll('.comment-card');
        if (currentComments.length === 0) {
            loadComments(postId, container);
        } else {
            // Just append the new comment
            displayComments([newComment], container, true);
        }
    }
}

// ============================================
// LIKES
// ============================================

function handleLike(postId) {
    const index = likedPosts.indexOf(postId);
    if (index === -1) {
        likedPosts.push(postId);
    } else {
        likedPosts.splice(index, 1);
    }
    localStorage.setItem('likedPosts', JSON.stringify(likedPosts));
    displayPosts();
}

// ============================================
// PROFILE
// ============================================

function loadProfile() {
    if (!isLoggedIn()) return;

    document.getElementById('profile-name').textContent = currentUser.name;
    document.getElementById('profile-email').textContent = currentUser.email;
    document.getElementById('profile-initial').textContent = currentUser.name.charAt(0).toUpperCase();
    document.getElementById('profile-bio').textContent = `Welcome back, ${currentUser.name}! This is your personal space.`;

    // Count user's posts
    const userPosts = posts.filter(p => p.userId === currentUser.id);
    document.getElementById('stat-posts').textContent = userPosts.length;
    document.getElementById('stat-likes').textContent = likedPosts.length;

    // Display user's posts
    const container = document.getElementById('user-posts-container');
    container.innerHTML = '';

    if (userPosts.length === 0) {
        container.innerHTML = '<p class="placeholder">You haven\'t posted anything yet</p>';
    } else {
        userPosts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'post-card';
            card.innerHTML = `
                <h3>${post.title}</h3>
                <p>${post.body}</p>
                <div class="post-meta">
                    <span class="post-author">By: ${currentUser.name}</span>
                    <button class="btn-delete" onclick="handleDeletePost(${post.id})">Delete</button>
                </div>
            `;
            container.appendChild(card);
        });
    }
}

// ============================================
// DOM: Display Posts
// ============================================

function displayPosts() {
    const container = document.getElementById('posts-container');
    container.innerHTML = '';

    if (!posts || posts.length === 0) {
        container.innerHTML = '<p class="placeholder">No posts found</p>';
        return;
    }

    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'post-card';

        const title = document.createElement('h3');
        title.textContent = post.title;

        const body = document.createElement('p');
        body.textContent = post.body;

        const meta = document.createElement('div');
        meta.className = 'post-meta';

        const author = document.createElement('span');
        author.className = 'post-author';
        author.textContent = `By: User #${post.userId}`;

        const actions = document.createElement('div');
        actions.className = 'post-actions';

        // Like button
        const likeBtn = document.createElement('button');
        likeBtn.className = 'btn-like' + (likedPosts.includes(post.id) ? ' liked' : '');
        likeBtn.textContent = likedPosts.includes(post.id) ? 'Liked' : 'Like';
        likeBtn.onclick = () => handleLike(post.id);

        // Comments button
        const commentsBtn = document.createElement('button');
        commentsBtn.className = 'btn-comments';
        commentsBtn.textContent = 'Comments';
        commentsBtn.onclick = () => toggleComments(post.id);

        // Delete button (only for logged in user's posts)
        if (isLoggedIn() && post.userId === currentUser.id) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete';
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => handleDeletePost(post.id);
            actions.appendChild(deleteBtn);
        }

        actions.appendChild(likeBtn);
        actions.appendChild(commentsBtn);
        meta.appendChild(author);
        meta.appendChild(actions);

        // Comments section
        const commentsSection = document.createElement('div');
        commentsSection.className = 'comments-section hidden';
        commentsSection.id = `comments-section-${post.id}`;

        const commentsTitle = document.createElement('h4');
        commentsTitle.textContent = 'Comments';

        const commentsContainer = document.createElement('div');
        commentsContainer.id = `comments-${post.id}`;

        commentsSection.appendChild(commentsTitle);
        commentsSection.appendChild(commentsContainer);

        // Comment form (only for logged in users)
        if (isLoggedIn()) {
            const form = document.createElement('div');
            form.className = 'comment-form';

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Write a comment...';
            input.id = `comment-input-${post.id}`;

            const btn = document.createElement('button');
            btn.textContent = 'Post';
            btn.onclick = () => handleAddComment(post.id);

            form.appendChild(input);
            form.appendChild(btn);
            commentsSection.appendChild(form);
        }

        card.appendChild(title);
        card.appendChild(body);
        card.appendChild(meta);
        card.appendChild(commentsSection);
        container.appendChild(card);
    });
}

function toggleComments(postId) {
    const section = document.getElementById(`comments-section-${postId}`);
    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        loadComments(postId, document.getElementById(`comments-${postId}`));
    } else {
        section.classList.add('hidden');
    }
}

function displayComments(comments, container, append = false) {
    if (!append) {
        container.innerHTML = '';
    }

    if (!comments || comments.length === 0) {
        if (!append) {
            container.innerHTML = '<p class="placeholder">No comments yet. Be the first!</p>';
        }
        return;
    }

    // Remove placeholder if appending
    if (append) {
        const placeholder = container.querySelector('.placeholder');
        if (placeholder) placeholder.remove();
    }

    comments.forEach(comment => {
        const card = document.createElement('div');
        card.className = 'comment-card';

        const author = document.createElement('div');
        author.className = 'comment-author';
        author.textContent = comment.email || comment.name || `User #${comment.id}`;

        const body = document.createElement('div');
        body.className = 'comment-body';
        body.textContent = comment.body;

        card.appendChild(author);
        card.appendChild(body);
        container.appendChild(card);
    });
}

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('My Blog loaded');
    updateAuthUI();
    if (isLoggedIn()) {
        loadPosts();
    }
});
