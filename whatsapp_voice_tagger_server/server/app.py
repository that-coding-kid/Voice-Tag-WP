import os
import logging
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import tempfile
import uuid
from werkzeug.utils import secure_filename

from server.transcriber import WhisperTranscriber
from server.entity_extractor import EntityExtractor
from server.model_downloader import ensure_models_downloaded

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "whatsapp_voice_tagger_secret")
CORS(app)  # Enable CORS for all routes

# Create upload directory
UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), 'whatsapp_voice_tagger')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize models
transcriber = None
entity_extractor = None

def initialize_models():
    global transcriber, entity_extractor
    
    logger.info("Ensuring models are downloaded...")
    ensure_models_downloaded()
    
    logger.info("Initializing models...")
    transcriber = WhisperTranscriber()
    entity_extractor = EntityExtractor()
    
    logger.info("Models initialized successfully")

# Initialize models when the app starts
with app.app_context():
    initialize_models()

@app.route('/')
def index():
    """Render the homepage"""
    return render_template('index.html')

@app.route('/process_audio', methods=['POST'])
def process_audio():
    """Process audio file to extract addressee"""
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    try:
        # Save uploaded file
        audio_file = request.files['audio']
        filename = str(uuid.uuid4()) + secure_filename(audio_file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        audio_file.save(filepath)
        
        logger.info(f"Saved audio file to {filepath}")
        
        # Ensure models are initialized
        global transcriber, entity_extractor
        if transcriber is None or entity_extractor is None:
            initialize_models()
        
        # Transcribe audio
        logger.info("Transcribing audio...")
        transcription = transcriber.transcribe(filepath)
        logger.info(f"Transcription: {transcription}")
        
        # Extract addressee
        logger.info("Extracting addressee...")
        addressee = entity_extractor.extract_addressee(transcription)
        logger.info(f"Extracted addressee: {addressee}")
        
        # Clean up
        os.remove(filepath)
        
        return jsonify({
            "success": True,
            "transcription": transcription,
            "addressee": addressee
        })
    
    except Exception as e:
        logger.exception("Error processing audio")
        return jsonify({"error": str(e)}), 500

@app.route('/status')
def status():
    """Check the status of the server and models"""
    global transcriber, entity_extractor
    
    return jsonify({
        "server": "running",
        "models_initialized": transcriber is not None and entity_extractor is not None,
    })

@app.route('/static/<path:path>')
def send_static(path):
    """Serve static files"""
    return send_from_directory('static', path)

@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors"""
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def server_error(e):
    """Handle 500 errors"""
    logger.exception("Server error")
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
