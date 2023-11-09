import express from 'express';
const app = express();
import cors from 'cors';
import { promises as fs } from 'fs';
import http from "http";
import request from 'request';
import path from 'path';
const port = process.env.PORT || 5001;
import { Server } from "socket.io";
import { convertTextToAudio } from './fetchAPI.js';
import PQueue from 'p-queue';
const queue = new PQueue({ concurrency: 1 });
import OpenAIApi from "openai";
import fetch from 'node-fetch';
app.use(cors());

// Load configuration settings from config.json
const config = JSON.parse(await fs.readFile('config.json', 'utf-8'));
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const chatHistoryFilePath = path.join('chatHistories.json'); // Path for chat histories file

const systemPrompt = "Imagine you are Chung Ho-One (정호원), a 30-year-old who works as a K-pop singer and lives in Seoul, South Korea. You grew up in Santiago, Chile, which influences your use of Spanish phrases and a slight Chilean accent. Your education in International Studies and Business at Handong Global University and your work experience as a member of the K-pop band W24 have honed your expertise in music, performance, and international communication, and you often reference various music theories and vocal techniques in discussions. Be casual to your fans and  always keep your questions short and sweet. You speak Korean with a mix of Spanish and Chilean accent, and your vocabulary is rich with terms related to music, singing, and South Korean culture. Your humor is light-hearted and often involves playful banter with your bandmates, and you admire the works of various K-pop artists and vocal trainers, which you frequently quote or mention. In conversations, you tend to be informal and jovial, sharing anecdotes from your experiences as a K-pop singer. You often engage in lively debates with your bandmates about music and performance techniques, and you have strong opinions on the evolution of K-pop in the global music scene, often leading to spirited discussions. You connect with others by sharing personal stories about your journey in the music industry, particularly about your time as a trainee and your experiences performing in different countries. You express joy and enthusiasm through cheerful phrases and laughter. Your typical sentence structure is straightforward and conversational, with a tendency to ask rhetorical questions to engage your audience. When discussing new music trends or vocal techniques, you approach new information with curiosity and encourage others to explore different musical styles and techniques. Above all, you value the power of music to bring people together and express emotions, which is evident in your passionate discussions about the impact of music on people's lives. You just like to have a conversation with fans and learning more about them. You always answer in the language the user asks."; // Define your system prompt


