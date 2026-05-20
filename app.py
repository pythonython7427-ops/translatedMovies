from flask import Flask, render_template, request, redirect, url_for, flash, session, send_from_directory, abort, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
from datetime import datetime
import json
import errno
import mimetypes

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-change-this-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Upload and video configurations
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['VIDEO_FOLDER'] = 'videos'
app.config['ALLOWED_VIDEO_EXTENSIONS'] = {'mp4', 'webm', 'avi', 'mkv', 'mov'}
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

# Create directories safely
try:
    os.makedirs(app.config['UPLOAD_FOLDER'])
except OSError as e:
    if e.errno != errno.EEXIST:
        raise

try:
    os.makedirs(app.config['VIDEO_FOLDER'])
except OSError as e:
    if e.errno != errno.EEXIST:
        raise

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'landing'

# Helper function to get MIME type
def get_mime_type(filename):
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or 'video/mp4'

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_premium = db.Column(db.Boolean, default=False)
    
    watch_history = db.relationship('WatchHistory', backref='user', lazy=True)
    watchlist = db.relationship('Watchlist', backref='user', lazy=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Video(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    filename = db.Column(db.String(200), nullable=False)
    filepath = db.Column(db.String(300), nullable=False)
    mime_type = db.Column(db.String(100), default='video/mp4')
    thumbnail = db.Column(db.String(200))
    genre = db.Column(db.String(100))
    duration = db.Column(db.String(50))
    release_year = db.Column(db.Integer)
    rating = db.Column(db.Float, default=0)
    description = db.Column(db.Text)
    views = db.Column(db.Integer, default=0)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    watch_history = db.relationship('WatchHistory', backref='video', lazy=True)
    watchlist_items = db.relationship('Watchlist', backref='video', lazy=True)

class WatchHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey('video.id'), nullable=False)
    watched_at = db.Column(db.DateTime, default=datetime.utcnow)
    progress = db.Column(db.Integer, default=0)
    
class Watchlist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey('video.id'), nullable=False)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def allowed_video_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_VIDEO_EXTENSIONS']

# ============================================================
# MAIN ROUTES
# ============================================================

@app.route('/')
def landing():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return render_template('landing.html')

@app.route('/register', methods=['POST'])
def register():
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    
    if User.query.filter_by(username=username).first():
        flash('Username already exists!', 'error')
        return redirect(url_for('landing'))
    
    if User.query.filter_by(email=email).first():
        flash('Email already registered!', 'error')
        return redirect(url_for('landing'))
    
    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    
    flash('Registration successful! Please login.', 'success')
    return redirect(url_for('landing'))

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')
    
    user = User.query.filter_by(username=username).first()
    
    if user and user.check_password(password):
        login_user(user)
        flash(f'Welcome back, {username}!', 'success')
        return redirect(url_for('dashboard'))
    else:
        flash('Invalid username or password!', 'error')
        return redirect(url_for('landing'))

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('landing'))

@app.route('/dashboard')
@login_required
def dashboard():
    watch_count = WatchHistory.query.filter_by(user_id=current_user.id).count()
    watchlist_count = Watchlist.query.filter_by(user_id=current_user.id).count()
    
    continue_watching = db.session.query(Video, WatchHistory).join(
        WatchHistory, Video.id == WatchHistory.video_id
    ).filter(
        WatchHistory.user_id == current_user.id,
        WatchHistory.progress < 95
    ).order_by(WatchHistory.watched_at.desc()).limit(3).all()
    
    watchlist_items = db.session.query(Video).join(
        Watchlist, Video.id == Watchlist.video_id
    ).filter(Watchlist.user_id == current_user.id).limit(5).all()
    
    trending_videos = Video.query.order_by(Video.views.desc()).limit(5).all()
    
    watched_genres = db.session.query(Video.genre).join(
        WatchHistory, Video.id == WatchHistory.video_id
    ).filter(WatchHistory.user_id == current_user.id).distinct().limit(3).all()
    
    recommended = []
    if watched_genres:
        genres = [g[0] for g in watched_genres if g[0]]
        if genres:
            recommended = Video.query.filter(Video.genre.in_(genres)).limit(6).all()
    
    if not recommended:
        recommended = Video.query.limit(6).all()
    
    all_videos = Video.query.all()
    
    return render_template('dashboard.html', 
                         user=current_user,
                         watch_count=watch_count,
                         watchlist_count=watchlist_count,
                         continue_watching=continue_watching,
                         watchlist_items=watchlist_items,
                         trending_videos=trending_videos,
                         recommended=recommended,
                         all_videos=all_videos)

