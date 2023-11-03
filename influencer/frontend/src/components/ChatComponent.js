import React, { useState, useEffect } from 'react';
import './ChatComponent.css'; // Assume you have a CSS file for styles

const ChatComponent = () => {
  const [userInput, setUserInput] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [voices, setVoices] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [isSending, setIsSending] = useState(false);


  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching config data from server...');
        const response = await fetch('http://127.0.0.1:5000/config');
        if (response.ok) {
          const data = await response.json();
          const voiceEntries = Object.entries(data.voices).map(([label, value]) => ({ label, value }));
          const languageEntries = Object.entries(data.languages).map(([label, value]) => ({ label, value }));
  
          setVoices(voiceEntries);
          setLanguages(languageEntries);
  
          // Set default selected values
          if (voiceEntries.length > 0) {
            setSelectedVoice(voiceEntries[0].value);
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
  
    fetchData();
  }, []);
  
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    console.log('Voices:', voices);
    console.log('Languages:', languages);
  }, [voices, languages]);

  const getVoiceLabel = (voiceValue) => {
    const voice = voices.find(v => v.value === voiceValue);
    return voice ? voice.label : 'Bot';
  };
  
  const sendMessage = async () => {
    if (!userInput.trim()) {
      console.log('No input to send');
      return;
    }
  
    setIsSending(true); //
  
    // Add user's message to state
    setChatMessages(prevMessages => [
      ...prevMessages,
      { type: 'user', name: userName, text: userInput }
    ]);
  
    // Clear the user input right away
    setUserInput('');
  
    try {
      const combinedInput = `${selectedLanguage}:${userInput}`;
    
      const requestBody = {
        user_input: combinedInput,
        selected_voice: selectedVoice,
        selected_language: selectedLanguage,
      };
      
      const response = await fetch('http://127.0.0.1:5000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
  
      if (response.ok) {
        const responseData = await response.json();
        
        // Update chatMessages state with the bot's message
        setChatMessages(prevMessages => [
          ...prevMessages,
          { type: 'bot', text: responseData.text },
        ]);
        
        // Play the audio (if needed)
        const audio = new Audio('data:audio/mpeg;base64,' + responseData.audio);
        audio.play();
      } else {
        console.error('Failed to send message to the server:', response.statusText);
      }
    } catch (error) {
      console.error('An error occurred:', error);
    } finally {
      setIsSending(false); // Re-enable the send button whether there was an error or not
    }
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
        <select id="languages" value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)}>
          {languages.map((language, index) => (
            <option key={index} value={language.value}>
              {language.label}
            </option>
          ))}
        </select>
      </div>
      <div className="chat-messages">
        {chatMessages.map((msg, index) => (
          <div key={index} className={`message ${msg.type}`}>
            <span className="message-name">
              {msg.type === 'user' ? `${userName}:` : `${getVoiceLabel(selectedVoice)}:`}
            </span>
            <span className="message-text">{msg.text}</span>
          </div>
        ))}
      </div>
      <div className="chat-input">
      <textarea
     value={userInput}
     onChange={(e) => setUserInput(e.target.value)}
     disabled={isSending}
     onKeyDown={(e) => {
       if (e.key === 'Enter' && !e.shiftKey) {
         e.preventDefault();
         sendMessage();
       }
     }}
     placeholder="Type your message here..."
  />
  <button onClick={sendMessage} disabled={!userInput.trim() || isSending}>
    Send
  </button>
      </div>
    </div>
  );
};

export default ChatComponent;
