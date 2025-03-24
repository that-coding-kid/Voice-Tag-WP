// Background script for WhatsApp Voice Tagger extension

// Global state
let serverUrl = "http://localhost:5000";
let isExtensionEnabled = true;
let processingQueue = [];
let isProcessing = false;

// Listen for messages from content script or popup
// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message in background script:", message.type);
  console.log("Message data types:", {
    hasAudioBinary: !!message.audioBinary,
    audioBinaryType: message.audioBinary ? typeof message.audioBinary : 'undefined',
    hasAudioBlob: !!message.audioBlob,
    audioBlobType: message.audioBlob ? typeof message.audioBlob : 'undefined'
  });
  
  if (message.type === "PROCESS_VOICE_NOTE") {
    if (!isExtensionEnabled) {
      console.log("Extension is disabled, ignoring voice note processing request");
      sendResponse({ success: false, error: "Extension is disabled" });
      return false;
    }
    
    // Enhanced checking for audio data
    if (message.audioBinary) {
      console.log(`Received audio binary data: length = ${message.audioBinary.byteLength} bytes`);
      
      // Verify the binary data is valid
      if (!message.audioBinary || message.audioBinary.byteLength === 0) {
        console.error("Received empty audio data");
        sendResponse({ success: false, error: "Empty audio recording" });
        return false;
      }
      
      // Process the voice note with the binary data
      processVoiceNote(message.audioBinary)
        .then(result => {
          console.log("Voice note processed successfully:", result);
          sendResponse({ success: true, result });
        })
        .catch(error => {
          console.error("Error processing voice note:", error);
          sendResponse({ success: false, error: error.message || "Unknown error" });
        });
      
      return true; // Indicates async response
    } else if (message.audioBlob) {
      console.log(`Received audio blob: ${message.audioBlob.size} bytes`);
      
      // Verify the blob is valid (legacy method)
      if (!message.audioBlob || message.audioBlob.size === 0) {
        console.error("Received empty audio blob");
        sendResponse({ success: false, error: "Empty audio recording" });
        return false;
      }
      
      // Process the voice note
      processVoiceNote(message.audioBlob)
        .then(result => {
          console.log("Voice note processed successfully:", result);
          sendResponse({ success: true, result });
        })
        .catch(error => {
          console.error("Error processing voice note:", error);
          sendResponse({ success: false, error: error.message || "Unknown error" });
        });
      
      return true; // Indicates async response
    } else {
      // Check if we have audioBlobArray instead (the original property you were using)
      if (message.audioBlobArray && Array.isArray(message.audioBlobArray)) {
        console.log(`Received audio blob array with length: ${message.audioBlobArray.length}`);
        
        // Convert array back to ArrayBuffer
        const uint8Array = new Uint8Array(message.audioBlobArray);
        const arrayBuffer = uint8Array.buffer;
        
        // Process with the reconstructed ArrayBuffer
        processVoiceNote(arrayBuffer)
          .then(result => {
            console.log("Voice note processed successfully:", result);
            sendResponse({ success: true, result });
          })
          .catch(error => {
            console.error("Error processing voice note:", error);
            sendResponse({ success: false, error: error.message || "Unknown error" });
          });
        
        return true; // Indicates async response
      }
      
      console.error("No audio data found in message. Available properties:", Object.keys(message));
      sendResponse({ success: false, error: "No audio data provided" });
      return false;
    }
  } else if (message.type === "SET_ENABLED") {
    isExtensionEnabled = message.enabled;
    console.log(`Extension ${isExtensionEnabled ? 'enabled' : 'disabled'}`);
    sendResponse({ success: true });
  } else if (message.type === "GET_ENABLED") {
    sendResponse({ enabled: isExtensionEnabled });
  } else if (message.type === "SET_SERVER_URL") {
    serverUrl = message.url;
    console.log(`Server URL set to: ${serverUrl}`);
    sendResponse({ success: true });
  } else if (message.type === "GET_SERVER_URL") {
    sendResponse({ url: serverUrl });
  }
});
// In background.js - Update the processVoiceNote function to handle larger chunks

