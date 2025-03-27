import os
import logging
import tempfile
import torch
from pathlib import Path
import whisper

logger = logging.getLogger(__name__)

class WhisperTranscriber:
    """Class to handle audio transcription using Whisper ASR"""
    
    def __init__(self, model_name="base"):
        """
        Initialize the WhisperTranscriber with a specific model size
        
        Args:
            model_name (str): The Whisper model size to use ('tiny', 'base', 'small', 'medium', 'large')
        """
        logger.info(f"Initializing WhisperTranscriber with model: {model_name}")
        
        # Check if CUDA is available
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {self.device}")
        
        # Load the Whisper model
        try:
            self.model = whisper.load_model(model_name, device=self.device)
            logger.info(f"Successfully loaded Whisper model: {model_name}")
        except Exception as e:
            logger.error(f"Error loading Whisper model: {e}")
            raise
    
    def transcribe(self, audio_path):
        """
        Transcribe an audio file
        
        Args:
            audio_path (str): Path to the audio file to transcribe
            
        Returns:
            str: The transcribed text
        """
        logger.info(f"Transcribing audio file: {audio_path}")
        
        try:
            # Check if file exists
            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Audio file not found: {audio_path}")
            
            # Transcribe the audio
            result = self.model.transcribe(audio_path, language = "en")
            transcription = result["text"].strip()
            
            logger.info(f"Transcription completed successfully")
            return transcription
        
        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
            raise
    
    def transcribe_from_buffer(self, audio_buffer, file_extension=".webm"):
        """
        Transcribe audio from a buffer
        
        Args:
            audio_buffer (bytes): Audio data as bytes
            file_extension (str): The file extension to use when saving the temporary file
            
        Returns:
            str: The transcribed text
        """
        logger.info("Transcribing audio from buffer")
        
        try:
            # Save buffer to temporary file
            with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
                temp_file.write(audio_buffer)
                temp_path = temp_file.name
            
            # Transcribe the temporary file
            transcription = self.transcribe(temp_path)
            
            # Clean up
            os.unlink(temp_path)
            
            return transcription
        
        except Exception as e:
            logger.error(f"Error transcribing audio from buffer: {e}")
            raise
