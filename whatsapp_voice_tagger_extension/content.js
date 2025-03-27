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
  
  
  // Add manual stop button
  
  
  // Add manual process button
  
  
  // Add status indicator
  
  
  // Update status indicator periodically
  
  
  // Assemble and add to page
  
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
  
  try {
    // Find the chat input
    const chatInput = document.querySelector("div[contenteditable='true'][data-tab='10']");;
    if (!chatInput) {
      console.error("Chat input not found");
      showNotification("Could not find chat input", "error");
      window._isTaggingAddresseeInProgress = false;
      return;
    }
    
    // Focus the input field
    chatInput.focus();
    
    // Use WhatsApp's native mention system instead of text paste
    setTimeout(() => {
      try {
        // First, type the @ symbol to trigger WhatsApp's mention UI
        document.execCommand("insertText", false, "@");
        console.log("@ symbol inserted to trigger mention UI");
        
        // Wait a moment for the mention UI to appear
        setTimeout(() => {
          // Now type the contact name
          document.execCommand("insertText", false, matchedContact);
          console.log("Contact name inserted");
          
          // Wait a moment for WhatsApp to process the name
          setTimeout(() => {
            // Press Tab or Enter to select the contact from suggestion
            const tabEvent = new KeyboardEvent('keydown', {
              key: 'Tab',
              code: 'Tab',
              keyCode: 9,
              which: 9,
              bubbles: true,
              cancelable: true
            });
            chatInput.dispatchEvent(tabEvent);
            console.log("Tab key pressed to select mention");
            
            // Wait a bit, then add the rest of the message
            setTimeout(() => {
              document.execCommand("insertText", false, " Voice note for you");
              console.log("Rest of message inserted");
              
              // Finally, send the message
              setTimeout(() => {
                // Find the send button
                let sendButton = document.querySelector('span[data-icon="send"]');
                if (!sendButton) {
                  sendButton = document.querySelector('button[aria-label="Send"]');
                }
                
                if (sendButton) {
                  console.log("Found send button, clicking it");
                  
                  // Click the send button
                  sendButton.click();
                  console.log("Send button clicked");
                  
                  // Show success notification
                  showNotification("Message sent", "success");
                } else {
                  // Try pressing Enter as a fallback
                  const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                  });
                  chatInput.dispatchEvent(enterEvent);
                  console.log("Enter key pressed as fallback");
                  showNotification("Used Enter key to send (send button not found)", "info");
                }
                
                // Reset the flag
                window._isTaggingAddresseeInProgress = false;
              }, 500); // 500ms delay before sending
            }, 300); // 300ms delay before adding rest of message
          }, 300); // 300ms delay before pressing Tab
        }, 300); // 300ms delay before typing contact name
      } catch (err) {
        console.error('Error during tagging process:', err);
        showNotification("Error during tagging process", "error");
        window._isTaggingAddresseeInProgress = false;
      }
    }, 500); // 500ms initial delay
  } catch (err) {
    console.error('General error in tagging function:', err);
    showNotification("Error tagging contact", "error");
    window._isTaggingAddresseeInProgress = false;
  }
}

function findBestMatchingContact(addressee) {
  if (!contacts.length) {
    return null;
  }

  const normalizedAddressee = addressee.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;

  for (const contact of contacts) {
    const contactName = contact.name.toLowerCase();
    const score = 1 - levenshteinDistance(normalizedAddressee, contactName) / Math.max(normalizedAddressee.length, contactName.length);

    if (score > highestScore) {
      highestScore = score;
      bestMatch = contact.name;
    }
  }
  console.log(highestScore);

  return highestScore > 0.6 ? bestMatch : null;
}

function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}


// Initialize when page is fully loaded
if (document.readyState === 'complete') {
  initialize();
} else {
  window.addEventListener('load', initialize);
}