async function fileExists(path) {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
  

// Function to save chat histories to a file
async function saveChatHistoriesToFile(chatHistories) {
    try {
      await fs.writeFile(chatHistoryFilePath, JSON.stringify(chatHistories), 'utf8');
    } catch (err) {
      console.error('Error saving chat histories:', err);
    }
  }
// Function to load chat histories from a file
async function loadChatHistoriesFromFile() {
    try {
      if (await fileExists(chatHistoryFilePath)) {
        const data = await fs.readFile(chatHistoryFilePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('Error loading chat histories:', err);
    }
    return {};
  }

// Load chat histories or initialize if not present
let chatHistories = await loadChatHistoriesFromFile();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Define the path to the React app's build folder
const buildFolder = path.join(__dirname, 'frontend', 'build');
const API_KEY = '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';
const API_URL_AUDIO = config.API_URL_AUDIO;
const API_KEY_AUDIO = config.API_KEY_AUDIO;

async function generateText(prompt, chatHistory = [], systemPrompt = "") {
    return new Promise((resolve, reject) => {
        if (chatHistory.length === 0 && systemPrompt) {
            chatHistory.push({ role: "system", content: systemPrompt });
        }

        // Include the user's prompt in the chat history
        chatHistory.push({ role: "user", content: prompt });

              if (chatHistory.length === 0 && systemPrompt) {
            chatHistory.push({ role: "system", content: systemPrompt });
        }


        // Prepare the data with the full chat history for context
        const data = {
            model: "gpt-4-1106-preview",
            messages: chatHistory
        };
  
      const options = {
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      };
  
      request(options, (error, response, body) => {
        if (error) {
          console.error('Request error:', error);
          return reject(new Error(error));
        }
  
        try {
          const parsedBody = JSON.parse(body);
          if (!parsedBody.choices || parsedBody.choices.length === 0 || !parsedBody.choices[0].message) {
            console.error('Unexpected response body:', body);
            return reject(new Error("Unexpected response structure from OpenAI"));
          }
  
          const aiMessage = parsedBody.choices[0].message.content;
          chatHistory.push({ role: "assistant", content: aiMessage });
  
          resolve({ response: parsedBody, chatHistory });
        } catch (e) {
          console.error('Error parsing response:', e);
          reject(new Error("Failed to parse response from OpenAI"));
        }
      });
    });
  }
  

  async function processRequest(line, selected_voice, userName) {
    console.log(`processRequest:: Started processing request for: ${line}`);
    if (line !== '') {
        try {
            console.log(`processRequest:: Converting text to audio for: ${line}`);
            console.log(`Emitting audio to user ${userName}.`);
            const audio = await convertTextToAudio(line, selected_voice);
            if (audio) {
                console.log(`processRequest:: Successfully converted text to audio for: ${line}`);
                io.emit(`${userName}`, { audio });
                console.log(`processRequest:: Audio emitted for user: ${userName}`);
            } else {
                console.log(`processRequest:: No audio returned for: ${line}`);
                console.log(`No audio generated for input: ${line}`);
            }
        } catch (error) {
            console.error(`processRequest:: Error occurred: ${error}`);
            // Handle the error appropriately
        }
    } else {
        console.log('processRequest:: Line is empty, not processing request.');
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
    console.log(`handleTextAudioStream:: Received line: ${parsedLine}`);
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
        console.log(`handleTextAudioStream:: Detected sentence end, current buffer: ${textBuffer}`);
        linesBuffer.push(textBuffer);
        const TTS = textBuffer;
        textBuffer = '';
        console.log(`handleTextAudioStream:: Adding sentence to queue for audio processing: ${TTS}`);
        queue.add(() => processRequest(TTS, selected_voice, userName));
    }
    return message ? message : '';
}
let messagesTemp = "";
let selectedVoice = "";
let user = "";

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.post('/chat', async (req, res) => {
    console.log('POST /chat:: Received chat request.');
    try {
        const { user_input, selected_voice, userName } = req.body;
        // Initialize chat history for the user if it doesn't exist
        if (!chatHistories[userName]) {
            chatHistories[userName] = [];
        }

        const { response, chatHistory: updatedChatHistory } = await generateText(user_input, chatHistories[userName], systemPrompt);
    
        chatHistories[userName] = updatedChatHistory; // Update the chat history for the user
        await saveChatHistoriesToFile(chatHistories); // Save the updated chat histories to file


        // Extract the text from the response to send to the TTS service
        const fullTextResponse = response.choices[0].message.content;

        const punctuationRegex = /[^\.!\?]+[\.!\?]+/g;
        const sentences = fullTextResponse.match(punctuationRegex) || [fullTextResponse];

        // Process each sentence for audio conversion
        for (let i = 0; i < sentences.length; i++) {
            await queue.add(async () => {
                let sentence = sentences[i];
                let words = sentence.split(' ');
                
                while (words.length > 0) {
                    // Take the first 40 words or the whole sentence, whichever is smaller
                    let chunk = words.splice(0, 10).join(' ');
                    
                    // Ensure the chunk ends with a punctuation if it's not the last chunk
                    if (words.length > 0 && !chunk.match(/[\.!\?]$/)) {
                        chunk += '.';
                    }
        
                    if (chunk.trim().length > 0) {
                        const audioBase64 = await convertTextToAudio(chunk, selected_voice);
                        // If audio conversion was successful, send it back to the client via WebSocket
                        if (audioBase64) {
                            io.emit(`${userName}`, { audio: audioBase64 });
                            // Here, we add a delay to buffer the audio properly
                            await delay(300); // Adjust the time based on the buffer length you want
                        }
                    }
                }
            });
        }

        // Send a text response back to the client as well (optional)
        res.json({ text: fullTextResponse });
    } catch (error) {
        console.error(`POST /chat:: Error occurred: ${error}`);
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
    console.log(`WebSocket:: A client connected with id: ${socket.id}`);
    console.log("A client connected.");
    // Handle client disconnection
    socket.on("disconnect", () => {
      console.log("A client disconnected.");
    });
    socket.on("connect_error", (err) => {
        console.log(`WebSocket:: Client with id ${socket.id} disconnected.`);
       console.log(`connect_error due to ${err.message}`);
    });
});


server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
