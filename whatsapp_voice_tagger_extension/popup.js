// Popup script for WhatsApp Voice Tagger extension

document.addEventListener('DOMContentLoaded', async () => {
  const enableExtensionCheckbox = document.getElementById('enableExtension');
  const serverUrlInput = document.getElementById('serverUrl');
  const saveSettingsButton = document.getElementById('saveSettings');
  const statusAlert = document.getElementById('status');
  
  // Load current settings
  loadSettings();
  
  // Event listeners
  saveSettingsButton.addEventListener('click', saveSettings);
  
  // Load current settings from background script
  async function loadSettings() {
    try {
      // Get extension enabled status
      const enabledResponse = await sendMessageToBackground({ type: "GET_ENABLED" });
      enableExtensionCheckbox.checked = enabledResponse.enabled;
      
      // Get server URL
      const urlResponse = await sendMessageToBackground({ type: "GET_SERVER_URL" });
      serverUrlInput.value = urlResponse.url;
    } catch (error) {
      showStatus("Error loading settings: " + error.message, "danger");
    }
  }
  
  // Save settings to background script
  async function saveSettings() {
    try {
      // Save extension enabled status
      await sendMessageToBackground({ 
        type: "SET_ENABLED", 
        enabled: enableExtensionCheckbox.checked 
      });
      
      // Save server URL
      await sendMessageToBackground({ 
        type: "SET_SERVER_URL", 
        url: serverUrlInput.value.trim() 
      });
      
      showStatus("Settings saved successfully", "success");
    } catch (error) {
      showStatus("Error saving settings: " + error.message, "danger");
    }
  }
  
  // Helper function to send messages to background script
  function sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
  
  // Show status message
  function showStatus(message, type = "success") {
    statusAlert.textContent = message;
    statusAlert.className = `alert alert-${type}`;
    
    // Hide status after 3 seconds
    setTimeout(() => {
      statusAlert.className = "alert alert-success d-none";
    }, 3000);
  }
});
