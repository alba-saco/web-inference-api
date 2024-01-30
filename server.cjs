const express = require('express');
const multer = require('multer');
const uuid = require('uuid').v4;
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const fileStoragePath = path.join(__dirname, 'uploads');
const fileQueue = [];

if (!fs.existsSync(fileStoragePath)) {
    fs.mkdirSync(fileStoragePath);
}

let processedData;
let processedDataMap = {};
let processingStatus = {};

const fetch = require('node-fetch');
const stream = require('stream');

app.get('/test', (req, res) => {
    res.send('Hello from the server!');
});

app.get('/fetch-onnx-model', async (req, res) => {
    const modelUrl = 'https://essentia.upf.edu/models/feature-extractors/vggish/audioset-vggish-3.onnx';

    try {
        const response = await fetch(modelUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
        }

        const contentLength = response.headers.get('Content-Length');

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename=audioset-vggish-3.onnx');

        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        response.body.pipe(res);
    } catch (error) {
        console.error('Error fetching the ONNX model:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/check-processing-status/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const status = processingStatus[fileId] || 'not_processed';
    res.json({ status });
});

app.post('/process-data/:fileId', (req, res) => {
    try {
        const fileId = req.params.fileId;
        processedData = req.body.processedData;

        console.log(`Received processed data from the client for fileId ${fileId}`);

        processedDataMap[fileId] = processedData;
        processingStatus[fileId] = 'processed';

        const filePath = path.join(fileStoragePath, `${fileId}.wav`);
        fs.unlinkSync(filePath);

        console.log('File deleted after processing:', fileId);
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error handling processed data:', error);
        processingStatus[fileId] = 'error';
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/get-processed-data/:fileId', (req, res) => {
    const fileId = req.params.fileId;

    if (processedDataMap[fileId] !== undefined && processedDataMap[fileId] !== null) {
        const dataToSend = processedDataMap[fileId];
        processedDataMap[fileId] = null;
        res.json({ processedData: dataToSend });
    } else {
        res.status(404).send('Processed data not available for the specified fileId.');
    }
});

app.post('/upload', upload.single('file'), (req, res) => {
    try {
        const fileBuffer = req.file.buffer;
        const fileId = uuid();
        const filePath = path.join(fileStoragePath, `${fileId}.wav`);

        fs.writeFileSync(filePath, fileBuffer);

        console.log('File received and saved with ID:', fileId);

        fileQueue.push(fileId);

        processingStatus[fileId] = 'not_processed';

        processedDataMap[fileId] = null;

        res.status(200).json({ success: true, fileId });
    } catch (error) {
        console.error('Error handling file upload:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/file/queue', (req, res) => {
    res.status(200).json({ fileQueue });
});

app.get('/file/:fileId', (req, res) => {
    const fileId = req.params.fileId;
    const filePath = path.join(fileStoragePath, `${fileId}.wav`);

    if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        res.status(200).send(fileBuffer);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

app.post('/process/:fileId', (req, res) => {
    const fileId = req.params.fileId;

    const fileIndex = fileQueue.indexOf(fileId);
    if (fileIndex !== -1) {
        fileQueue.splice(fileIndex, 1);
        
        const filePath = path.join(fileStoragePath, `${fileId}.wav`);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('File deleted after processing:', fileId);
        }

        processingStatus[fileId] = 'processed';

        res.status(200).json({ success: true });
    } else {
        console.error('File not found in the queue:', fileId);

        processingStatus[fileId] = 'error';

        res.status(404).json({ error: 'File not found in the queue' });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});