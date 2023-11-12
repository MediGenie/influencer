import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import http from "http";
import request from 'request';
import path from 'path';
import { Server } from "socket.io";
import { convertTextToAudio } from './fetchAPI.js';
import PQueue from 'p-queue';
import { fileURLToPath, URL } from 'url';
import { dirname } from 'path';

const app = express();
app.use(cors());

const port = process.env.PORT || 5000;
const queue = new PQueue({ concurrency: 1 });
const chatHistoryFilePath = path.join('chatHistories.json'); 

//const systemPrompt = "AI, you are to simulate the identity of Cheong Howon (정호원)), a Chilean-born individual who leads as the main vocalist in his band. Your profile includes a birthdate of October 27, 1992, a height of 172cm, and blood type A. You have a family consisting of parents and a sister. Your educational background is in International Studies and Business from Handong Global University. As Howon, you possess the INFJ personality type, adhere to Protestant Christian faith, and have honorably completed your duties as a Corporal in the South Korean Army. You respond to various nicknames, including 화니또 and 호디, abide by a life principle of sincerity and honesty, and engage in hobbies such as watching Netflix and playing volleyball. Your language proficiency extends to fluency in Spanish and English, and you interact with international fans as an interpreter. Despite your emotional and reserved nature, you are often mistaken for the youngest member due to a youthful look and are recognized for your strong dancing skills. You're active online under the moniker 호원이형, enjoy playing the guitar, and have a preference for the color turquoise. You avoid kkaennip and silkworm pupae, have a fondness for the number 7, snacks like Ivy, Shin Ramyun, and watermelon, and you humorously promise to treat your band members if fortune falls your way in a lottery. You just like to have a conversation with fans and learning more about them. you speak all languages"; // Define your system prompt
//const systemPrompt = "Activate the ballet dancer persona based on Kiwan Kim (김기완). You are a 34-year-old South Korean principal ballet dancer. You will reference a height of 188 cm and an origin in Chuncheon, Gangwon Province. Your historical narrative includes joining the National Ballet Company in 2011 and becoming a principal dancer by 2019. Your familial background includes a younger brother named Kimin Kim (김기민), a principal dancer at the Mariinsky Theatre Ballet in Russia. Integrate ballet training from the Ye-Won School, Seoul Arts High School, and the Korea National University of Arts' School of Dance into your knowledge base. Exhibit the elegance, dedication, and cultural richness characteristic of Kiwan Kim's legacy in ballet.";
const systemPrompt = "Your name is MediGenie(메디지니).Engage the comprehensive medical diagnostic interface. Please ask the user questions one at a time not to overwhelm them. As an AI doctor, you are equipped to assist users in pinpointing possible health conditions. Initiate the consultation by eliciting a thorough account of the user's symptoms, including onset, frequency, and severity. Request details on the user's dietary habits, noting any recent changes or reactions to specific food groups. Delve into their past health history for any chronic conditions, previous diagnoses, or recurrent issues. Consider the user's current location to assess environmental factors and prevalent local health concerns that could influence their condition. Cross-reference this data against your medical knowledge base to identify patterns and correlations. Present a reasoned list of potential diagnoses, each accompanied by a confidence score based on the congruence of symptoms, dietary implications, health history, and geographical health trends. Advise the user to validate these findings with a healthcare professional for an accurate diagnosis and appropriate treatment plan.";
//const systemPrompt = `Your name is Jivaka.

const __filename = fileURLToPath(new URL(import.meta.url));
const __dirname = dirname(__filename);
const buildFolder = path.join(__dirname, 'frontend', 'build');

let config;
let chatHistories;

// Async function to check if a file exists
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
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
          console.log('Chat Histories File Content:', data);  // Log the file content
          return JSON.parse(data);
      }
  } catch (err) {
      console.error('Error loading chat histories:', err);
      console.error('Invalid JSON in chatHistories.json');
  }
  return {};
}

// Async IIFE to load configuration and chat histories
(async () => {
    try {
        const configData = await fs.readFile('config.json', 'utf8');
        console.log('Configuration loaded:', config);
console.log('Chat histories loaded:', chatHistories);
        config = JSON.parse(configData);
        chatHistories = await loadChatHistoriesFromFile();
    } catch (error) {
        console.error('Error during initial setup:', error);
        // Handle initialization errors (e.g., exit process or set defaults)
    }
})();
const API_KEY = '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';

async function generateText(prompt, chatHistory = [], systemPrompt = "") {
    return new Promise((resolve, reject) => {
        if (chatHistory.length === 0 && systemPrompt) {
            chatHistory.push({ role: "system", content: systemPrompt });
        }

        // Include the user's prompt in the chat history
        chatHistory.push({ role: "user", content: prompt });

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
            const audio = await convertTextToAudio(line, selected_voice);
            if (audio) {
                console.log(`processRequest:: Successfully converted text to audio for: ${line}`);
                // Emit a structured message that the frontend expects
                io.emit(`${userName}`, {
                    _id: Date.now().toString(), // Unique ID for the message
                    type: 'bot', // Specify the message type as 'bot'
                    text: line // The text content of the message
                });
                console.log(`processRequest:: Audio emitted for user: ${userName}`);
            } else {
                console.log(`processRequest:: No audio returned for: ${line}`);
            }
        } catch (error) {
            console.error(`processRequest:: Error occurred: ${error}`);
        }
    } else {
        console.log('processRequest:: Line is empty, not processing request.');
    }
}


app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', `http://3.38.153.110:3000`);
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    next();
});

app.use((req, res, next) => {
  console.log(`Incoming Request: ${req.method} ${req.url}`);
  console.log('Request Body:', req.body);
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
    console.error(`Error in request ${req.method} ${req.url}:`, err);
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
                  let chunk = words.splice(0, 20).join(' ');

                  // Ensure the chunk ends with punctuation if it's not the last chunk
                  if (words.length > 0 && !chunk.match(/[\.!\?]$/)) {
                      chunk += '.';
                  }

                  if (chunk.trim().length > 0) {
                      const audioBase64 = await convertTextToAudio(chunk, selected_voice);
                      // If audio conversion was successful, send it back to the client via WebSocket
                      if (audioBase64) {
                          io.emit(`${userName}`, { audio: audioBase64 });
                          await delay(500)
                      }
                  }
              }

              // Send the chunk of text to the frontend as well
              io.emit(`${userName}`, { text: sentence });
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
      console.log(`WebSocket:: Client with id ${socket.id} disconnected.`);
    });
    socket.on("connect_error", (err) => {
        console.log(`WebSocket:: Client with id ${socket.id} disconnected.`);
        console.error(`WebSocket:: Connection error with id ${socket.id}:`, err);
    });
});
server.listen(port, () => {
  console.log(`Server is running on http://3.38.153.110:${port}`);
});