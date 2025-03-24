"""
WhatsApp Voice Tagger - Main Entry Point
This script starts the Flask server that processes voice notes
"""

import os
import logging
from server.app import app

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    # Get port from environment or use default
    port = int(os.environ.get("PORT", 5000))
    
    # Run the app
    app.run(
        host="0.0.0.0",  # Make the server publicly available
        port=port,
        debug=True       # Enable debug mode for development
    )