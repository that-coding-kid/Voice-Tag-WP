// Content script for WhatsApp Voice Tagger extension

// Constants
const WHATSAPP_SELECTORS = {
  // Use multiple selectors to accommodate different WhatsApp versions
  VOICE_RECORD_BUTTON: 'button[aria-label="Voice message"], span[data-icon="ptt"]',
  VOICE_RECORDING_CONTAINER: 'div.recording, span[data-icon="audio-cancel"]',
  SEND_BUTTON: 'button[aria-label="Send"], span[data-icon="send"]',
  CONTACTS_PANEL: 'div[data-testid="chatlist-panel"]',
  CHAT_INPUT: 'div[aria-label="Type a message"], div[contenteditable="true"][data-testid="conversation-compose-box-input"], div[contenteditable="true"][data-lexical-editor="true"]',
  CONTACTS: 'div[data-testid="cell-frame-container"]',
  CONTACT_NAME: 'span[dir="auto"][aria-label]',
  // Selectors for group chats
  GROUP_HEADER: 'div[role="button"] span.selectable-text.copyable-text',
  GROUP_MEMBERS: 'div.x78zum5.x1cy8zhl.xisnujt.x1nxh6w3.xcgms0a.x16cd2qt span.selectable-text.copyable-text'
};

// Global state
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let contacts = [];
let audioStream = null;
let manualStopRequested = false;
let recordingStartTime = 0;

// Initialize extension
function initialize() {
  console.log("WhatsApp Voice Tagger content script initialized");
  
  // Extract contacts from UI
  extractContacts();
  
  // Set up event listeners for voice recording
  setupEventListeners();
  
  // Set up contact extraction periodically
  setInterval(extractContacts, 30000);
}

// Extract contacts from WhatsApp UI
function extractContacts() {
  // First, extract contacts from the contact list
  const contactElements = document.querySelectorAll(WHATSAPP_SELECTORS.CONTACTS);
  contacts = Array.from(contactElements).map(element => {
    const nameElement = element.querySelector(WHATSAPP_SELECTORS.CONTACT_NAME);
    if (nameElement) {
      return {
        name: nameElement.textContent.trim(),
        element: element
      };
    }
    return null;
  }).filter(Boolean);
  
  // Then, try to extract contacts from the current group chat
  try {
    // Check if we're in a group chat by looking for the group members element
    const groupMembersElement = document.querySelector(WHATSAPP_SELECTORS.GROUP_MEMBERS);
    if (groupMembersElement) {
      const groupMembersText = groupMembersElement.textContent.trim();
      // Group members are usually displayed as "Name1, Name2, Name3, You"
      const groupMembers = groupMembersText.split(',').map(name => name.trim());
      
      // Add each group member to contacts list if not already present
      for (const member of groupMembers) {
        if (member === "You") continue; // Skip the current user
        
        // Check if this contact already exists
        const exists = contacts.some(contact => 
          contact.name.toLowerCase() === member.toLowerCase());
        
        if (!exists) {
          contacts.push({
            name: member,
            element: null, // No DOM element for group members
            isGroupMember: true
          });
        }
      }
    }
  } catch (error) {
    console.error("Error extracting group members:", error);
  }
  
  console.log(`Extracted ${contacts.length} contacts from WhatsApp UI`);
  console.log("Contacts list:", contacts.map(c => c.name));
}

// Set up event listeners for voice recording - COMPLETELY REVISED
function setupEventListeners() {
  console.log("Setting up event-driven button listeners");
  
  // Set up recorder control buttons
  setupRecorderButtons();
  
  // Periodically check for new buttons that need listeners
  setInterval(setupRecorderButtons, 2000);
}