async function processVoiceNote(audioBinaryData) {
  try {
    console.log("Processing audio data in background script");
    console.log("Data type:", typeof audioBinaryData);
    
    // Check the type of audioBinaryData and create the appropriate Blob
    let audioBlob;
    
    if (audioBinaryData instanceof ArrayBuffer) {
      console.log(`Received ArrayBuffer: ${audioBinaryData.byteLength} bytes`);
      audioBlob = new Blob([new Uint8Array(audioBinaryData)], { type: 'audio/webm;codecs=opus' });
      console.log(`Created Blob from ArrayBuffer: ${audioBlob.size} bytes`);
    } else if (audioBinaryData instanceof Blob) {
      console.log(`Received Blob: ${audioBinaryData.size} bytes`);
      audioBlob = audioBinaryData;
    } else if (typeof audioBinaryData === 'object' && audioBinaryData !== null) {
      // Handle case where Chrome messaging might convert ArrayBuffer to a plain object
      console.log("Received object data, attempting to convert to ArrayBuffer");
      try {
        // If it's an array-like object (audioBlobArray), try to convert it to a Uint8Array
        if (Array.isArray(audioBinaryData) || 'length' in audioBinaryData) {
          const uint8Array = new Uint8Array(audioBinaryData);
          audioBlob = new Blob([uint8Array], { type: 'audio/webm;codecs=opus' });
          console.log(`Created Blob from converted data: ${audioBlob.size} bytes`);
        } else if (audioBinaryData.audioBlobArray && Array.isArray(audioBinaryData.audioBlobArray)) {
          // Handle the case where the whole message object was passed
          console.log(`Received audio blob array with length: ${audioBinaryData.audioBlobArray.length}`);
          const uint8Array = new Uint8Array(audioBinaryData.audioBlobArray);
          audioBlob = new Blob([uint8Array], { type: 'audio/webm;codecs=opus' });
          console.log(`Created Blob from array data: ${audioBlob.size} bytes`);
        } else {
          throw new Error("Cannot convert object to ArrayBuffer");
        }
      } catch (e) {
        console.error("Conversion error:", e);
        throw new Error("Invalid audio data format: " + e.message);
      }
    } else {
      console.error(`Unrecognized data type: ${typeof audioBinaryData}`);
      throw new Error("Invalid audio data format");
    }
    
    // Check for minimum size to ensure we have enough audio data
    if (audioBlob.size < 1000) {
      console.warn(`Audio blob too small: ${audioBlob.size} bytes`);
      throw new Error("Audio recording too short or empty");
    }
    
    console.log(`Creating FormData with large blob size: ${audioBlob.size} bytes`);
    const formData = new FormData();
    
    // Add the audio file with type information
    const filename = `voice_note_${Date.now()}.webm`;
    formData.append('audio', audioBlob, filename);
    
    // Increased timeout for larger file uploads
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for larger files
    
    console.log(`Sending request to ${serverUrl}/process_audio with larger audio file`);
    
    // Make the fetch request with larger timeout
    const response = await fetch(`${serverUrl}/process_audio`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    console.log(`Server response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = "Could not read error response";
      }
      console.error(`Server error: ${response.status} - ${errorText}`);
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }
    
    // Parse the JSON response
    let result;
    try {
      result = await response.json();
      console.log("Processed voice note result:", result);
    } catch (e) {
      console.error("Error parsing JSON response:", e);
      throw new Error("Invalid response from server: " + e.message);
    }
    
    // For demo server, if the server doesn't return a proper structure
    if (!result || typeof result !== 'object') {
      console.warn("Server returned invalid response format, using default");
      result = { 
        transcription: "This is a test transcription", 
        addressee: "John"
      };
    }
    
    // Validate result structure
    if (!result.hasOwnProperty('addressee') || !result.hasOwnProperty('transcription')) {
      console.warn("Server returned unexpected response format:", result);
      result.addressee = result.addressee || null;
      result.transcription = result.transcription || "";
    }
    
    return result;
  } catch (error) {
    console.error("Error processing voice note:", error);
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      throw new Error("Request timed out. Server may be unavailable.");
    } else if (error.message.includes('NetworkError')) {
      throw new Error("Network error. Please check your connection and server URL.");
    }
    
    throw error;
  }
}

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("WhatsApp Voice Tagger extension installed");
});
