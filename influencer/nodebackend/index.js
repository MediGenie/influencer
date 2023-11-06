import express from 'express';
const app = express();
import cors from 'cors';
import fs from 'fs';
import http from "http";
import request from 'request';
import path from 'path';
const port = process.env.PORT || 5001;
import { Server } from "socket.io";
import { convertTextToAudio } from './fetchAPI.js';
import PQueue from 'p-queue';
const queue = new PQueue({ concurrency: 1 });

app.use(cors());

// Load configuration settings from config.json
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Define the path to the React app's build folder
const buildFolder = path.join(__dirname, 'frontend', 'build');

const API_URL_TEXT = config.API_URL_TEXT;
const API_KEY_TEXT = config.API_KEY_TEXT;
const API_URL_AUDIO = config.API_URL_AUDIO;
const API_KEY_AUDIO = config.API_KEY_AUDIO;


async function generateText(prompt, chatHistory = null) {
    
    const headers = {
        'accept': 'audio/mpeg;charset=UTF-8',
        'authorization': API_KEY_TEXT,
        'Content-Type': 'application/json',
    };

    const data = {
        'prompt': prompt,
        'chatbot_model': 'gpt-3.5-turbo',
    };

    const response = await fetch(`${API_URL_TEXT}`, {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });
    return response;
}

async function processRequest(line, selected_voice, userName) {
    if (line !== '') {
        try {
            const audio = await convertTextToAudio(line, selected_voice);
            if (audio) {
                console.log('processRequest::' + line);
                io.emit(`${userName}`, { audio });
            }
        } catch (error) {
            // Handle the error appropriately
        }
    }
}

app.use((req, res, next) => {
    //res.header('Access-Control-Allow-Origin', `http://localhost:3000`);
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    next();
});

app.get('/', (req, res) => {
    const filePath = path.join(buildFolder, 'index.html');
    res.sendFile(filePath);
});

app.get('/config', (req, res) => {
    console.log('Received request for config');
    const voices = config.voices_dict;
    const languages = config.languages_dict;
    console.log('Sending response data:', { voices, languages });
    res.json({ voices, languages });
});

app.use((err, req, res, next) => {
    console.log('An exception occurred:', err);
    res.status(500).json({ error: err.toString() });
});

app.use(express.json());

let textBuffer = '';
let linesBuffer = [];

const handleTextAudioStream = async (parsedLine, userName, selected_voice, stream) => {
    const line = JSON.parse(parsedLine);
    const { message, status } = line;

    const messageData = message? message: '';
    textBuffer = textBuffer ? textBuffer + messageData : messageData;

    
    const AIResponseObj = {
        content: message ? message : '',
        finished: status == "finish",
    };
    // Emit the content to connected sockets
    if (stream) {
        io.emit(`${userName}`, AIResponseObj);
    }

    if (/[.!?]$/.test(messageData.trim())) {
        console.log('inside buffer::'+textBuffer)
        linesBuffer.push(textBuffer);
        const TTS = textBuffer;
        textBuffer = '';
        queue.add(() => processRequest(TTS, selected_voice, userName));
    }
    return message ? message : '';
}
let messagesTemp = "";
let selectedVoice = "";
let user = "";

app.post('/chat', async (req, res) => {
    try {
        const { user_input, selected_voice, selected_language, userName, stream } = req.body;
        selectedVoice = selected_voice;
        
        user = userName;
        const sanitizedUserInput = encodeURIComponent(user_input);
        const sanitizedLanguageString = encodeURIComponent(selected_language);
        const user_input_with_language = `${sanitizedUserInput} ${sanitizedLanguageString}`;

        const response = await generateText(user_input_with_language);

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        messagesTemp = "";
        linesBuffer = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log("Stream finished.");
              break;
            }

            // Message and parse the chunk of data
            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");
            const eventsRegex = /event: (start|progress|finish)/;

            const parsedLines = lines
                .map((line) => line.replace(/^data: /, "").trim()) // Remove the "data: " prefix
                .filter((line) => line !== "" && !eventsRegex.test(line)) // Remove empty lines and "[DONE]"

            for (const parsedLine of parsedLines) {
                try {
                    const message = handleTextAudioStream(parsedLine, userName, selected_voice, stream);
                    messagesTemp += message;
                } catch (err) {
                    console.error("Error parsing JSON:", err);
                    // Log the problematic data for further investigation
                    console.log("Problematic JSON:", parsedLine);
                }
            }
        }
        res.json({ text: messagesTemp });
    } catch (error) {
        console.log('An exception occurred:', error);
        res.status(500).json({ error: error.toString() });
    }
});

const server = http.createServer(app);

const io = new Server(server, {
  path: "/chat-ws",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: [],
    credentials: false,
    autoConnect: true,
  },
});

io.on("connection", (socket) => {
    console.log("A client connected.");
    // Handle client disconnection
    socket.on("disconnect", () => {
      console.log("A client disconnected.");
    });
    socket.on("connect_error", (err) => {
       console.log(`connect_error due to ${err.message}`);
    });
});


server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});