# WhatsApp Voice Tagger Chrome Extension

A Chrome extension for WhatsApp Web that captures voice notes, identifies mentioned names, and automatically tags those people in the chat.
## Architecture
![image](https://github.com/user-attachments/assets/75993dad-3e4b-47be-9ba8-e3d898468186)

## Demo
Check the assets folder.

## Features
- Records and processes voice notes sent through WhatsApp Web
- Uses speech recognition to transcribe audio
- Identifies the addressee/recipient mentioned in the voice note
- Automatically tags the identified person in the chat

## How It Works
1. When you record a voice note in WhatsApp Web, the extension captures the audio in real-time
2. When you send the voice note, the audio is processed to:
   - Transcribe the speech to text
   - Identify who is being addressed in the message
3. The extension then automatically sends a follow-up message tagging the identified person

## Installation

### Chrome Extension

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the extension directory
5. The extension is now installed and active

### Server Setup

The extension requires a server component to process the audio. You can:
Run the server locally:
   ```bash
   python main.py
   ```
   And set the Server URL in the extension popup to `http://localhost:5000`

## Usage

1. Open WhatsApp Web at [https://web.whatsapp.com/](https://web.whatsapp.com/)
2. Start a chat with someone
3. Record a voice note saying something like "Hey John, can you check this document?"
4. Send the voice note
5. The extension will automatically tag John in a follow-up message

## Configuration

Click the extension icon in Chrome's toolbar to access settings:

- **Enable/Disable**: Toggle the extension on or off
- **Server URL**: Set the URL of the processing server

## Technical Details

- **Content Script**: Monitors WhatsApp Web for voice recordings and captures audio
- **Background Script**: Handles communication between content script and server
- **Server**: Processes audio using AI models for transcription and name entity recognition
- **Popup**: Provides user interface for configuration

## Privacy

- All audio processing happens on the server
- No recordings are stored permanently
- Only text transcriptions are used for identifying addressees
