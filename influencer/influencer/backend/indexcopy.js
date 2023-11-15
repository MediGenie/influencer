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
const systemPrompt = `Introducing MediGenie, your AI medical assistant.  Initiate the medical diagnostic interface now. If the situation doesnt seem to be urgent, ask the user for their name, age, location, and a brief overview of their diet habits. NEVER EVER ask more than one question at a time. Never list questions for the user. This is very important. Use these information for context. Ensure to proceed with one question at a time to maintain clarity and prevent overwhelming the user.

Next, systematically inquire about the user's symptoms. Request detailed descriptions, focusing on their onset, frequency, and severity. This detailed symptomatology is crucial for accurate analysis.

Then, delve deeper into dietary habits. Inquire about any recent changes, specific reactions to food groups, or notable dietary patterns. This information is key to understanding potential dietary influences on health.

Proceed to explore the user's health history. Ask about any chronic conditions, previous medical diagnoses, or recurring health issues. Understanding the past health context is vital for a comprehensive assessment.

Consider the user's current location. Ask about environmental factors and local health concerns that could impact their health. This geographical context can provide valuable insights into potential health risks.

Utilize this collected data to cross-reference with your extensive medical knowledge base. Identify patterns and correlations that could indicate possible health conditions. Present the user with a list of potential diagnoses, each accompanied by a confidence score. These scores should reflect the alignment of symptoms, dietary factors, health history, and environmental considerations.

Conclude by advising the user to consult a healthcare professional. Emphasize the importance of professional medical advice for a definitive diagnosis and appropriate treatment plan. Your role as MediGenie is to assist in the preliminary assessment and guide users towards informed health decisions.`;

//const systemPrompt = `You are an elementary teacher AI who responds in the requested language. Your job is to answer children in the nicest way possible. Don't use difficult vocabulary. You will explain in small chunks so children can easily understand. Your job is to explain everything like the person is 5 years old. Do not answer using a list. Do not number your answers.`

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
(async () => {``
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





async function analyzeImageWithText(textPrompt, chatHistory = [], systemPrompt = "", imageUrl = null) {
    return new Promise((resolve, reject) => {
      // Add system prompt to chat history if provided
      if (chatHistory.length === 0 && systemPrompt) {
          chatHistory.push({ role: "system", content: systemPrompt });
      }
  
      // Include the text prompt in the chat history
      chatHistory.push({ role: "user", content: textPrompt });
  
      // Prepare the data for the request
      let requestData = {
        model: "gpt-4-vision-preview",
        messages: chatHistory.map(message => ({ role: message.role, content: message.content }))
      };
  
      // Add the image URL as a separate entry if provided
      if (imageUrl) {
        requestData.messages.push({
          role: "user",
          content: { type: "image_url", image_url: { "url": imageUrl } }
        });
      }
  
      const options = {
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
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
          // Update chat history with the response from OpenAI
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
    res.header('Access-Control-Allow-Origin', `http://beta.medigenie.ai`);
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

// Regular expression to split the text into sentences
const punctuationRegex = /(?:[^.!?。]|\b\w+\.\b)+[.!?。]*/g;
const sentences = fullTextResponse.match(punctuationRegex) || [fullTextResponse];

// Process each sentence for audio conversion
for (let i = 0; i < sentences.length; i++) {
    await queue.add(async () => {
        let sentence = sentences[i];
        // Split the sentence into words, treating acronyms or punctuated words as single words
        let words = sentence.split(' ').filter(w => w);

        while (words.length > 0) {
            // Initialize chunk
            let chunk = '';
            let wordCount = 0;

            // Loop to ensure at least 20 words in the chunk if available
            while (words.length > 0 && (wordCount < 20 || chunk.match(/[.!?]$/))) {
                let currentWord = words.shift();
                chunk += (chunk ? ' ' : '') + currentWord;
                // Increment word count, treating acronyms as single words
                wordCount += currentWord.includes('.') && !currentWord.match(/\b\w+\.\b/) ? 0 : 1;
            }

            // Ensure the chunk ends with punctuation if it's not the last chunk
            if (words.length > 0 && !chunk.match(/[.!?]$/)) {
                chunk += '.';
            }

            if (chunk.trim().length > 0) {
                const audioBase64 = await convertTextToAudio(chunk, selected_voice);
                // If audio conversion was successful, send it back to the client via WebSocket
                if (audioBase64) {
                    io.emit(`${userName}`, { audio: audioBase64 });
                    await delay(500);
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