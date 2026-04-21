import os
import sqlite3
import hashlib
import datetime
from functools import wraps
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE NOT NULL,
                  password TEXT NOT NULL,
                  created_at TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS messages
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT NOT NULL,
                  text TEXT NOT NULL,
                  timestamp TIMESTAMP)''')
    conn.commit()
    conn.close()

init_db()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Заполните все поля'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Логин не менее 3 символов'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Пароль не менее 4 символов'}), 400
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)",
                  (username, hash_password(password), datetime.datetime.now()))
        conn.commit()
        return jsonify({'success': True, 'message': 'Регистрация успешна'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Пользователь уже существует'}), 400
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, username FROM users WHERE username=? AND password=?", 
              (username, hash_password(password)))
    user = c.fetchone()
    conn.close()
    
    if user:
        session['user_id'] = user[0]
        session['username'] = user[1]
        return jsonify({'success': True, 'username': user[1]})
    else:
        return jsonify({'error': 'Неверный логин или пароль'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/me')
def me():
    if 'user_id' in session:
        return jsonify({'username': session['username']})
    return jsonify({'error': 'Not logged in'}), 401

@app.route('/api/messages', methods=['POST'])
@login_required
def send_message():
    data = request.json
    text = data.get('text')
    
    if not text or len(text) > 500:
        return jsonify({'error': 'Сообщение от 1 до 500 символов'}), 400
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO messages (username, text, timestamp) VALUES (?, ?, ?)",
              (session['username'], text, datetime.datetime.now()))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/messages', methods=['GET'])
@login_required
def get_messages():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT username, text, timestamp FROM messages ORDER BY timestamp DESC LIMIT 100")
    messages = c.fetchall()
    conn.close()
    messages.reverse()
    result = [{'username': m[0], 'text': m[1], 'timestamp': m[2]} for m in messages]
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