@app.route('/video/<int:video_id>')
@login_required
def video_player(video_id):
    video = Video.query.get_or_404(video_id)
    
    video.views += 1
    db.session.commit()
    
    history = WatchHistory.query.filter_by(
        user_id=current_user.id, 
        video_id=video_id
    ).first()
    
    if not history:
        history = WatchHistory(user_id=current_user.id, video_id=video_id)
        db.session.add(history)
        db.session.commit()
    
    related = Video.query.filter(
        Video.genre == video.genre,
        Video.id != video_id
    ).limit(4).all()
    
    return render_template('video_player.html', video=video, related=related)

@app.route('/watch/<path:filename>')
@login_required
def watch_video(filename):
    try:
        return send_from_directory(app.config['VIDEO_FOLDER'], filename)
    except FileNotFoundError:
        abort(404)

@app.route('/watch-static/<path:filename>')
@login_required
def watch_uploaded_video(filename):
    try:
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    except FileNotFoundError:
        abort(404)

@app.route('/api/progress', methods=['POST'])
@login_required
def update_progress():
    data = request.json
    video_id = data.get('video_id')
    progress = data.get('progress')
    
    history = WatchHistory.query.filter_by(
        user_id=current_user.id,
        video_id=video_id
    ).first()
    
    if history:
        history.progress = progress
        db.session.commit()
    
    return jsonify({'status': 'success'}), 200

@app.route('/api/watchlist/add/<int:video_id>', methods=['POST'])
@login_required
def add_to_watchlist(video_id):
    existing = Watchlist.query.filter_by(
        user_id=current_user.id,
        video_id=video_id
    ).first()
    
    if not existing:
        watchlist_item = Watchlist(user_id=current_user.id, video_id=video_id)
        db.session.add(watchlist_item)
        db.session.commit()
        return jsonify({'status': 'added'}), 200
    
    return jsonify({'status': 'already_exists'}), 200

@app.route('/api/watchlist/remove/<int:video_id>', methods=['POST'])
@login_required
def remove_from_watchlist(video_id):
    Watchlist.query.filter_by(
        user_id=current_user.id,
        video_id=video_id
    ).delete()
    db.session.commit()
    return jsonify({'status': 'removed'}), 200

# ============================================================
# AJAX ROUTES (faster, no page reload)
# ============================================================

@app.route('/api/login', methods=['POST'])
def api_login():
    username = request.form.get('username')
    password = request.form.get('password')
    
    user = User.query.filter_by(username=username).first()
    
    if user and user.check_password(password):
        login_user(user)
        return jsonify({
            'status': 'success',
            'message': f'Welcome back, {username}!',
            'redirect': url_for('dashboard')
        }), 200
    else:
        return jsonify({
            'status': 'error',
            'message': 'Invalid username or password!'
        }), 401

@app.route('/api/register', methods=['POST'])
def api_register():
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    
    if User.query.filter_by(username=username).first():
        return jsonify({
            'status': 'error',
            'message': 'Username already exists!'
        }), 409
    
    if User.query.filter_by(email=email).first():
        return jsonify({
            'status': 'error',
            'message': 'Email already registered!'
        }), 409
    
    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    
    return jsonify({
        'status': 'success',
        'message': 'Registration successful! Please login.',
        'action': 'switch-to-login'
    }), 200

@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    logout_user()
    return jsonify({
        'status': 'success',
        'message': 'You have been logged out.',
        'redirect': url_for('landing')
    }), 200

@app.route('/api/watchlist/toggle/<int:video_id>', methods=['POST'])
@login_required
def api_toggle_watchlist(video_id):
    existing = Watchlist.query.filter_by(
        user_id=current_user.id,
        video_id=video_id
    ).first()
    
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({
            'status': 'removed',
            'message': 'Removed from watchlist'
        }), 200
    else:
        item = Watchlist(user_id=current_user.id, video_id=video_id)
        db.session.add(item)
        db.session.commit()
        return jsonify({
            'status': 'added',
            'message': 'Added to watchlist!'
        }), 200

@app.route('/api/watchlist/count', methods=['GET'])
@login_required
def api_watchlist_count():
    count = Watchlist.query.filter_by(user_id=current_user.id).count()
    return jsonify({'count': count}), 200

# ============================================================
# ADMIN ROUTES
# ============================================================

@app.route('/admin')
@login_required
def admin_dashboard():
    if current_user.username != 'admin':
        flash('Admin access required!', 'error')
        return redirect(url_for('dashboard'))
    
    videos = Video.query.order_by(Video.uploaded_at.desc()).all()
    total_users = User.query.count()
    total_genres = db.session.query(Video.genre).distinct().count()
    total_views = db.session.query(db.func.sum(Video.views)).scalar() or 0
    
    stats = {
        'total_videos': len(videos),
        'total_views': total_views,
        'total_users': total_users,
        'total_genres': total_genres
    }
    
    return render_template('admin_dashboard.html', videos=videos, stats=stats)

