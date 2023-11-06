import fs from 'fs';
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Function to convert text to audio using ElevenLabs API
export const convertTextToAudio = async (textToConvert, voiceId) => {
  // Set the API key for ElevenLabs API
  const apiKey = config.API_KEY_AUDIO;

  const data = {
    text: textToConvert,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
        stability: 0.7,
        similarity_boost: 0.7,
        Use_speaker_boost: true,
    },
  };

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accept': 'audio/mpeg',
      'xi-api-key': apiKey
    },
    body: JSON.stringify(data),
  });

  if (response.ok) {
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = btoa(new Uint8Array(audioBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    return audioBase64;
  } else {
    return null;
  }

};