// Set up the recorder buttons with direct event listeners
function setupRecorderButtons() {
  // Find voice record button
  const voiceButton = document.querySelector(WHATSAPP_SELECTORS.VOICE_RECORD_BUTTON);
  if (voiceButton && !voiceButton._voiceTagListenerSetup) {
    console.log("Found voice button, adding listeners");
    
    // Mouse down event starts recording
    voiceButton.addEventListener('mousedown', (e) => {
      console.log("Voice button mousedown detected");
      manualStopRequested = false;
      
      // Start recording if not already recording
      if (!isRecording) {
        startRecording();
      }
    });
    
    // Mark this button as set up
    voiceButton._voiceTagListenerSetup = true;
  }
  
  // Find cancel button - appears when recording
  const cancelButton = document.querySelector('span[data-icon="audio-cancel"]');
  if (cancelButton && !cancelButton._voiceTagListenerSetup) {
    console.log("Found cancel button, adding listener");
    
    cancelButton.addEventListener('click', (e) => {
      console.log("Cancel button clicked");
      manualStopRequested = true;
      
      if (isRecording) {
        stopRecording(false); // Don't process when cancelled
      }
    });
    
    cancelButton._voiceTagListenerSetup = true;
  }
  
  // Find send button
  const sendButton = document.querySelector(WHATSAPP_SELECTORS.SEND_BUTTON);
  if (sendButton && !sendButton._voiceTagListenerSetup) {
    console.log("Found send button, adding listener");
    
    sendButton.addEventListener('click', (e) => {
      console.log("Send button clicked");
      manualStopRequested = true;
      
      if (isRecording) {
        stopRecording(true); // Stop and process
        
        // Add a delay before processing to let WhatsApp finish
        setTimeout(() => {
          processRecordedAudio();
        }, 1000);
      } else if (audioChunks.length > 0) {
        // We already stopped recording but have audio to process
        processRecordedAudio();
      }
    });
    
    // Ensure the event is captured in both phases
    sendButton.addEventListener('click', (e) => {
      console.log("Send button click captured (capture phase)");
    }, true);
    
    sendButton._voiceTagListenerSetup = true;
  }
  
  // Add manual controls for testing and backup
  addManualControls();
}

// Add manual controls for testing
function addManualControls() {
  // Check if controls already exist
  if (document.getElementById('voice-tagger-controls')) {
    return;
  }
  
  // Create a floating control panel
  const controlPanel = document.createElement('div');
  controlPanel.id = 'voice-tagger-controls';
  controlPanel.style.position = 'fixed';
  controlPanel.style.bottom = '100px';
  controlPanel.style.right = '20px';
  controlPanel.style.zIndex = '9999';
  controlPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  controlPanel.style.padding = '10px';
  controlPanel.style.borderRadius = '5px';
  controlPanel.style.color = 'white';
  
  // Add manual stop button
  const stopButton = document.createElement('button');
  stopButton.textContent = 'Stop Recording';
  stopButton.style.padding = '5px 10px';
  stopButton.style.marginRight = '5px';
  stopButton.style.cursor = 'pointer';
  stopButton.onclick = () => {
    console.log("Manual stop button clicked");
    manualStopRequested = true;
    if (isRecording) {
      stopRecording(true);
    }
  };
  
  // Add manual process button
  const processButton = document.createElement('button');
  processButton.textContent = 'Process Audio';
  processButton.style.padding = '5px 10px';
  processButton.style.cursor = 'pointer';
  processButton.onclick = () => {
    console.log("Manual process button clicked");
    if (audioChunks.length > 0) {
      processRecordedAudio();
    } else {
      showNotification("No audio data to process", "warning");
    }
  };
  
  // Add status indicator
  const statusIndicator = document.createElement('div');
  statusIndicator.id = 'voice-tagger-status';
  statusIndicator.style.marginTop = '5px';
  statusIndicator.style.fontSize = '12px';
  statusIndicator.textContent = 'Ready';
  
  // Update status indicator periodically
  setInterval(() => {
    const statusEl = document.getElementById('voice-tagger-status');
    if (statusEl) {
      if (isRecording) {
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        statusEl.textContent = `Recording: ${duration}s`;
        statusEl.style.color = '#ff4444';
      } else if (audioChunks.length > 0) {
        statusEl.textContent = `Audio ready: ${audioChunks.length} chunks`;
        statusEl.style.color = '#44ff44';
      } else {
        statusEl.textContent = 'Ready';
        statusEl.style.color = 'white';
      }
    }
  }, 1000);
  
  // Assemble and add to page
  controlPanel.appendChild(stopButton);
  controlPanel.appendChild(processButton);
  controlPanel.appendChild(statusIndicator);
  document.body.appendChild(controlPanel);
}

