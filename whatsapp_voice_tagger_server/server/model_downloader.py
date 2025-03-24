import os
import logging
import subprocess
import sys
from pathlib import Path
import threading
import tempfile
import shutil

logger = logging.getLogger(__name__)

# Set up environment variables for models
os.environ["TRANSFORMERS_CACHE"] = os.path.join(tempfile.gettempdir(), "transformers_cache")
os.environ["HF_HOME"] = os.path.join(tempfile.gettempdir(), "hf_home")

def ensure_models_downloaded():
    """
    Ensure that all required models are downloaded
    
    Returns:
        bool: True if all models are downloaded, False otherwise
    """
    logger.info("Ensuring all required models are downloaded")
    
    try:
        # Check and download Whisper model
        ensure_whisper_model()
        
        # Check and download spaCy model
        ensure_spacy_model()
        
        logger.info("All models are downloaded and ready to use")
        return True
    
    except Exception as e:
        logger.error(f"Error ensuring models are downloaded: {e}")
        return False

def ensure_whisper_model(model_name="base"):
    """
    Ensure that the Whisper model is downloaded
    
    Args:
        model_name (str): The Whisper model to download
        
    Returns:
        bool: True if the model is downloaded, False otherwise
    """
    logger.info(f"Ensuring Whisper model is downloaded: {model_name}")
    
    try:
        # Using a try/except block to import whisper
        # This will trigger the model download if not already downloaded
        import whisper
        
        # Load the model to trigger download if needed
        model = whisper.load_model(model_name)
        
        logger.info(f"Whisper model '{model_name}' is ready")
        return True
    
    except Exception as e:
        logger.error(f"Error loading Whisper model: {e}")
        
        # Try to install whisper if not installed
        try:
            subprocess.run([
                sys.executable, "-m", "pip", "install", "git+https://github.com/openai/whisper.git"
            ], check=True)
            
            # Try importing again
            import whisper
            model = whisper.load_model(model_name)
            
            logger.info(f"Successfully installed Whisper and downloaded model {model_name}")
            return True
        
        except Exception as e2:
            logger.error(f"Error installing Whisper: {e2}")
            return False

def ensure_spacy_model(model_name="en_core_web_sm"):
    """
    Ensure that the spaCy model is downloaded
    
    Args:
        model_name (str): The spaCy model to download
        
    Returns:
        bool: True if the model is downloaded, False otherwise
    """
    logger.info(f"Ensuring spaCy model is downloaded: {model_name}")
    
    try:
        # Try importing spaCy
        import spacy
        
        # Check if model is already downloaded
        try:
            spacy.load(model_name)
            logger.info(f"spaCy model '{model_name}' is already downloaded")
            return True
        
        except OSError:
            logger.info(f"spaCy model '{model_name}' not found, downloading...")
            
            # Download the model
            subprocess.run([
                sys.executable, "-m", "spacy", "download", model_name
            ], check=True)
            
            # Verify the model is now downloadable
            spacy.load(model_name)
            
            logger.info(f"Successfully downloaded spaCy model: {model_name}")
            return True
    
    except Exception as e:
        logger.error(f"Error ensuring spaCy model: {e}")
        
        # Try to install spaCy if not installed
        try:
            subprocess.run([
                sys.executable, "-m", "pip", "install", "spacy"
            ], check=True)
            
            # Try downloading the model again
            subprocess.run([
                sys.executable, "-m", "spacy", "download", model_name
            ], check=True)
            
            # Verify the model is downloaded
            import spacy
            spacy.load(model_name)
            
            logger.info(f"Successfully installed spaCy and downloaded model {model_name}")
            return True
        
        except Exception as e2:
            logger.error(f"Error installing spaCy: {e2}")
            return False

def download_models_async():
    """
    Download models asynchronously
    
    Returns:
        threading.Thread: Thread that is downloading the models
    """
    thread = threading.Thread(target=ensure_models_downloaded)
    thread.daemon = True
    thread.start()
    return thread

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    ensure_models_downloaded()
