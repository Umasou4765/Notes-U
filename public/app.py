import os
import psycopg2 # Import psycopg2 for PostgreSQL interaction
from psycopg2.extras import RealDictCursor # Optional: Allows fetching rows as dictionaries
from flask import Flask, request, jsonify, redirect, url_for, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='.', static_url_path='')
# IMPORTANT: Use an environment variable for secret_key in production!
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'your_super_secret_key_default')

UPLOAD_FOLDER = 'uploads'
# Create upload directory if it doesn't exist (for local development)
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# --- PostgreSQL Database Configuration ---
# Get DATABASE_URL from environment variable (Render will set this)
DATABASE_URL = os.environ.get('DATABASE_URL')

# Fallback for local development: Replace with your actual Supabase connection string
# This is for local testing ONLY. In production, Render injects DATABASE_URL.
if not DATABASE_URL:
    print("DATABASE_URL environment variable not set. Using a placeholder for local development.")
    # !!! IMPORTANT: Replace 'YOUR_SUPABASE_PASSWORD' and 'xuczjxnppgloquehmhcj'
    # !!! with your actual Supabase project's password and project reference ID.
    DATABASE_URL = "postgresql://postgres:061107Lex!@db.xuczjxnppgloquehmhcj.supabase.co:5432/postgres"

def get_db_connection():
    """Establishes a connection to the PostgreSQL database."""
    conn = psycopg2.connect(DATABASE_URL)
    # Optional: Use RealDictCursor to fetch rows as dictionaries, similar to sqlite3.Row
    # If not used, rows will be tuples and you'll access data by index (e.g., row[0]).
    return conn

