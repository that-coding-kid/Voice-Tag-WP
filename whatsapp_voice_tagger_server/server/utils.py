import os
import logging
import tempfile
import requests
from pathlib import Path
import shutil

logger = logging.getLogger(__name__)

def ensure_directory(directory_path):
    """
    Ensure that a directory exists, create it if it doesn't
    
    Args:
        directory_path (str): Path to the directory
        
    Returns:
        Path: Path object to the directory
    """
    path = Path(directory_path)
    path.mkdir(parents=True, exist_ok=True)
    return path

def get_temp_directory(prefix="whatsapp_voice_tagger_"):
    """
    Get a temporary directory
    
    Args:
        prefix (str): Prefix for the temporary directory
        
    Returns:
        Path: Path object to the temporary directory
    """
    temp_dir = tempfile.mkdtemp(prefix=prefix)
    return Path(temp_dir)

def download_file(url, output_path, chunk_size=8192):
    """
    Download a file from a URL
    
    Args:
        url (str): URL to download from
        output_path (str): Path to save the file to
        chunk_size (int): Size of chunks to download
        
    Returns:
        bool: True if download was successful, False otherwise
    """
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    
                    # Print progress
                    if total_size > 0:
                        progress = downloaded / total_size * 100
                        logger.debug(f"Download progress: {progress:.1f}%")
        
        logger.info(f"Successfully downloaded file to {output_path}")
        return True
    
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        return False

def convert_audio_format(input_path, output_path, format="wav"):
    """
    Convert audio from one format to another
    
    Args:
        input_path (str): Path to the input audio file
        output_path (str): Path to save the output audio file
        format (str): Format to convert to
        
    Returns:
        bool: True if conversion was successful, False otherwise
    """
    try:
        import ffmpeg
        
        # Convert audio
        (
            ffmpeg
            .input(input_path)
            .output(output_path, format=format, acodec='pcm_s16le', ar='16000')
            .run(quiet=True, overwrite_output=True)
        )
        
        logger.info(f"Successfully converted audio to {format}")
        return True
    
    except ImportError:
        logger.error("ffmpeg-python not installed, using fallback conversion")
        try:
            import subprocess
            
            # Use subprocess to call ffmpeg directly
            command = [
                'ffmpeg',
                '-i', input_path,
                '-ar', '16000',
                '-ac', '1',
                '-c:a', 'pcm_s16le',
                output_path
            ]
            
            subprocess.run(command, check=True, capture_output=True)
            logger.info(f"Successfully converted audio to {format} using ffmpeg command")
            return True
        
        except Exception as e:
            logger.error(f"Error converting audio: {e}")
            return False
    
    except Exception as e:
        logger.error(f"Error converting audio: {e}")
        return False

def clear_temp_files(directory=None, pattern="*"):
    """
    Clear temporary files
    
    Args:
        directory (str): Directory to clear files from, defaults to system temp directory
        pattern (str): Pattern to match files to delete
        
    Returns:
        int: Number of files deleted
    """
    try:
        if directory is None:
            directory = tempfile.gettempdir()
        
        path = Path(directory)
        count = 0
        
        for file_path in path.glob(pattern):
            if file_path.is_file():
                file_path.unlink()
                count += 1
        
        logger.info(f"Cleared {count} temporary files")
        return count
    
    except Exception as e:
        logger.error(f"Error clearing temporary files: {e}")
        return 0
