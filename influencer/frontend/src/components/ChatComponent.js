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
  const [selectedIdPair, setSelectedIdPair] = useState({});
  const [idPairs, setIdPairs] = useState([]); // State to hold the list of ID pairs
  const serverBaseUrl = 'http://3.35.238.210:5000';


  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching config data from server...');
        const response = await fetch(`${serverBaseUrl}/config`);
        if (response.ok) {
          const data = await response.json();
          const voiceEntries = Object.entries(data.voices).map(([label, value]) => ({ label, value }));
          const languageEntries = Object.entries(data.languages).map(([label, value]) => ({ label, value }));
          const idPairEntries = Object.entries(data.id_pairs).map(([label, ids]) => ({
            label,
            value: ids, // Here ids is an object { ID1: "xxx", ID2: "yyy" }
          }));
          setIdPairs(idPairEntries);
          setVoices(voiceEntries);
          setLanguages(languageEntries);
          if (idPairEntries.length > 0) {
            setSelectedIdPair(idPairEntries[0].value);
          }

          
          // Set default selected values
          if (idPairEntries.length > 0) {
            setSelectedIdPair(idPairEntries[0].value);
          }
          
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
  
    setIsSending(true);
  
    setChatMessages(prevMessages => [
      ...prevMessages,
      { type: 'user', name: userName, text: userInput }
    ]);
  
    setUserInput('');
  
    try {
      const combinedInput = `${selectedLanguage}:${userInput}`;
      
      // Make sure actualSelectedPair is defined from selectedIdPair state
      const actualSelectedPair = selectedIdPair;
    
      // Check that actualSelectedPair has the required properties
      if (!actualSelectedPair || !actualSelectedPair.ID1 || !actualSelectedPair.ID2) {
        console.error('Selected ID pair is invalid:', actualSelectedPair);
        return;
      }

      const requestBody = {
        user_input: combinedInput,
        selected_voice: selectedVoice,
        selected_language: selectedLanguage,
        selected_id_pair_key: {
          ID1: actualSelectedPair.ID1,
          ID2: actualSelectedPair.ID2,
        },
      };

      const response = await fetch(`${serverBaseUrl}/chat`, {
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
  const handleIdPairChange = (e) => {
    const selectedLabel = e.target.value;
    const selectedPair = idPairs.find(pair => pair.label === selectedLabel);
    setSelectedIdPair(selectedPair ? selectedPair.value : null);
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
      <select id="idPairs" value={selectedIdPair ? selectedIdPair.label : ''} onChange={handleIdPairChange}>
        {idPairs.map((pair, index) => (
          <option key={index} value={pair.label}>
            {pair.label}
          </option>
        ))}
      </select>
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
