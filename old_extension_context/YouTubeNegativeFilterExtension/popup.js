
const testOpenAIKeyButton = document.getElementById('testOpenAIKeyButton');
const testOpenAIKeyOutputText = document.getElementById('testOpenAIKeyOutputText');
const openAIAPIKeyInput = document.getElementById('openAIAPIKeyInput');

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