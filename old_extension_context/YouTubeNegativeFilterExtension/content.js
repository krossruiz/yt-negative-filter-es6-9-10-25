console.log('OLD Content script loaded! Again!');

//The following stack overflow question response was formatted in this code
//to allow me to use async await in the listener for onMessage.
//
//chrome.runtime.onMessage response with async await
//https://stackoverflow.com/questions/44056271/chrome-runtime-onmessage-response-with-async-await
//
//
// The closest I could get:

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     (async () => {
//         var key = await getKey();
//         sendResponse(key);
//     })();
//     return true;
// });
//




// const ytRecGridElements = document.getElementsByTagName('ytd-rich-grid-media');
// let yetRecGridElementsLength = ytRecGridElements.length;
// console.log(ytRecGridElements);
// console.log("Here");
// console.log("Grid elements length: " + yetRecGridElementsLength);
// let ytRecVideoTitles = [];

// setTimeout(() => {
//     console.log("RAN after 3 seconds");
//     for(let gridElement of ytRecGridElements){
//         console.log("RAN for each grid element");
//         console.log(gridElement);
//         let videoTitleElement = gridElement.getElementsById('video-title');
//         console.log(videoTitleElement);
//         ytRecVideoTitles.push(videoTitleElement[0].innerText);
//     }
//     console.log(ytRecVideoTitles);
// }, 3000);


//WORKS, BUT ONLY AFTER 3 SECONDS
// setTimeout(() => {

//     const videoElements = document.querySelectorAll('ytd-rich-grid-media');

//     // Initialize an array to store video titles
//     const videoTitles = [];

//     // Loop through each video element and extract the title
//     videoElements.forEach((videoElement) => {
//     const titleElement = videoElement.querySelector('#video-title'); // Select the title element
//     if (titleElement) {
//         videoTitles.push(titleElement.innerText.trim()); // Add the title text to the array
//     }
//     });

//     // Log the titles
//     console.log(videoTitles);

// }, 3000);

let openAIAPIKey = "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"
    ;

async function analyzeVideoTitle(videoTitle, filters) {
    let analysisResults = [];
    for (let filter of filters) {
        try {
            let prompt = `Can you give me a json object with a property analysis” whose value is “yes” or “no” based on the prompt: ${filter} \"${videoTitle}\“`;
            console.log("Prompt: " + prompt);
            const response = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${openAIAPIKey}`,
                },
                body: JSON.stringify({
                    "model": "o4-mini",
                    "input": prompt
                }),
            });

            if (!response.ok) {
                console.error('Network response was not ok:', response.statusText);
                break;
            }

            const data = await response.json();
            console.log('Success:', data);
            let analysis = JSON.parse(data.output[1].content[0].text).analysis;
            analysisResults.push(
                {
                    filter: filter,
                    analysis: analysis,
                    error: null
                }
            );
            //console.log("The results of the analysis are: ")
            //console.log(analysisResults);
            return analysisResults;
        } catch (error) {
            console.error('Error:', error);
            analysisResults.push(
                {
                    filter: filter,
                    analysis: "error",
                    error: error.message
                }
            );
        }
    }

}

class VideoElementMetadata {
    constructor(videoElement = null, videoTitleElement = null, videoTitle = '', videoTitleFilterAnalysis = {}) {
        this.videoElement = videoElement;
        this.videoTitleElement = videoTitleElement;
        this.videoTitle = videoTitle;
        this.videoTitleFiltersAnalysis = videoTitleFilterAnalysis;
    }
}

let recVideosMetadata = [];
let startIndexUnproccessedVideos = 0;
// Function to execute when recommended videos finish loading
async function onRecommendedVideosLoaded() {
    console.log('Recommended videos have been updated!');
    let videoElements = document.querySelectorAll('ytd-rich-grid-media');

    startIndexUnproccessedVideos = recVideosMetadata.length;
    for (let i = startIndexUnproccessedVideos; i < videoElements.length; i++) {
        let videoElementMetadata = new VideoElementMetadata();
        videoElementMetadata.videoElement = videoElements[i];
        videoElementMetadata.videoTitleElement = videoElements[i].querySelector('#video-title'); // Select the title element

        if (videoElementMetadata.videoTitleElement) {
            videoElementMetadata.videoTitle = videoElementMetadata.videoTitleElement.innerText.trim(); // Add the title text to the array
            analyzeVideoTitle(videoElementMetadata.videoTitle, ["Is this video about tarot?"])
            .then((result) => {
                videoElementMetadata.videoTitleFiltersAnalysis = result;
                console.log("videoElementMetadata.videoTitleFiltersAnalysis:");
                console.log(videoElementMetadata.videoTitleFiltersAnalysis);
                console.log("Filter analysis for video title: " + videoElementMetadata.videoTitle);
                for (filterAnalysis of videoElementMetadata.videoTitleFiltersAnalysis) {
                    console.log("Filter: " + filterAnalysis.filter);
                    if (filterAnalysis.error == null) {
                        console.log("filterAnalysis.error is null");
                        if (filterAnalysis.analysis == "yes") {
                            console.log("filterAnalysis.analysis is yes");
                            videoElementMetadata.videoElement.style.backgroundColor = "red";
                        }
                        if (filterAnalysis.analysis == "no") {
                            console.log("filterAnalysis.analysis is no");
                            videoElementMetadata.videoElement.style.backgroundColor = "green";
                        }
                    }
                    if (filterAnalysis.error != null) {
                        console.log("filterAnalysis.error is not null");
                        videoElementMetadata.videoElement.style.backgroundColor = "yellow";
                    }
                }
                recVideosMetadata.push(videoElementMetadata);
            });
        }
    }

    startIndexUnproccessedVideos = recVideosMetadata.length;

    //console.log("New startIndexUnproccessedVideos:");
    //console.log(startIndexUnproccessedVideos);
    // Log the titles
    //console.log("Here are the video titles:");
    for (let videoMetadata of recVideosMetadata) {
        //console.log(videoMetadata.videoTitle);
    }
}

// Set up a MutationObserver to watch for changes in the recommended videos container
const observer = new MutationObserver((mutationsList) => {
    console.log('MutationObserver triggered, here is the mutations list:');
    console.log(mutationsList);
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            if (mutationsList[0].addedNodes.length > 0) {
                onRecommendedVideosLoaded();
                break;
            }
        }
    }
});

// Start observing the recommended videos container
const startObserving = () => {

    // onRecommendedVideosLoaded();
    const container = document.getElementsByTagName('ytd-rich-grid-renderer')[0].querySelector('#contents');

    if (container) {
        observer.observe(container, { childList: true });
        console.log('Started observing recommended videos container.');
    } else {
        console.warn('Recommended videos container not found.');
    }

};


//https://www.reddit.com/r/chrome_extensions/comments/16jw7hm/youtube_js_chrome_extension_how_to_know_when/?rdt=57126

// Wait for the page to load and then start observing
window.addEventListener('yt-navigate-finish', startObserving);



chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        if (message.action === 'testOpenAIKey') {
            try {
                const response = await fetch('https://api.openai.com/v1/responses', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        "Authorization": `Bearer ${message.openAIAPIKey}`,
                    },
                    body: JSON.stringify({
                        "model": "gpt-4.1",
                        "input": "Write a one-sentence bedtime story about a unicorn."
                    }),
                });

                if (!response.ok) {
                    console.error('Network response was not ok:', response.statusText);
                    sendResponse({ error: 'Failed to fetch data from OpenAI API: ' + response.statusText });
                    return;
                }

                const data = await response.json();
                console.log('Success:', data);

                const result = {
                    gpt_4_1_output_text: data.output[0].content[0].text
                };

                sendResponse(result);
            } catch (error) {
                console.error('Error:', error);
                sendResponse({ error: 'Failed to fetch data from OpenAI API: ' + error.message });
            }
        }
    })();
    // Return true to indicate that the response will be sent asynchronously
    return true;
});