async function startRecording() {
  try {
    // First ensure any previous recording is stopped and cleared
    if (isRecording && mediaRecorder) {
      stopRecording(false);
    }
    
    // Reset audioChunks to ensure we start with a clean slate
    audioChunks = [];
    manualStopRequested = false;
    recordingStartTime = Date.now();
    
    console.log("Requesting audio media permissions");
    audioStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 24000,
        channelCount: 1
      } 
    });
    
    console.log("Audio stream obtained, creating media recorder");
    const options = { 
      mimeType: 'audio/webm;codecs=opus', 
      audioBitsPerSecond: 256000
    };
    
    mediaRecorder = new MediaRecorder(audioStream, options);
    
    // Set up event listeners for the recorder
    mediaRecorder.addEventListener('dataavailable', event => {
      console.log(`Audio data available: ${event.data.size} bytes`);
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    });
    
    mediaRecorder.addEventListener('start', () => {
      console.log("MediaRecorder started");
      isRecording = true;
      showNotification("Recording started", "info");
    });
    
    mediaRecorder.addEventListener('stop', () => {
      console.log("MediaRecorder stopped");
      isRecording = false;
      
      // Log chunk count immediately after stopping
      console.log(`After stopping, we have ${audioChunks.length} chunks`);
    });
    
    mediaRecorder.addEventListener('error', (e) => {
      console.error("MediaRecorder error:", e);
      showNotification("Recording error: " + e.message, "error");
    });
    
    // Use a larger timeslice to get fewer but larger chunks
    mediaRecorder.start(3000);  // 3 second chunks
    
    console.log("Started recording with 3s intervals");
    
    // Set up automatic data requests every 3 seconds to ensure chunks are captured
    // This helps prevent data loss if the MediaRecorder stops unexpectedly
    const dataRequestInterval = setInterval(() => {
      if (mediaRecorder && mediaRecorder.state === "recording" && !manualStopRequested) {
        mediaRecorder.requestData();
        console.log("Requested data chunk via interval");
      } else {
        clearInterval(dataRequestInterval);
      }
    }, 3000);
    
  } catch (error) {
    console.error("Error starting recording:", error);
    showNotification("Error starting recording: " + error.message, "error");
    isRecording = false;
    audioChunks = [];
  }
}

// Stop recording with option to process or discard
function stopRecording(shouldProcess = true) {
  console.log(`Attempting to stop recording (shouldProcess: ${shouldProcess})`);
  
  if (!mediaRecorder) {
    console.warn("No media recorder to stop");
    isRecording = false;
    return;
  }
  
  if (mediaRecorder.state === "inactive") {
    console.log("MediaRecorder already stopped");
    isRecording = false;
    return;
  }
  
  try {
    // Request a final chunk of data before stopping
    if (mediaRecorder.state === "recording") {
      mediaRecorder.requestData();
      console.log("Final data requested before stopping");
    }
    
    // Add a small delay to ensure the final requestData completes
    setTimeout(() => {
      // Stop the recorder only if it's in recording state
      if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        console.log("MediaRecorder stopped");
      }
      
      // Add delay before stopping tracks
      setTimeout(() => {
        // Stop all audio tracks
        if (audioStream) {
          audioStream.getTracks().forEach(track => {
            track.stop();
            console.log(`Audio track ${track.id} stopped`);
          });
          audioStream = null;
        }
        
        // Update state
        isRecording = false;
        
        // Log the chunks we've collected
        console.log(`Recording stopped, collected ${audioChunks.length} chunks`);
        console.log(`Total audio data size: ${audioChunks.reduce((total, chunk) => total + chunk.size, 0)} bytes`);
        
        const recordingDuration = Math.floor((Date.now() - recordingStartTime) / 1000);
        showNotification(`Recording stopped (${recordingDuration}s)` + 
                        (shouldProcess ? ". Processing voice note..." : ""), "info");
        
        // Auto-process if requested and we have data
        if (shouldProcess && audioChunks.length > 0) {
          setTimeout(() => {
            processRecordedAudio();
          }, 1000);
        }
        
        // If recording was cancelled, clear chunks
        if (!shouldProcess) {
          audioChunks = [];
        }
      }, 500);
    }, 500);
  } catch (error) {
    console.error("Error stopping recording:", error);
    showNotification("Error stopping recording: " + error.message, "error");
    
    // Force reset state in case of error
    isRecording = false;
  }
}