def init_db():
    """Initializes the database schema (creates tables if they don't exist)."""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Use SERIAL PRIMARY KEY for auto-incrementing integers in PostgreSQL
        # Use TEXT for strings, TIMESTAMP WITH TIME ZONE for dates/times
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT UNIQUE
            );
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                academic_year TEXT NOT NULL,
                semester TEXT NOT NULL,
                subject_code TEXT NOT NULL,
                notes_type TEXT NOT NULL,
                description TEXT,
                file_path TEXT NOT NULL UNIQUE,
                uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
        ''')
        conn.commit()
        print("Database tables checked/created successfully.")
    except psycopg2.Error as e:
        print(f"Error initializing database: {e}")
        if conn:
            conn.rollback() # Rollback in case of an error
    finally:
        if conn:
            conn.close()

# Ensure database tables are created on application startup
# For production, consider using a separate database migration tool (e.g., Alembic)
with app.app_context():
    init_db()

@app.route('/')
def index():
    """Redirects to home.html if authenticated, otherwise to auth.html."""
    if 'user_id' in session:
        return redirect(url_for('serve_html', filename='home.html'))
    return redirect(url_for('serve_html', filename='auth.html'))

@app.route('/<path:filename>')
def serve_html(filename):
    """Serves static HTML files, protecting authenticated pages."""
    # Protect home.html and upload.html by redirecting to login if not authenticated
    if filename in ['home.html', 'upload.html'] and 'user_id' not in session:
        return redirect(url_for('serve_html', filename='auth.html?mode=login'))
    return send_from_directory('.', filename)

@app.route('/api/register', methods=['POST'])
def register():
    """Handles user registration."""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')

    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password are required.'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        hashed_password = generate_password_hash(password)
        # Use %s as placeholder for PostgreSQL
        cursor.execute("INSERT INTO users (username, password_hash, email) VALUES (%s, %s, %s)",
                       (username, hashed_password, email))
        conn.commit()
        return jsonify({'success': True, 'message': 'Registration successful!'}), 201
    except psycopg2.errors.UniqueViolation: # Specific error for unique constraint violation in psycopg2
        if conn:
            conn.rollback() # Rollback transaction on unique constraint error
        return jsonify({'success': False, 'message': 'Username or email already exists.'}), 409
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error during registration: {e}")
        return jsonify({'success': False, 'message': f'Registration failed: {str(e)}'}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    """Handles user login."""
    data = request.json
    username = data.get('username')
    password = data.get('password')

    conn = None
    user = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor) # Use RealDictCursor here
        cursor.execute("SELECT id, username, password_hash FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
    except Exception as e:
        print(f"Error fetching user for login: {e}")
        return jsonify({'success': False, 'message': 'An internal error occurred.'}), 500
    finally:
        if conn:
            conn.close()

    # Access by key if using RealDictCursor: user['password_hash']
    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'success': True, 'message': 'Login successful!'}), 200
    else:
        return jsonify({'success': False, 'message': 'Invalid username or password.'}), 401

@app.route('/api/logout')
def logout():
    """Handles user logout."""
    session.pop('user_id', None)
    session.pop('username', None)
    return jsonify({'success': True, 'message': 'Logged out successfully!'}), 200

@app.route('/api/user')
def get_user_info():
    """Retrieves authenticated user's information."""
    if 'user_id' in session:
        conn = None
        user = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT id, username, email FROM users WHERE id = %s", (session['user_id'],))
            user = cursor.fetchone()
        except Exception as e:
            print(f"Error fetching user info: {e}")
            return jsonify({'message': 'Failed to retrieve user info.'}), 500
        finally:
            if conn:
                conn.close()

        if user:
            return jsonify({'id': user['id'], 'username': user['username'], 'email': user['email']}), 200
    return jsonify({'message': 'Not authenticated'}), 401

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'}

def allowed_file(filename):
    """Checks if the uploaded file's extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/upload_note', methods=['POST'])
def upload_note():
    """Handles note file uploads and saves metadata to the database."""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Authentication required.'}), 401

    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400

    if not allowed_file(file.filename):
        return jsonify({'success': False, 'message': 'Invalid file type. Allowed: PDF, DOC, DOCX, TXT, PPT, PPTX, ODT, ODS, ODP, RTF.'}), 400

    file_path = None # Initialize to None for cleanup in case of early error
    conn = None
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
            "INSERT INTO notes (user_id, title, academic_year, semester, subject_code, notes_type, description, file_path) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (session['user_id'], title, academic_year, semester, subject_code, notes_type, description, file_path)
        )
        conn.commit()

        return jsonify({'success': True, 'message': 'File uploaded and note saved successfully!'}), 201
    except Exception as e:
        # If an error occurs after saving the file but before DB commit, delete the file
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        if conn:
            conn.rollback() # Rollback database transaction on error
        print(f"Error during file upload: {e}")
        return jsonify({'success': False, 'message': f'Failed to upload note: {str(e)}'}), 500
    finally:
        if conn:
            conn.close()

@app.route('/uploads/<filename>')
def download_file(filename):
    """Allows authenticated users to download their uploaded files."""
    if 'user_id' not in session:
        return jsonify({'message': 'Authentication required to download.'}), 401

    conn = None
    note = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        # Construct full file path for lookup. Ensure file_path in DB is the actual path.
        full_file_path_in_db = os.path.join(UPLOAD_FOLDER, filename) # Assuming stored as relative path
        cursor.execute("SELECT user_id FROM notes WHERE file_path = %s", (full_file_path_in_db,))
        note = cursor.fetchone()
    except Exception as e:
        print(f"Error checking file for download: {e}")
        return jsonify({'message': 'Failed to verify file for download.'}), 500
    finally:
        if conn:
            conn.close()

    # Check if the file exists and belongs to the current user
    if note and note['user_id'] == session['user_id']:
        # send_from_directory automatically handles security checks for the path
        return send_from_directory(UPLOAD_FOLDER, filename)
    else:
        return jsonify({'message': 'File not found or access denied.'}), 404

@app.route('/api/notes', methods=['GET'])
def get_notes():
    """Retrieves notes uploaded by the authenticated user."""
    if 'user_id' not in session:
        return jsonify({'message': 'Authentication required.'}), 401

    conn = None
    notes_list = []
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor) # Fetch as dictionaries
        cursor.execute("SELECT id, title, academic_year, semester, subject_code, notes_type, description, file_path, uploaded_at FROM notes WHERE user_id = %s ORDER BY uploaded_at DESC", (session['user_id'],))
        notes = cursor.fetchall()

        for note in notes:
            notes_list.append({
                'id': note['id'],
                'title': note['title'],
                'academic_year': note['academic_year'],
                'semester': note['semester'],
                'subject_code': note['subject_code'],
                'notes_type': note['notes_type'],
                'description': note['description'],
                # Construct file_url using os.path.basename to get just the filename from file_path
                'file_url': url_for('download_file', filename=os.path.basename(note['file_path'])),
                'uploaded_at': note['uploaded_at'].isoformat() # Convert datetime object to ISO format string
            })
    except Exception as e:
        print(f"Error fetching notes: {e}")
        return jsonify({'message': 'Failed to fetch notes.'}), 500
    finally:
        if conn:
            conn.close()
    return jsonify(notes_list), 200

if __name__ == '__main__':
    # When running locally, set FLASK_SECRET_KEY and DATABASE_URL in your environment
    # For example, in your terminal before running:
    # export FLASK_SECRET_KEY='your_strong_random_key'
    # export DATABASE_URL='postgresql://postgres:YOUR_SUPABASE_PASSWORD@db.xuczjxnppgloquehmhcj.supabase.co:5432/postgres'
    app.run(debug=True) # Run in debug mode for development (will restart on code changes)

