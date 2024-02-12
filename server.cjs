const express = require('express');
const multer = require('multer');
const uuid = require('uuid').v4;
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const mime = require('mime-types');

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
    let fileId;
    try {
        fileId = req.params.fileId;
        processedData = req.body.processedData;

        if (!processedData) {
            console.error('Invalid processedData');
            throw new Error('Invalid processedData');
        }

        console.log(`Received processed data from the client for fileId ${fileId}`);

        const originalExtension = processedDataMap[fileId]?.originalExtension;

        if (!originalExtension) {
            console.error(`Original extension not found for fileId ${fileId}`);
            throw new Error('Original extension not found');
        }

        processedDataMap[fileId] = processedData;
        processingStatus[fileId] = 'processed';

        const filePath = path.join(fileStoragePath, `${fileId}${originalExtension}`);
        fs.unlinkSync(filePath);

        console.log('File deleted after processing:', fileId);
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error handling processed data:', error);
        if (fileId) {
            processingStatus[fileId] = 'error';
        }
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
        console.log("upload endpoint")
        const fileBuffer = req.file.buffer;
        console.log(fileBuffer)
        const fileId = uuid();
        const originalExtension = path.extname(req.file.originalname);
        const filePath = path.join(fileStoragePath, `${fileId}${originalExtension}`);

        fs.writeFileSync(filePath, fileBuffer);

        console.log('File received and saved with ID:', fileId);

        fileQueue.push(fileId);

        processingStatus[fileId] = 'not_processed';

        processedDataMap[fileId] = { originalExtension };

        // res.status(200).json({ success: true, fileId });
        res.status(200).json({ success: true, fileId, fileContent: fileBuffer.toString('base64') });
    } catch (error) {
        console.error('Error handling file upload:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/file/queue', (req, res) => {
    res.status(200).json({ fileQueue });
});

app.get('/file/:fileId', (req, res) => {
    console.log("get endpoint")
    const fileId = req.params.fileId;
    const filePath = path.join(fileStoragePath, `${fileId}${processedDataMap[fileId].originalExtension}`);

    if (fs.existsSync(filePath)) {
        try {
            const fileBuffer = fs.readFileSync(filePath);
            console.log("fileBuffer:", fileBuffer);

            const contentType = mime.lookup(filePath);
            console.log("contentType:", contentType); 

            if (contentType) {
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Length', fileBuffer.length);
            }

            // res.status(200).send(fileBuffer);
            res.status(200).end(fileBuffer);
        } catch (error) {
            console.error("Error reading file:", error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

app.post('/process/:fileId', (req, res) => {
    const fileId = req.params.fileId;

    const fileIndex = fileQueue.indexOf(fileId);
    if (fileIndex !== -1) {
        fileQueue.splice(fileIndex, 1);
        
        const filePath = path.join(fileStoragePath, `${fileId}${processedDataMap[fileId].originalExtension}`);

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