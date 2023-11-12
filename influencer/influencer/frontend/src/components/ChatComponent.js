import React, { useState, useEffect, useRef } from 'react';
import './ChatComponent.css'; // Assume you have a CSS file for styles
import { io } from 'socket.io-client';

const ChatComponent = () => {
  const [userInput, setUserInput] = useState('');
  const [disableSend, setDisableSend] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [voices, setVoices] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [msgId, setMsgId] = useState(0);
  const audioPlayerRef = useRef(null);
  const voiceRef = useRef(null);
  const [userName, setUserName] = useState('User');
  const [audioQueue, setAudiQueue] = useState([])
  audioPlayerRef.current = new Audio()

  const ref = useRef(null);
  ref.current = msgId;

  useEffect(() => {
    setAudiQueue([])
    fetchData();

    const socket = io('http://3.38.153.110:5000', {
      path: '/chat-ws',
      transports: ['websocket'],
      autoConnect: true,
    });
    socket.on('connect', () => {
      console.log('connected');
    });
    socket.on('error', error => {
      console.log('error', error);
    });
    socket.on(`${userName}`, handleIncomingMessage);

    return () => {
      socket.off(`${userName}`, handleIncomingMessage);
      socket.disconnect();
    };
  }, []);

  const fetchData = async () => {
    try {
      console.log('Fetching config data from server...');
      const response = await fetch('http://3.38.153.110:5000/config');
      if (response.ok) {
        const data = await response.json();
        const voiceEntries = Object.entries(data.voices).map(([label, value]) => ({ label, value }));
        const languageEntries = Object.entries(data.languages).map(([label, value]) => ({ label, value }));

        setVoices(voiceEntries);
        setLanguages(languageEntries);

        // Set default selected values
        if (voiceEntries.length > 0) {
          setSelectedVoice(voiceEntries[0].value);
          voiceRef.current = voiceEntries[0].value;
        }
        if (languageEntries.length > 0) {
          setSelectedLanguage(languageEntries[0].value);
        }
      } else {
        console.error('Failed to fetch data from the server:', response.statusText);
      }
    } catch (error) {
      console.error('An error occurred while fetching data:', error);
    }
  };

  const handleIncomingAudio = async (data) => {
      if (data) {
        setAudiQueue((prevAudioQueue) => {
          // Create a new copy of the array with the updated data
          const updatedItems = [...prevAudioQueue, data];
          return updatedItems;
        });
      }
  }

  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying && audioQueue.length > 0) {
      const nextAudio = audioQueue[0];
      playAudio(nextAudio.audioData); // Only play audio, do not set text here
      setAudiQueue(prevQueue => prevQueue.slice(1)); // Remove the played audio from the queue
    }
  }, [audioQueue, isPlaying]);

  const playAudio = (base64Data) => {
    setIsPlaying(true);

    // Play the audio
    const audio = new Audio('data:audio/mpeg;base64,' + base64Data);
    audio.onended = () => setIsPlaying(false);
    audioPlayerRef.current = audio;
    audioPlayerRef.current.play();
  };


  const chatContainerRef = useRef(null);

  useEffect(() => {
    // Scroll to the bottom of the chat container whenever chatMessages change
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [chatMessages]);


  useEffect(() => {
    console.log('Voices:', voices);
    console.log('Languages:', languages);
  }, [voices, languages]);

  const sendMessage = async () => {
    if (!userInput.trim()) {
      console.log('No input to send');
      return;
    }
    setDisableSend(true);
    setMsgId(prev => prev + 1);

    try {
      // Combine user input with language code if necessary
      // For example, 'en:Hello' if English is selected.
      const combinedInput = `${selectedLanguage}:${userInput}`;
      setChatMessages(previousMessages =>
        previousMessages.concat({ type: 'user', name: userName, text: userInput })
      );
      setUserInput('');
      const shouldStream = true;
      // Prepare the request body by including the combined input
      const requestBody = {
        user_input: combinedInput,
        selected_voice: selectedVoice,
        selected_language: selectedLanguage, // You might not need to send this separately now
        userName: userName, // we send this for socket connection
        stream: shouldStream,
      };

      const response = await fetch('http://3.38.153.110:5000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      setDisableSend(false);

      if (response.ok) {
        const responseData = await response.json();
        console.log('Response data from POST /chat:', responseData);
        console.log('stream finished.');
        if (!shouldStream) {
          setChatMessages(prevMessages => [
            { type: 'user', name: userName, text: userInput },
            { type: 'bot', text: responseData.text },
          ]);
        }
      } else {
        console.error('Failed to send message to the server:', response.statusText);
      }
    } catch (error) {
      setDisableSend(false);
      console.error('An error occurred:', error);
    }

    // Clear the user input after sending the message
    setUserInput('');
  };

  const handleIncomingMessage = (data) => {
    console.log('Incoming message data:', data);
    // If there's audio data, add it to the audioQueue state
    if (data.audio) {
      setAudiQueue(prevAudioQueue => [...prevAudioQueue, { audioData: data.audio }]);
    }

    console.log('handleIncomingMessage::' + JSON.stringify(data));

    setChatMessages((prevMessages) => {
      console.log('Previous messages:', prevMessages);
      // Find if the incoming message is a continuation of the last bot message
      const lastMessage = prevMessages[prevMessages.length - 1];
      let updatedMessages = prevMessages.slice(); // Create a copy of the previous messages

      if (lastMessage && lastMessage.type === 'bot' && lastMessage._id === data._id) {
          // Update the last bot message text
          lastMessage.text += data.text;
          console.log(chatMessages);
          // Update the copy of the messages with the modified last message
          updatedMessages[prevMessages.length - 1] = lastMessage;
      } else {
          // Add a new bot message
          console.log('Updated messages:', prevMessages);
          // Add the new message to the copy of messages
          updatedMessages.push(data);
      }

      return updatedMessages; // Return the copy of the messages with the applied changes
  });
};


  const handleLanguageChange = (e) => {
    console.log('Language selected:', e.target.value);
    setSelectedLanguage(e.target.value);
  };

  useEffect(() => {
    console.log('Selected language state updated to:', selectedLanguage);
  }, [selectedLanguage]);

  return (
    <div className="chat-container">
      <div className="chat-config">
        <select id="voices" value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}>
          {voices.map((voice, index) => (
            <option key={index} value={voice.value}>
              {voice.label}
            </option>
          ))}
        </select>
        <select id="languages" value={selectedLanguage} onChange={handleLanguageChange}>
  {languages.map((language, index) => (
    <option key={index} value={language.value}>
      {language.label}
    </option>
  ))}
</select>
      </div>
      <div className="chat-messages" ref={chatContainerRef}>
        {chatMessages.map((msg, index) => (
          msg.text && (
            <div key={index} className={`message ${msg.type}`}>
              <span className="message-name">{msg.type === 'user' ? userName : 'Bot'}</span>
              <span className="message-text">{msg.text}</span>
            </div>
          )
        ))}
      </div>
      <div className="chat-input">
      <textarea
  value={userInput}
  onChange={(e) => setUserInput(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disableSend) {
        sendMessage();
      }
    }
  }}
  disabled={disableSend}
  placeholder="Type your message here..."
/>
<button onClick={sendMessage} disabled={!userInput.trim() || disableSend}>
  Send
</button>
      </div>
    </div>
  );
};

export default ChatComponent;