(() => {
    // GLOBAL GUARD: Prevent ANY execution in subframes or about:blank pages
    if (window.top !== window.self || location.protocol === 'about:' || location.href.includes('about:blank')) {
        return;
    }

    (() => {
        // Only inject into the top frame to avoid "Blocked script execution" in sandboxed iframes
        // Also explicitly check for about:blank or other non-http/https schemes just in case
        if (window.top !== window.self ||
            location.protocol === 'about:' ||
            location.href.includes('about:blank')) {
            return;
        }

        /* 
        // Debug logger disabled to prevent 403 errors and performance issues
        const url = chrome.runtime.getURL('injected.js');
        const s   = document.createElement('script');
        s.src     = url;
        s.type    = 'text/javascript';
        (document.documentElement || document.head).appendChild(s);
        s.onload  = () => s.remove();   // tidy up after loading
        */
    })();

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
    // // console.log(ytRecGridElements);
    // // console.log("Here");
    // // console.log("Grid elements length: " + yetRecGridElementsLength);
    // let ytRecVideoTitles = [];

    // setTimeout(() => {
    //     // console.log("RAN after 3 seconds");
    //     for(let gridElement of ytRecGridElements){
    //         // console.log("RAN for each grid element");
    //         // console.log(gridElement);
    //         let videoTitleElement = gridElement.getElementsById('video-title');
    //         // console.log(videoTitleElement);
    //         ytRecVideoTitles.push(videoTitleElement[0].innerText);
    //     }
    //     // console.log(ytRecVideoTitles);
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
    //     // console.log(videoTitles);

    // }, 3000);

    const openAIAPIKey = "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"
        ;

    const GEMINI_API_KEY = "AIzaSyCDKFqjsVmTooAZe_yIIGXv5To0HWdquc0";

    // Add delay function and rate limiting
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const REQUEST_DELAY_MS = 500; // 1 second between requests

    async function makeGeminiRequest(prompt, base64ImageData = null) {
        const MODEL_ID = "gemma-3-4b-it";
        const GENERATE_CONTENT_API = "streamGenerateContent";

        try {
            const requestBody = {
                "contents": [{
                    "role": "user",
                    "parts": base64ImageData ? [
                        { "inlineData": { "mimeType": "image/jpeg", "data": base64ImageData } },
                        { "text": prompt }
                    ] : [{ "text": prompt }]
                }],
                "generationConfig": { "responseMimeType": "text/plain" }
            };

            const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!apiResponse.ok) {
                throw new Error(`Network error: ${apiResponse.statusText}`);
            }

            const data = await apiResponse.json();
            // console.log('Success (Gemini API):', data);

            let analysis = data.map(item => {
                try {
                    return item.candidates?.[0]?.content?.parts?.[0]?.text || "";
                } catch (e) {
                    return "";
                }
            }).join("");

            return analysis;
        } catch (error) {
            throw error;
        }
    }

    async function analyzeTitleText(videoTitle, titleFilters, videoElementMetadata = null) {
        let analysisResults = [];

        for (let i = 0; i < titleFilters.length; i++) {
            const filter = titleFilters[i];

            // Update overlay message to show current request status
            if (videoElementMetadata) {
                createVideoThumbnailFilterOverlay(videoElementMetadata, 'processing', { message: `Processing title filter ${i + 1}/${titleFilters.length} "${filter}"` });
            }

            // Add delay between requests (except for the first one)
            if (i > 0) {
                // console.log(`Waiting ${REQUEST_DELAY_MS}ms before next title filter request...`);
                await delay(REQUEST_DELAY_MS);
            }

            try {
                const prompt = `Can you give me a json object with a property analysis" whose value is "yes" or "no" based on the prompt: ${filter} "${videoTitle}"`;

                const analysis = await makeGeminiRequest(prompt);
                // console.log("Analysis (Title Filter): " + analysis);

                analysisResults.push({
                    filter: filter,
                    filterType: "title",
                    analysis: analysis,
                    error: null
                });

            } catch (error) {
                console.error('Error during API call for title filter:', filter, error);
                analysisResults.push({
                    filter: filter,
                    filterType: "title",
                    analysis: "error",
                    error: error.message
                });
            }
        }

        // Update overlay to show completion
        if (videoElementMetadata) {
            createVideoThumbnailFilterOverlay(videoElementMetadata, 'processing', { message: 'Title analysis complete, checking images...' });
        }

        return analysisResults;
    }

    async function analyzeImageFromElement(videoPreviewImageElement, videoTitle, previewImageFilters, videoElementMetadata = null) {
        let analysisResults = [];

        if (!videoPreviewImageElement) {
            // console.warn('analyzeImageFromElement called with null videoPreviewImageElement. Skipping.');
            for (let filter of previewImageFilters) {
                analysisResults.push({
                    filter: filter,
                    filterType: "previewImage",
                    analysis: "error",
                    error: "Image element was null"
                });
            }
            return analysisResults;
        }

        const currentImgSrc = videoPreviewImageElement.src;

        // Validate the image source URL
        if (!currentImgSrc || !(currentImgSrc.includes('ytimg.com') || currentImgSrc.includes('ggpht.com'))) {
            // console.warn(`Invalid or non-YouTube/Google image src detected in analyzeImageFromElement. Actual src: "${currentImgSrc}"`);
            for (let filter of previewImageFilters) {
                analysisResults.push({
                    filter: filter,
                    filterType: "previewImage",
                    analysis: "error",
                    error: `Invalid image source URL: ${currentImgSrc || 'null'}`
                });
            }
            return analysisResults;
        }

        // Image src seems plausible, proceed with attempting to load and process it.
        try {
            // console.log('Attempting to load and process image from valid src in analyzeImageFromElement:', currentImgSrc);

            // Update overlay to show image processing status
            if (videoElementMetadata) {
                createVideoThumbnailFilterOverlay(videoElementMetadata, 'processing', { message: 'Loading and processing image...' });
            }

            const loadedImage = await new Promise((resolve, reject) => {
                const newImg = new Image();
                newImg.crossOrigin = 'Anonymous';

                const handleLoad = () => {
                    newImg.removeEventListener('load', handleLoad);
                    newImg.removeEventListener('error', handleError);
                    if (newImg.naturalWidth > 0) {
                        // console.log('New image loaded successfully (analyzeImageFromElement):', newImg.src, `(${newImg.naturalWidth}x${newImg.naturalHeight})`);
                        resolve(newImg);
                    } else {
                        console.error('New image loaded (onload) but naturalWidth is 0 (analyzeImageFromElement):', newImg.src);
                        reject(new Error(`New image ${newImg.src} reported load but naturalWidth is 0`));
                    }
                };

                const handleError = (errorEvent) => {
                    newImg.removeEventListener('load', handleLoad);
                    newImg.removeEventListener('error', handleError);
                    console.error('New image failed to load (onerror) (analyzeImageFromElement):', newImg.src, errorEvent);
                    reject(new Error(`Failed to load new image ${newImg.src} (onerror)`));
                };

                newImg.addEventListener('load', handleLoad);
                newImg.addEventListener('error', handleError);
                newImg.src = currentImgSrc;

                if (newImg.complete && newImg.naturalWidth === 0 && newImg.src) {
                    // console.warn('New image was already complete but invalid immediately after src assignment (analyzeImageFromElement):', newImg.src);
                }
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = loadedImage.naturalWidth;
            canvas.height = loadedImage.naturalHeight;
            // console.log(`Canvas dimensions set to (analyzeImageFromElement): ${canvas.width}x${canvas.height} for ${loadedImage.src}`);
            ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
            const base64ImageData = canvas.toDataURL('image/jpeg').split(',')[1];
            // console.log(`Generated base64 data (analyzeImageFromElement). Length: ${base64ImageData.length}. Preview: ${base64ImageData.substring(0, 100)}...`);

            for (let i = 0; i < previewImageFilters.length; i++) {
                const filter = previewImageFilters[i];

                // Update overlay message to show current request status
                if (videoElementMetadata) {
                    createVideoThumbnailFilterOverlay(videoElementMetadata, 'processing', { message: `Processing image filter ${i + 1}/${previewImageFilters.length} "${filter}"` });
                }

                // Add delay between requests (except for the first one)
                if (i > 0) {
                    // console.log(`Waiting ${REQUEST_DELAY_MS}ms before next image filter request...`);
                    await delay(REQUEST_DELAY_MS);
                }

                try {
                    const prompt = `Can you give me a json object with a property analysis" whose value is "yes" or "no" based on the prompt: ${filter} "${videoTitle}"`;

                    const analysis = await makeGeminiRequest(prompt, base64ImageData);
                    // console.log("Analysis (Image Filter): " + analysis);

                    analysisResults.push({
                        filter: filter,
                        filterType: "previewImage",
                        analysis: analysis,
                        error: null
                    });
                } catch (error) {
                    console.error('Error during API call for image filter (analyzeImageFromElement):', filter, error);
                    analysisResults.push({
                        filter: filter,
                        filterType: "previewImage",
                        analysis: "error",
                        error: error.message
                    });
                }
            }

            // Update overlay to show completion
            if (videoElementMetadata) {
                createVideoThumbnailFilterOverlay(videoElementMetadata, 'processing', { message: 'Image analysis complete, finalizing...' });
            }

        } catch (imageProcessingError) {
            console.error('Image processing error in analyzeImageFromElement:', imageProcessingError.message, 'Original src was:', currentImgSrc);
            for (let filter of previewImageFilters) {
                analysisResults.push({
                    filter: filter,
                    filterType: "previewImage",
                    analysis: "error",
                    error: `Image processing failed: ${imageProcessingError.message}`
                });
            }
        }
        return analysisResults;
    }

    async function analyzeVideoGridItemGemma(videoTitle, titleFilters, previewImageFilters, videoPreviewImageElement) {
        // The core logic has been moved to analyzeTitleText and analyzeImageFromElement.
        // console.warn("analyzeVideoGridItemGemma is being refactored and should ideally not be directly called in its current state.");

        let allAnalysisResults = [];

        // Example of how new functions might be called (actual calls will be in onRecommendedVideosLoaded)
        if (titleFilters && titleFilters.length > 0) {
            const titleResults = await analyzeTitleText(videoTitle, titleFilters, videoElementMetadata)
                .then(titleResults => {
                    // console.log(`[BG-TRACE] Title analysis complete for "${videoElementMetadata.videoTitle}". About to call updateDOMWithAnalysisResults with 'title'.`);
                    videoElementMetadata.videoTitleFiltersAnalysis = titleResults;
                    updateDOMWithAnalysisResults(videoElementMetadata, 'title');
                })
                .catch(error => console.error('Error in title analysis chain:', error));
            allAnalysisResults = allAnalysisResults.concat(titleResults);
        }

        if (previewImageFilters && previewImageFilters.length > 0 && videoPreviewImageElement) {
            const imageResults = await analyzeImageFromElement(videoPreviewImageElement, videoTitle, previewImageFilters, videoElementMetadata)
                .then(imageResults => {
                    // console.log(`[BG-TRACE] Image analysis complete for "${videoElementMetadata.videoTitle}". About to call updateDOMWithAnalysisResults with 'image'.`);
                    videoElementMetadata.videoPreviewImageFiltersAnalysis = imageResults;
                    updateDOMWithAnalysisResults(videoElementMetadata, 'image');
                })
                .catch(error => console.error(`Error in immediate image analysis chain for "${videoElementMetadata.videoTitle}":`, error));
            allAnalysisResults = allAnalysisResults.concat(imageResults);
        }

        return allAnalysisResults;
    }

    function createVideoThumbnailFilterOverlay(videoElementMetadata, state, options = {}) {
        const { message, analysis } = options;
        const videoElement = videoElementMetadata.videoElement;
        const thumbnailElement = videoElement.querySelector('#thumbnail');

        if (!thumbnailElement) {
            // console.warn('Cannot create overlay: thumbnail element not found');
            return;
        }

        // Check if an overlay already exists to avoid creating duplicates
        let overlayDiv = thumbnailElement.querySelector('.yt-thumbnail-filter-overlay');
        if (overlayDiv) {
            // console.log('Overlay already exists, will update instead of creating.');
        } else {
            overlayDiv = document.createElement('div');
            overlayDiv.className = 'yt-thumbnail-filter-overlay';
            overlayDiv.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            text-align: center;
            padding: 10px;
            box-sizing: border-box;
            transition: background-color 0.3s ease;
        `;
            thumbnailElement.style.position = 'relative';
            thumbnailElement.appendChild(overlayDiv);
        }

        // Clear previous content before setting new state
        overlayDiv.innerHTML = '';

        if (state === 'processing') {
            overlayDiv.style.backgroundColor = 'rgba(0, 0, 255, 1.0)';
            const messageDiv = document.createElement('div');
            messageDiv.className = 'yt-filter-message';
            messageDiv.textContent = message || 'Applying Filters To Video...';
            messageDiv.style.cssText = `
            font-weight: bold;
            font-size: 14px;
        `;
            overlayDiv.appendChild(messageDiv);
            applyBlurToVideoMetadata(videoElementMetadata);
            // console.log(`Created processing overlay for "${videoElementMetadata.videoTitle}" with message: "${message}"`);

        } else if (state === 'filtered') {
            overlayDiv.style.backgroundColor = 'rgba(255, 0, 0, 1.0)';

            const messageDiv = document.createElement('div');
            messageDiv.textContent = 'This Video Has Been Filtered';
            messageDiv.style.cssText = `
            font-weight: bold;
            margin-bottom: 15px;
            font-size: 16px;
        `;

            const moreInfoButton = document.createElement('button');
            moreInfoButton.textContent = 'More Information';
            moreInfoButton.style.cssText = `
            background-color: #ff6666;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
        `;
            moreInfoButton.addEventListener('mouseenter', () => moreInfoButton.style.backgroundColor = '#ff4444');
            moreInfoButton.addEventListener('mouseleave', () => moreInfoButton.style.backgroundColor = '#ff6666');
            moreInfoButton.addEventListener('click', (e) => {
                e.stopPropagation();
                showMoreInformation(overlayDiv, videoElementMetadata, analysis);
            });

            overlayDiv.appendChild(messageDiv);
            overlayDiv.appendChild(moreInfoButton);
            applyBlurToVideoMetadata(videoElementMetadata);
            // console.log(`Created filter overlay for "${videoElementMetadata.videoTitle}"`);
        }
    }

    function removeVideoThumbnailFilterOverlay(videoElementMetadata) {
        const videoElement = videoElementMetadata.videoElement;
        if (!videoElement) return;
        const thumbnailElement = videoElement.querySelector('#thumbnail');

        if (thumbnailElement) {
            const overlay = thumbnailElement.querySelector('.yt-thumbnail-filter-overlay');
            if (overlay) {
                overlay.remove();
            }
        }

        // Remove blur from all blurred elements
        if (videoElementMetadata.blurredElements && videoElementMetadata.blurredElements.length > 0) {
            videoElementMetadata.blurredElements.forEach((element) => {
                if (element) {
                    element.style.filter = '';
                }
            });
            videoElementMetadata.blurredElements = [];
        }
        // console.log(`Removed filter overlay and blur for "${videoElementMetadata.videoTitle}"`);
    }

    function applyFilterBehavior(videoElementMetadata) {
        if (!videoElementMetadata || !videoElementMetadata.videoElement) return;

        // If the video is still processing, don't do anything. Its blue overlay should remain.
        if (videoElementMetadata.processingState === 'processing') {
            return;
        }

        const elementToToggle = videoElementMetadata.videoElement.closest('ytd-rich-item-renderer') || videoElementMetadata.videoElement;

        if (!videoElementMetadata.isFiltered) {
            // If the video is not filtered, ensure it's visible and has no overlay.
            elementToToggle.style.display = '';
            removeVideoThumbnailFilterOverlay(videoElementMetadata);
            return;
        }

        // If the video is filtered, apply behavior
        if (filterBehavior === 'remove') {
            elementToToggle.style.display = 'none';
            removeVideoThumbnailFilterOverlay(videoElementMetadata); // Clean up just in case
        } else { // 'show'
            elementToToggle.style.display = '';
            createVideoThumbnailFilterOverlay(videoElementMetadata, 'filtered', { analysis: videoElementMetadata.filterAnalysis });
        }
    }

    function reapplyAllFilterBehaviors() {
        // console.log(`Re-applying filter behaviors for all ${recVideosMetadata.length} videos. New behavior: ${filterBehavior}`);
        recVideosMetadata.forEach(applyFilterBehavior);
    }

    function updateDOMWithAnalysisResults(videoElementMetadata, analysisType) {
        if (!videoElementMetadata || !videoElementMetadata.videoElement) {
            // console.warn('updateDOMWithAnalysisResults: Invalid videoElementMetadata or videoElement.');
            return;
        }

        // console.log(`Updating DOM for "${videoElementMetadata.videoTitle}" after ${analysisType} analysis.`);

        // Check which types of filters are expected to run
        const titleFiltersExpected = videoElementMetadata.expectedTitleFilters || 0;
        const imageFiltersExpected = videoElementMetadata.expectedImageFilters || 0;

        // Check if all expected filters have completed
        const titleFiltersCompleted = videoElementMetadata.videoTitleFiltersAnalysis ? videoElementMetadata.videoTitleFiltersAnalysis.length : 0;
        const imageFiltersCompleted = videoElementMetadata.videoPreviewImageFiltersAnalysis ? videoElementMetadata.videoPreviewImageFiltersAnalysis.length : 0;

        const allFiltersCompleted = (titleFiltersCompleted >= titleFiltersExpected) && (imageFiltersCompleted >= imageFiltersExpected);

        // console.log(`Filter completion status for "${videoElementMetadata.videoTitle}": Title(${titleFiltersCompleted}/${titleFiltersExpected}), Image(${imageFiltersCompleted}/${imageFiltersExpected}), All completed: ${allFiltersCompleted}`);

        // If not all filters are complete, keep the blue processing overlay and do nothing else.
        if (!allFiltersCompleted) {
            // console.log(`Not all filters completed for "${videoElementMetadata.videoTitle}". Keeping blue processing overlay.`);
            return;
        }

        videoElementMetadata.processingState = 'completed';

        // All filters are complete, now determine final state
        let shouldBeFiltered = false;
        let analysisForOverlay = null;
        let hasError = false;
        let hasNo = false;

        const allFilters = [
            ...(videoElementMetadata.videoTitleFiltersAnalysis || []),
            ...(videoElementMetadata.videoPreviewImageFiltersAnalysis || [])
        ];

        for (const filterAnalysis of allFilters) {
            if (filterAnalysis.error != null) {
                hasError = true;
                // console.warn(`Filter error for "${videoElementMetadata.videoTitle}" (filter: ${filterAnalysis.filter})`);
                continue;
            }

            if (filterAnalysis.analysis.toLowerCase().includes("yes")) {
                shouldBeFiltered = true;
                analysisForOverlay = filterAnalysis;
                break;
            }

            if (filterAnalysis.analysis.toLowerCase().includes("no")) {
                hasNo = true;
            }
        }

        // Store final filter decision on the metadata object
        videoElementMetadata.isFiltered = shouldBeFiltered;
        videoElementMetadata.filterAnalysis = analysisForOverlay;

        // Apply final state based on priority: Red overlay > Yellow background > Green background
        if (shouldBeFiltered) {
            // A "yes" was found. Remove any existing background color and apply the current filter behavior.
            videoElementMetadata.videoElement.style.backgroundColor = '';
            applyFilterBehavior(videoElementMetadata);
            // console.log(`Applying filter behavior for "${videoElementMetadata.videoTitle}" - positive filter result`);
        } else if (hasError) {
            // An error occurred. Remove the overlay and show a yellow background.
            removeVideoThumbnailFilterOverlay(videoElementMetadata);
            videoElementMetadata.videoElement.style.setProperty('background-color', 'rgba(255, 255, 0, 1.0)', 'important');
            // console.log(`Set background to yellow for "${videoElementMetadata.videoTitle}" due to filter errors`);
        } else {
            // No clear result, remove processing overlay and return to default
            removeVideoThumbnailFilterOverlay(videoElementMetadata);
            videoElementMetadata.videoElement.style.backgroundColor = ''; // Ensure no background color is applied
            // console.log(`Removed processing overlay for "${videoElementMetadata.videoTitle}" - no conclusive filter results`);
        }
    }

    function applyBlurToVideoMetadata(videoElementMetadata) {
        const elementsToBlur = [];

        // Always blur the title element if it exists
        if (videoElementMetadata.videoTitleElement) {
            elementsToBlur.push(videoElementMetadata.videoTitleElement);
            // console.log('Adding title element to blur list');
        }

        // Try to find and blur the metadata container as well
        const videoElement = videoElementMetadata.videoElement;
        const metadataElement = videoElement.querySelector('#metadata') ||
            videoElement.querySelector('#details') ||
            videoElement.querySelector('.details');

        if (metadataElement && !elementsToBlur.includes(metadataElement)) {
            elementsToBlur.push(metadataElement);
            // console.log('Adding metadata container to blur list');
        }

        // Apply blur to all found elements
        elementsToBlur.forEach((element, index) => {
            if (element) {
                // console.log(`Applying blur to element ${index + 1}: ${element.tagName}${element.id ? '#' + element.id : ''}${element.className ? '.' + element.className.split(' ').join('.') : ''}`);
                element.style.filter = 'blur(3px)';
                element.style.transition = 'filter 0.3s ease';
            }
        });

        // Store references for cleanup
        videoElementMetadata.blurredElements = elementsToBlur.filter(el => el);
    }

    function showMoreInformation(overlayDiv, videoElementMetadata, analysis) {
        // Clear the overlay content
        overlayDiv.innerHTML = '';

        // Create reasoning message
        const videoFilterReasoningMessage = "The reasoning from LLM response should go here.";
        const reasoningDiv = document.createElement('div');
        reasoningDiv.textContent = videoFilterReasoningMessage;
        reasoningDiv.style.cssText = `
        color: white;
        margin-bottom: 20px;
        font-size: 12px;
        line-height: 1.4;
        padding: 0 10px;
    `;

        // Create "Reveal Video" button
        const revealButton = document.createElement('button');
        revealButton.textContent = 'Reveal Video';
        revealButton.style.cssText = `
        background-color: #66ff66;
        color: black;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        position: absolute;
        bottom: 15px;
        left: 50%;
        transform: translateX(-50%);
    `;

        // Add hover effect to reveal button
        revealButton.addEventListener('mouseenter', () => {
            revealButton.style.backgroundColor = '#44ff44';
        });
        revealButton.addEventListener('mouseleave', () => {
            revealButton.style.backgroundColor = '#66ff66';
        });

        // Add click handler for "Reveal Video"
        revealButton.addEventListener('click', (e) => {
            e.stopPropagation();
            removeVideoThumbnailFilterOverlay(videoElementMetadata);
        });

        overlayDiv.appendChild(reasoningDiv);
        overlayDiv.appendChild(revealButton);

        // console.log(`Showed more information for "${videoElementMetadata.videoTitle}"`);
    }

    class VideoElementMetadata {
        constructor(videoElement = null, videoTitleElement = null, videoTitle = '', videoPreviewImageElement = null) {
            this.videoElement = videoElement;
            this.videoTitleElement = videoTitleElement;
            this.videoTitle = videoTitle;
            this.videoTitleFiltersAnalysis = [];
            this.videoPreviewImageFiltersAnalysis = [];
            this.videoPreviewImageElement = videoPreviewImageElement;
            this.isFiltered = false;
            this.filterAnalysis = null;
            this.processingState = 'processing';
        }
    }

    let recVideosMetadata = [];
    let videoProcessingQueue = [];
    let isScanningForVideos = false;
    let isProcessingQueue = false;

    async function processVideoQueue() {
        if (isProcessingQueue) return;
        isProcessingQueue = true;

        while (videoProcessingQueue.length > 0) {
            const videoElementMetadata = videoProcessingQueue.shift();

            try {
                // console.log(`[Debug] Processing video ${recVideosMetadata.indexOf(videoElementMetadata)}: "${videoElementMetadata.videoTitle}".`);

                // --- Title Analysis (Immediate) ---
                const titleFilters = ["Does this video have to do with programming?"]; // Example: ["Is this video title about tarot?"]
                videoElementMetadata.expectedTitleFilters = titleFilters.length;

                if (titleFilters.length > 0) {
                    await analyzeTitleText(videoElementMetadata.videoTitle, titleFilters, videoElementMetadata)
                        .then(titleResults => {
                            // console.log(`[BG-TRACE] Title analysis complete for "${videoElementMetadata.videoTitle}". About to call updateDOMWithAnalysisResults with 'title'.`);
                            videoElementMetadata.videoTitleFiltersAnalysis = titleResults;
                            updateDOMWithAnalysisResults(videoElementMetadata, 'title');
                        })
                        .catch(error => console.error('Error in title analysis chain:', error));
                } else {
                    // console.log(`[BG-TRACE] No title filters for "${videoElementMetadata.videoTitle}". Blue should persist.`);
                }

                // --- Image Analysis (Immediate or Delayed via Observer) ---
                const previewImageFilters = ["Does this video preview image have a person in it?"]; // Example filter
                videoElementMetadata.expectedImageFilters = previewImageFilters.length;
                if (previewImageFilters.length > 0) {
                    const imgElement = videoElementMetadata.videoPreviewImageElement;
                    if (imgElement) {
                        const currentSrc = imgElement.src;
                        const isValidSrc = currentSrc && (currentSrc.includes('ytimg.com') || currentSrc.includes('ggpht.com'));

                        if (isValidSrc) {
                            // console.log(`[BG-TRACE] Image for "${videoElementMetadata.videoTitle}" has valid initial src. Starting analysis.`);
                            await analyzeImageFromElement(imgElement, videoElementMetadata.videoTitle, previewImageFilters, videoElementMetadata)
                                .then(imageResults => {
                                    // console.log(`[BG-TRACE] Image analysis complete for "${videoElementMetadata.videoTitle}". About to call updateDOMWithAnalysisResults with 'image'.`);
                                    videoElementMetadata.videoPreviewImageFiltersAnalysis = imageResults;
                                    updateDOMWithAnalysisResults(videoElementMetadata, 'image');
                                })
                                .catch(error => console.error(`Error in immediate image analysis chain for "${videoElementMetadata.videoTitle}":`, error));
                        } else {
                            // console.log(`[BG-TRACE] Image for "${videoElementMetadata.videoTitle}" has invalid/empty initial src: "${currentSrc}". Will observe for changes. NOT calling updateDOMWithAnalysisResults yet.`);
                            const observer = new MutationObserver((mutationsList, obs) => {
                                for (const mutation of mutationsList) {
                                    if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                                        const newSrc = imgElement.src;
                                        // console.log(`[Observer] src changed for "${videoElementMetadata.videoTitle}". New src: "${newSrc}"`);
                                        if (newSrc && (newSrc.includes('ytimg.com') || newSrc.includes('ggpht.com'))) {
                                            obs.disconnect();
                                            // console.log(`[BG-TRACE] Valid src found for "${videoElementMetadata.videoTitle}". Starting delayed image analysis.`);
                                            analyzeImageFromElement(imgElement, videoElementMetadata.videoTitle, previewImageFilters, videoElementMetadata)
                                                .then(imageResults => {
                                                    // console.log(`[BG-TRACE] Delayed image analysis complete for "${videoElementMetadata.videoTitle}". About to call updateDOMWithAnalysisResults with 'image-observed'.`);
                                                    videoElementMetadata.videoPreviewImageFiltersAnalysis = imageResults;
                                                    updateDOMWithAnalysisResults(videoElementMetadata, 'image-observed');
                                                })
                                                .catch(error => console.error(`Error in observed image analysis chain for "${videoElementMetadata.videoTitle}":`, error));
                                        }
                                    }
                                }
                            });
                            observer.observe(imgElement, { attributes: true });
                        }
                    } else {
                        // console.log(`[BG-TRACE] No imgElement found for "${videoElementMetadata.videoTitle}". NOT calling updateDOMWithAnalysisResults for image errors yet.`);
                    }
                }
            } catch (error) {
                console.error('Error processing video from queue:', videoElementMetadata.videoTitle, error);
            }

            // Add delay between processing each video to spread out API calls
            if (videoProcessingQueue.length > 0) {
                // console.log(`Waiting ${REQUEST_DELAY_MS}ms before processing next video...`);
                await delay(REQUEST_DELAY_MS);
            }
        }

        isProcessingQueue = false;
    }

    // Function to execute when recommended videos finish loading
    async function onRecommendedVideosLoaded() {
        // Prevent concurrent scanning
        if (isScanningForVideos) {
            // console.log('[onRecommendedVideosLoaded] Already scanning for videos, skipping this call.');
            return;
        }

        isScanningForVideos = true;

        try {
            let videoElements = document.querySelectorAll('ytd-rich-grid-media');
            // console.log(`[onRecommendedVideosLoaded] Found ${videoElements.length} video elements. Processing new ones starting from index ${recVideosMetadata.length}.`);

            const newVideoElements = Array.from(videoElements).slice(recVideosMetadata.length);

            if (newVideoElements.length > 0) {
                for (let i = 0; i < newVideoElements.length; i++) {
                    const videoElement = newVideoElements[i];
                    const videoIndexInRecVideos = recVideosMetadata.length;

                    let videoElementMetadata = new VideoElementMetadata();
                    videoElementMetadata.videoElement = videoElement;
                    videoElementMetadata.videoTitleElement = videoElement.querySelector('#video-title');

                    const thumbnailElement = videoElement.querySelector('#thumbnail');
                    let imgElement = null;
                    if (thumbnailElement) {
                        imgElement = thumbnailElement.querySelector('img');
                        videoElementMetadata.videoPreviewImageElement = imgElement;
                    } else {
                        // console.warn(`[Debug] Thumbnail container (#thumbnail) NOT found for video index ${videoIndexInRecVideos}.`);
                    }

                    // Immediately apply initial overlay
                    createVideoThumbnailFilterOverlay(videoElementMetadata, 'processing', { message: 'Waiting to process video through content filters...' });
                    // console.log(`[BG-TRACE] Applied initial overlay to video ${videoIndexInRecVideos}`);

                    if (!videoElementMetadata.videoTitleElement) {
                        console.warn(`[Debug] Video title element NOT found for video index ${videoIndexInRecVideos}. Skipping all analysis.`);
                        recVideosMetadata.push(videoElementMetadata); // Push to maintain count and prevent reprocessing
                        continue;
                    }

                    videoElementMetadata.videoTitle = videoElementMetadata.videoTitleElement.innerText.trim();
                    recVideosMetadata.push(videoElementMetadata);
                    videoProcessingQueue.push(videoElementMetadata);
                }

                // Start the queue processor if it's not already running
                processVideoQueue();
            }
        } finally {
            isScanningForVideos = false;
        }
    }

    // --- New Polling and Event Handling Logic ---

    let mainIntervalId = null;

    function resetStateAndStart() {
        // console.log('Resetting state and restarting observation...');
        recVideosMetadata = [];
        videoProcessingQueue = [];
        isScanningForVideos = false;

        if (mainIntervalId) {
            clearInterval(mainIntervalId);
        }

        // Start a new interval
        mainIntervalId = setInterval(onRecommendedVideosLoaded, 1500); // Check every 1.5 seconds

        // Run an initial check immediately
        onRecommendedVideosLoaded();
    }

    // Listen for YouTube's navigation event to reset and restart the process
    window.addEventListener('yt-navigate-finish', resetStateAndStart);

    // Run on initial script injection
    resetStateAndStart();

    let filterBehavior = 'show'; // Default behavior

    // Load initial filter behavior from storage
    chrome.storage.local.get(['filterBehavior'], (result) => {
        filterBehavior = result.filterBehavior || 'show';
        // console.log('Initial filter behavior loaded:', filterBehavior);
    });

    // Listen for storage changes to update behavior in real-time
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.filterBehavior) {
            filterBehavior = changes.filterBehavior.newValue;
            // console.log('Filter behavior updated by storage change:', filterBehavior);
            reapplyAllFilterBehaviors();
        }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        (async () => {
            if (message.action === 'saveEventLog') {
                try {
                    window.postMessage({ type: 'FROM_CONTENT_SCRIPT_SAVE_LOG' }, '*');
                    sendResponse({ status: 'success' });
                } catch (error) {
                    console.error('Error posting message to trigger saveEventLog:', error);
                    sendResponse({ status: 'error', message: error.message });
                }
            } else if (message.action === 'updateFilterBehavior') {
                filterBehavior = message.behavior;
                // console.log(`Filter behavior updated by message: ${filterBehavior}`);
                reapplyAllFilterBehaviors();
                sendResponse({ status: 'success' });
            } else if (message.action === 'testOpenAIKey') {
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
                        // console.error('Network response was not ok:', response.statusText);
                        sendResponse({ error: 'Failed to fetch data from OpenAI API: ' + response.statusText });
                        return;
                    }

                    const data = await response.json();
                    // console.log('Success:', data);

                    const result = {
                        gpt_4_1_output_text: data.output[0].content[0].text
                    };

                    sendResponse(result);
                } catch (error) {
                    // console.error('Error:', error);
                    sendResponse({ error: 'Failed to fetch data from OpenAI API: ' + error.message });
                }
            }
        })();
        // Return true to indicate that the response will be sent asynchronously
        return true;
    });

})(); // End of GLOBAL GUARD IIFE