// Process the recorded audio - UNCHANGED
function processRecordedAudio() {
  console.log(`Processing recorded audio: ${audioChunks.length} chunks available`);
  
  if (audioChunks.length === 0) {
    console.warn("No audio recorded to process");
    showNotification("No audio recorded to process", "warning");
    return;
  }
  
  try {
    showNotification("Processing voice note...", "info");
    
    // Create a blob from the audio chunks
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
    console.log(`Created audio blob: ${audioBlob.size} bytes`);
    
    if (audioBlob.size < 100) {
      console.warn("Audio blob too small, might be empty");
      showNotification("Recording too short or empty", "warning");
      return;
    }
    
    // We need to convert the blob to ArrayBuffer to send via Chrome messaging
    console.log("Converting blob to array buffer for messaging");
    const reader = new FileReader();
    
    reader.onload = function(event) {
      const arrayBuffer = event.target.result;
      console.log(`Converted blob to ArrayBuffer: ${arrayBuffer.byteLength} bytes`);
      
      // Add delay before sending message
      setTimeout(() => {
        // Convert ArrayBuffer to Array for better serialization
        const uint8Array = new Uint8Array(arrayBuffer);
        const arrayData = Array.from(uint8Array);
        
        console.log("Sending audio data to background script");
        chrome.runtime.sendMessage(
          { 
            type: "PROCESS_VOICE_NOTE", 
            // Send as array for better serialization through Chrome messaging
            audioBlobArray: arrayData,
            byteLength: arrayBuffer.byteLength,
            timestamp: Date.now()
          },
          (response) => {
            console.log("Received response from background script:", response);
            handleProcessingResult(response);
          }
        );
      }, 800);
    };
    
    reader.onerror = function(error) {
      console.error("Error reading blob:", error);
      showNotification("Error processing audio: Failed to read recording", "error");
    };
    
    // Read the blob as an array buffer
    reader.readAsArrayBuffer(audioBlob);
    
    // Keep audioChunks until processing is complete, only reset after success
    isRecording = false;
  } catch (error) {
    console.error("Error processing recorded audio:", error);
    showNotification("Error processing audio: " + error.message, "error");
  }
}

// Show a notification in the WhatsApp UI - UNCHANGED
function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div");
  notification.style.position = "fixed";
  notification.style.top = "20px";
  notification.style.right = "20px";
  notification.style.zIndex = "9999";
  notification.style.padding = "10px 15px";
  notification.style.borderRadius = "5px";
  notification.style.maxWidth = "300px";
  notification.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
  notification.style.fontFamily = "Segoe UI, Helvetica Neue, Helvetica, Lucida Grande, Arial, Ubuntu, Cantarell, Fira Sans, sans-serif";
  notification.style.fontSize = "14px";
  notification.style.transition = "opacity 0.5s ease-in-out";
  notification.style.opacity = "0";
  
  // Set color based on notification type
  switch (type) {
    case "error":
      notification.style.backgroundColor = "#d32f2f";
      notification.style.color = "white";
      break;
    case "warning":
      notification.style.backgroundColor = "#ffa000";
      notification.style.color = "white";
      break;
    case "success":
      notification.style.backgroundColor = "#388e3c";
      notification.style.color = "white";
      break;
    default: // info
      notification.style.backgroundColor = "#039be5";
      notification.style.color = "white";
  }
  
  // Add message
  notification.textContent = message;
  
  // Add to document
  document.body.appendChild(notification);
  
  // Fade in
  setTimeout(() => {
    notification.style.opacity = "1";
  }, 10);
  
  // Fade out and remove after 5 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 5000);
}

// Handle processing result from background script - UNCHANGED
function handleProcessingResult(response) {
  if (!response || !response.success) {
    console.error("Error processing voice note:", response?.error || "Unknown error");
    showNotification("Error processing voice note", "error");
    return;
  }
  
  const { addressee, transcription } = response.result;
  
  // Display the transcription for debugging/verification
  console.log(`Transcription: ${transcription}`);
  showNotification(`Transcription: "${transcription}"`, "info");
  
  if (!addressee) {
    console.warn("No addressee found in the voice note");
    showNotification("No addressee found in the voice note", "warning");
    return;
  }
  
  console.log(`Addressee found: ${addressee}`);
  tagAddresseeInChat(addressee, transcription);
  
  // Clear audio chunks only after successful processing
  audioChunks = [];
}