@app.route('/admin/upload', methods=['POST'])
@login_required
def admin_upload():
    if current_user.username != 'admin':
        flash('Admin access required!', 'error')
        return redirect(url_for('dashboard'))
    
    title = request.form.get('title')
    genre = request.form.get('genre')
    description = request.form.get('description')
    release_year = request.form.get('release_year')
    
    video_file = request.files.get('video_file')
    if not video_file or not video_file.filename:
        flash('No video file selected!', 'error')
        return redirect(url_for('admin_dashboard'))
    
    if allowed_video_file(video_file.filename):
        filename = secure_filename(video_file.filename)
        # Avoid overwriting existing files
        filepath = os.path.join(app.config['VIDEO_FOLDER'], filename)
        counter = 1
        while os.path.exists(filepath):
            name, ext = os.path.splitext(filename)
            filename = f"{name}_{counter}{ext}"
            filepath = os.path.join(app.config['VIDEO_FOLDER'], filename)
            counter += 1
        
        video_file.save(filepath)
        mime = get_mime_type(filename)
        
        video = Video(
            title=title,
            filename=filename,
            filepath=f'/watch/{filename}',
            mime_type=mime,
            genre=genre,
            description=description,
            release_year=int(release_year) if release_year else None,
            rating=0
        )
        db.session.add(video)
        db.session.commit()
        
        flash(f'Video "{title}" uploaded successfully!', 'success')
    else:
        flash('Invalid video file format! Allowed: MP4, WebM, AVI, MKV, MOV', 'error')
    
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/video/<int:video_id>/edit', methods=['POST'])
@login_required
def admin_edit_video(video_id):
    if current_user.username != 'admin':
        flash('Admin access required!', 'error')
        return redirect(url_for('dashboard'))
    
    video = Video.query.get_or_404(video_id)
    video.title = request.form.get('title', video.title)
    video.genre = request.form.get('genre', video.genre)
    video.description = request.form.get('description', video.description)
    
    release_year = request.form.get('release_year')
    if release_year:
        video.release_year = int(release_year)
    
    db.session.commit()
    flash(f'Video "{video.title}" updated successfully!', 'success')
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/video/<int:video_id>/delete', methods=['POST'])
@login_required
def admin_delete_video(video_id):
    if current_user.username != 'admin':
        flash('Admin access required!', 'error')
        return redirect(url_for('dashboard'))
    
    video = Video.query.get_or_404(video_id)
    title = video.title
    
    # Delete the actual file
    file_path = os.path.join(app.config['VIDEO_FOLDER'], video.filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError as e:
            flash(f'Could not delete file: {e}', 'error')
    
    # Delete related records
    WatchHistory.query.filter_by(video_id=video_id).delete()
    Watchlist.query.filter_by(video_id=video_id).delete()
    
    db.session.delete(video)
    db.session.commit()
    
    flash(f'Video "{title}" deleted successfully!', 'success')
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/upload', methods=['GET'])
@login_required
def admin_upload_page():
    """Legacy GET route for the old upload page - redirects to admin dashboard."""
    return redirect(url_for('admin_dashboard'))

# ============================================================
# SAMPLE DATA INITIALIZATION
# ============================================================

def create_sample_data():
    if Video.query.count() == 0:
        video_files = []
        if os.path.exists(app.config['VIDEO_FOLDER']):
            video_files = [f for f in os.listdir(app.config['VIDEO_FOLDER']) 
                          if f.endswith(('.mp4', '.webm', '.mkv', '.avi', '.mov'))]
        
        if video_files:
            for video_file in video_files:
                mime = get_mime_type(video_file)
                name = os.path.splitext(video_file)[0].replace('_', ' ').replace('-', ' ').title()
                
                video = Video(
                    title=name,
                    filename=video_file,
                    filepath=f'/watch/{video_file}',
                    mime_type=mime,
                    genre="Movie",
                    release_year=2024,
                    rating=7.5,
                    description=f"Watch {name} on CINEBOX!"
                )
                db.session.add(video)
                print(f"Added video: {video_file} (type: {mime})")
        else:
            print("\n" + "="*60)
            print("  NO VIDEO FILES FOUND!")
            print("="*60)
            print("  To add videos:")
            print(f"  1. Copy .mp4 files into the '{app.config['VIDEO_FOLDER']}/' folder")
            print("  2. Or login as 'admin' and use the admin panel to upload")
            print("  3. Restart the Flask server")
            print("="*60 + "\n")
        
        db.session.commit()
        print(f"Database initialized with {Video.query.count()} entries")

# Initialize database
with app.app_context():
    db.create_all()
    create_sample_data()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
