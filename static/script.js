const API_BASE = '';

async function apiCall(url, method, body = null) {
    const options = {
        method: method,
        headers: {'Content-Type': 'application/json'}
    };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ошибка запроса');
    return data;
}

document.getElementById('registerBtn').onclick = async () => {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const errorDiv = document.getElementById('regError');
    
    if (username.length < 3) {
        errorDiv.textContent = 'Логин не менее 3 символов';
        return;
    }
    if (password.length < 4) {
        errorDiv.textContent = 'Пароль не менее 4 символов';
        return;
    }
    
    try {
        await apiCall('/api/register', 'POST', {username, password});
        errorDiv.style.color = 'green';
        errorDiv.textContent = 'Регистрация успешна! Теперь войдите.';
        document.querySelector('[data-tab="login"]').click();
        document.getElementById('loginUsername').value = username;
        document.getElementById('loginPassword').value = '';
    } catch (err) {
        errorDiv.style.color = '#e53e3e';
        errorDiv.textContent = err.message;
    }
};

document.getElementById('loginBtn').onclick = async () => {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        const data = await apiCall('/api/login', 'POST', {username, password});
        document.getElementById('currentUser').textContent = data.username;
        showChat();
        loadMessages();
        startPolling();
    } catch (err) {
        errorDiv.textContent = err.message;
    }
};

document.getElementById('logoutBtn').onclick = async () => {
    await apiCall('/api/logout', 'POST');
    showAuth();
    stopPolling();
};

document.getElementById('sendBtn').onclick = async () => {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;
    try {
        await apiCall('/api/messages', 'POST', {text});
        input.value = '';
        loadMessages();
    } catch (err) {
        console.error(err);
    }
};

async function loadMessages() {
    try {
        const messages = await apiCall('/api/messages', 'GET');
        const container = document.getElementById('messagesContainer');
        const currentUser = document.getElementById('currentUser').textContent;
        container.innerHTML = '';
        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.username === currentUser ? 'own' : 'other'}`;
            const header = document.createElement('div');
            header.className = 'message-header';
            header.textContent = msg.username;
            const text = document.createElement('div');
            text.className = 'message-text';
            text.textContent = msg.text;
            messageDiv.appendChild(header);
            messageDiv.appendChild(text);
            container.appendChild(messageDiv);
        });
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        console.error('Ошибка загрузки сообщений', err);
    }
}

let pollingInterval = null;
function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(loadMessages, 2000);
}
function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

function showAuth() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('chatScreen').style.display = 'none';
}
function showChat() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('chatScreen').style.display = 'flex';
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('loginForm').classList.toggle('active', tab === 'login');
        document.getElementById('registerForm').classList.toggle('active', tab === 'register');
    };
});

document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('sendBtn').click();
});

(async function checkInitialAuth() {
    try {
        const data = await apiCall('/api/me', 'GET');
        document.getElementById('currentUser').textContent = data.username;
        showChat();
        loadMessages();
        startPolling();
    } catch (err) {
        showAuth();
    }
})();