// Tag addressee in the chat and then send the message automatically
function tagAddresseeInChat(addressee, transcription = '') {
  // Prevent duplicate processing with a flag
  if (window._isTaggingAddresseeInProgress) {
    console.log("Already tagging an addressee, preventing duplicate operation");
    return;
  }
  
  // Set flag to prevent duplicate operations
  window._isTaggingAddresseeInProgress = true;
  
  // Find the most similar contact name
  const matchedContact = findBestMatchingContact(addressee);
  if (!matchedContact) {
    console.warn(`No matching contact found for "${addressee}"`);
    showNotification(`No matching contact found for "${addressee}"`, "warning");
    window._isTaggingAddresseeInProgress = false;
    return;
  }
  
  console.log(`Matched contact: ${matchedContact}`);
  showNotification(`Tagging: ${matchedContact}`, "success");
  
  // Prepare the message text
  let message = `@${matchedContact} Voice note for you`;
  
  // Use clipboard API to insert text - this is more reliable
  navigator.clipboard.writeText(message).then(() => {
    // Find the chat input
    const chatInput = document.querySelector(WHATSAPP_SELECTORS.CHAT_INPUT);
    if (chatInput) {
      // Focus the input field
      chatInput.focus();
      
      // Simulate a delay as if the user is pasting text
      setTimeout(() => {
        try {
          // For lexical editor, try to find paragraph first
          const paragraph = document.querySelector("div[contenteditable='true'][data-tab='10']");
          if (paragraph) {
            // Focus the paragraph but don't insert text yet
            paragraph.focus();
            
            // Use execCommand only once to paste text
            document.execCommand("insertText", false, message);
            console.log("Message inserted into chat input");
            
            // Try to send the message after a delay
            setTimeout(() => {
              console.log("Attempting to send message");
              
              // Find the send button by the most reliable selector
              let sendButton = document.querySelector('span[data-icon="send"]');
              
              // If not found, try the alternative selector
              if (!sendButton) {
                sendButton = document.querySelector('button[aria-label="Send"]');
              }
              
              if (sendButton) {
                console.log("Found send button, clicking it");
                
                // Create and dispatch a mouse click event
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  // Make this look like a real click
                  detail: 1,
                  screenX: 0,
                  screenY: 0,
                  clientX: 0,
                  clientY: 0
                });
                
                // Only dispatch the event once
                sendButton.dispatchEvent(clickEvent);
                console.log("Send button click event dispatched");
                
                // Show success notification
                showNotification("Message sent", "success");
              } else {
                console.warn("Send button not found");
                showNotification("Send button not found - please send manually", "warning");
              }
              
              // Reset the flag after everything is done
              window._isTaggingAddresseeInProgress = false;
            }, 1000); // 1 second delay before sending
          } else {
            console.error("Paragraph element not found");
            showNotification("Chat input element not found", "error");
            window._isTaggingAddresseeInProgress = false;
          }
        } catch (err) {
          console.error('Text insertion error:', err);
          showNotification("Error inserting text - please paste manually", "error");
          window._isTaggingAddresseeInProgress = false;
        }
      }, 1000); // Reduced delay before pasting text
    } else {
      console.error("Chat input not found");
      showNotification("Could not find chat input", "error");
      window._isTaggingAddresseeInProgress = false;
    }
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    showNotification("Error: Couldn't prepare message", "error");
    window._isTaggingAddresseeInProgress = false;
  });
}
function findBestMatchingContact(addressee) {
  if (!contacts.length) {
    return null;
  }
  
  // Simple matching algorithm
  // This could be improved with more sophisticated string matching
  const normalizedAddressee = addressee.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;
  
  for (const contact of contacts) {
    const contactName = contact.name.toLowerCase();
    
    // Exact match
    if (contactName === normalizedAddressee) {
      return contact.name;
    }
    
    // Check if addressee contains contact name or vice versa
    if (contactName.includes(normalizedAddressee) || normalizedAddressee.includes(contactName)) {
      const score = Math.min(contactName.length, normalizedAddressee.length) / 
                   Math.max(contactName.length, normalizedAddressee.length);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = contact.name;
      }
    }
  }
  
  // Return best match if score is above threshold
  return highestScore > 0.5 ? bestMatch : null;
}

// Initialize when page is fully loaded
if (document.readyState === 'complete') {
  initialize();
} else {
  window.addEventListener('load', initialize);
}