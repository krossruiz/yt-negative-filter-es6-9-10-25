'use strict';

import './popup.css';

(function () {
  // We will make use of Storage API to get and store `count` value
  // More information on Storage API can we found at
  // https://developer.chrome.com/extensions/storage

  // To get storage access, we have to mention it in `permissions` property of manifest.json file
  // More information on Permissions can we found at
  // https://developer.chrome.com/extensions/declare_permissions

  const testOpenAIKeyButton = document.getElementById('testOpenAIKeyButton');
  const testOpenAIKeyOutputText = document.getElementById('testOpenAIKeyOutputText');
  const openAIAPIKeyInput = document.getElementById('openAIAPIKeyInput');
  const saveEventLogButton = document.getElementById('saveEventLogButton');
  const toggleFilterBehaviorButton = document.getElementById('toggleFilterBehaviorButton');
  const filterBehaviorStatus = document.getElementById('filterBehaviorStatus');

  function updateStatus(behavior) {
    filterBehaviorStatus.textContent = behavior === 'remove' ? 'Removed' : 'Shown with Overlay';
  }

  // Load initial state
  chrome.storage.local.get(['filterBehavior'], (result) => {
    const currentBehavior = result.filterBehavior || 'show';
    updateStatus(currentBehavior);
  });
  
  toggleFilterBehaviorButton.addEventListener('click', () => {
    chrome.storage.local.get(['filterBehavior'], (result) => {
      const currentBehavior = result.filterBehavior || 'show';
      const newBehavior = currentBehavior === 'show' ? 'remove' : 'show';
      
      chrome.storage.local.set({ filterBehavior: newBehavior }, () => {
        updateStatus(newBehavior);
        // Send message to content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'updateFilterBehavior',
              behavior: newBehavior,
            });
          }
        });
      });
    });
  });
  
  saveEventLogButton.addEventListener('click', function() {
    console.log('Save Event Log button clicked');
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length > 0) {
        const activeTab = tabs[0];
        chrome.tabs.sendMessage(activeTab.id, { action: 'saveEventLog' }, function (response) {
          if (chrome.runtime.lastError) {
            console.error('Error sending message to content script:', chrome.runtime.lastError.message);
          } else {
            console.log('Response from content script:', response);
          }
        });
      }
    });
  });
  
  testOpenAIKeyButton.addEventListener("click", function () {
    console.log('Test OpenAI Key button clicked');
    console.log(openAIAPIKeyInput.value);
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length > 0) {
        const activeTab = tabs[0];
          chrome.tabs.sendMessage(activeTab.id, { openAIAPIKey: openAIAPIKeyInput.value, action: 'testOpenAIKey' }, function (response) {
            if (chrome.runtime.lastError) {
              console.error('Error sending message to content script:', chrome.runtime.lastError);
            } else {
              if (response) {
                console.log('Response from content script with openai text:', response);
                testOpenAIKeyOutputText.innerText = response.gpt_4_1_output_text;
                console.log(response.gpt_4_1_output_text);
              }
            }
          })
      }
    });
  });
 })();
