from flask import Flask, request, jsonify, redirect, url_for, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
import sqlite3 # For direct SQLite interaction

app = Flask(__name__, static_folder='.', static_url_path='') # Serving static files from root
app.secret_key = 'your_super_secret_key' # IMPORTANT: Change this to a strong, random key in production!

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

DATABASE = 'database.db'

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT UNIQUE
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            academic_year TEXT NOT NULL,
            semester TEXT NOT NULL,
            subject_code TEXT NOT NULL,
            notes_type TEXT NOT NULL,
            description TEXT,
            file_path TEXT NOT NULL UNIQUE,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row # This allows accessing columns by name
    return conn

# Ensure database tables are created on application startup
with app.app_context():
    init_db()

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('serve_html', filename='home.html'))
    return redirect(url_for('serve_html', filename='auth.html'))

@app.route('/<path:filename>')
def serve_html(filename):
    # Protect home.html and upload.html
    if filename in ['home.html', 'upload.html'] and 'user_id' not in session:
        return redirect(url_for('serve_html', filename='auth.html'))
    return send_from_directory('.', filename)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')

    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password are required.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        hashed_password = generate_password_hash(password)
        cursor.execute("INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)",
                       (username, hashed_password, email))
        conn.commit()
        return jsonify({'success': True, 'message': 'Registration successful!'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'Username or email already exists.'}), 409
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'success': True, 'message': 'Login successful!'}), 200
    else:
        return jsonify({'success': False, 'message': 'Invalid username or password.'}), 401

@app.route('/api/logout')
def logout():
    session.pop('user_id', None)
    session.pop('username', None)
    return jsonify({'success': True, 'message': 'Logged out successfully!'}), 200

@app.route('/api/user')
def get_user_info():
    if 'user_id' in session:
        conn = get_db_connection()
        user = conn.execute("SELECT id, username, email FROM users WHERE id = ?", (session['user_id'],)).fetchone()
        conn.close()
        if user:
            return jsonify({'id': user['id'], 'username': user['username'], 'email': user['email']}), 200
    return jsonify({'message': 'Not authenticated'}), 401

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/upload_note', methods=['POST'])
def upload_note():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Authentication required.'}), 401

    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400

    if not allowed_file(file.filename):
        return jsonify({'success': False, 'message': 'Invalid file type. Allowed: PDF, DOC, DOCX, TXT, PPT, PPTX, ODT, ODS, ODP, RTF.'}), 400
    
    try:
        academic_year = request.form.get('academicYear')
        semester = request.form.get('semester')
        subject_code = request.form.get('subject')
        notes_type = request.form.get('notesType')
        description = request.form.get('description')
        title = request.form.get('title') # Assuming frontend sends a 'title'

        if not all([academic_year, semester, subject_code, notes_type, title]):
            return jsonify({'success': False, 'message': 'Missing required note metadata.'}), 400

        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)

        # Ensure filename is unique to avoid overwriting
        counter = 1
        base_name, ext = os.path.splitext(filename)
        while os.path.exists(file_path):
            file_path = os.path.join(UPLOAD_FOLDER, f"{base_name}_{counter}{ext}")
            counter += 1

        file.save(file_path)

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO notes (user_id, title, academic_year, semester, subject_code, notes_type, description, file_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (session['user_id'], title, academic_year, semester, subject_code, notes_type, description, file_path)
        )
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'File uploaded and note saved successfully!'}), 201
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        print(f"Error during file upload: {e}")
        return jsonify({'success': False, 'message': f'Failed to upload note: {str(e)}'}), 500

@app.route('/uploads/<filename>')
def download_file(filename):
    if 'user_id' not in session:
        return jsonify({'message': 'Authentication required to download.'}), 401
    
    conn = get_db_connection()
    # Construct full file path for lookup
    full_file_path = os.path.join(UPLOAD_FOLDER, filename)
    note = conn.execute("SELECT * FROM notes WHERE file_path = ?", (full_file_path,)).fetchone()
    conn.close()

    if note and note['user_id'] == session['user_id']:
        return send_from_directory(UPLOAD_FOLDER, filename)
    else:
        return jsonify({'message': 'File not found or access denied.'}), 404

@app.route('/api/notes', methods=['GET'])
def get_notes():
    if 'user_id' not in session:
        return jsonify({'message': 'Authentication required.'}), 401

    conn = get_db_connection()
    notes = conn.execute("SELECT * FROM notes WHERE user_id = ? ORDER BY uploaded_at DESC", (session['user_id'],)).fetchall()
    conn.close()

    notes_list = []
    for note in notes:
        notes_list.append({
            'id': note['id'],
            'title': note['title'],
            'academic_year': note['academic_year'],
            'semester': note['semester'],
            'subject_code': note['subject_code'],
            'notes_type': note['notes_type'],
            'description': note['description'],
            'file_url': url_for('download_file', filename=os.path.basename(note['file_path'])),
            'uploaded_at': note['uploaded_at']
        })
    return jsonify(notes_list), 200

if __name__ == '__main__':
    app.run(debug=True) # Run in debug mode for development
