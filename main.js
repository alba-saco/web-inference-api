const queueCheckInterval = 5000;
let audioContext;
// let vggishModelLoaded = false;
let vggishModelLoaded = true;
let processingFile = false;

import { setFeatureExtractor, runFeatureExtractor} from 'web-audio-classifier';

initialize();


// INIT FUNCTION
async function initialize() {
    // check if server is reachable
    const serverReachable = await isServerReachable();

    if (serverReachable) {
        //start polling mechanism to check server for inference requests via API
        setInterval(checkFileQueue, queueCheckInterval);
    } else {
        console.log('Server is not reachable. Refresh to retry.');
    }
}

// checks if server is spun up and reachable
function isServerReachable() {
    return new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                resolve(xhr.status === 200);
            }
        };
        xhr.open('GET', 'http://localhost:3000/test', true);
        xhr.send();
    });
}

async function initializeTensorFlow() {
    await tf.ready();
}

async function checkFileQueue() {
    if (processingFile) {
        console.log('File is being processed.');
        return;
    }

    processingFile = true;

    try {
        const response = await fetch('http://localhost:3000/file/queue');

        if (!response.ok) {
            // If the response status is not OK, handle it here
            console.error('Failed to fetch file queue. Status:', response.status);
            return;
        }

        const data = await response.json();
        const fileQueue = data.fileQueue;

        if (fileQueue.length > 0) {
            console.log('Files in the queue:', fileQueue);

            const firstFileId = fileQueue[0];
            await processFile(firstFileId);
        } else {
            console.log('No files in the queue.');
        }
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            // Do nothing and return without logging anything
            return;
        } else {
            console.error('Error checking file queue:', error);
        }
    } finally {
        processingFile = false;
    }
}

async function processFile(fileId) {
    try {
        console.log("in processFile")
        const response = await fetch(`http://localhost:3000/file/${fileId}`);
        console.log(response)

        // const buffer = await response.arrayBuffer();
        const buffer = await response.arrayBuffer();
        console.log("buffer:", buffer);

        const uint8Array = new Uint8Array(buffer);
        console.log("uint8Array:", uint8Array);

        const pprocOutput = await preProcessAudioFromAPI(buffer, fileId);

        const removeResponse = await fetch(`http://localhost:3000/process/${fileId}`, { method: 'POST' });

        if (removeResponse.ok) {
            console.log('File removed from the queue.');
        } else {
            console.error('Error removing file from the queue:', postProcessResponse.statusText);
        }
    } catch (error) {
        console.error('Error processing file:', error);
    }
}

function createAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function handleStartAudioContext() {
    if (!audioContext) {
        createAudioContext();
        console.log('AudioContext started.');
    } else {
        console.log('AudioContext is already started.');
    }
}

document.getElementById('startAudioContextButton').addEventListener('click', handleStartAudioContext);

async function preProcessAudioFromAPI(audioBuffer, fileId) {
    setFeatureExtractor('./audioset-vggish-3.onnx')
    console.log("in preProcessAudioFromAPI")
    if (!audioContext) {
        console.warn('AudioContext is not started. Please click "Start Audio Context" button.');
        return { success: false, message: 'AudioContext not started' };
    }

    const audioBufferFromArray = await audioContext.decodeAudioData(audioBuffer);
    const pprocOutput = await runFeatureExtractor(audioBufferFromArray);

    const apiUrl = `http://localhost:3000/process-data/${fileId}`;
    
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ processedData: pprocOutput }),
    });

    if (response.ok) {
        console.log(`Processed data sent successfully to the server for fileId ${fileId}.`);
    } else {
        console.error(`Error sending processed data to the server for fileId ${fileId}:`, response.statusText);
    }
}
