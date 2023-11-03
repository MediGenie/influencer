from flask import Flask, request, jsonify, render_template
import json
import requests
import base64

with open("config.json") as f:
    config = json.load(f)
app = Flask(__name__)
app.config.update(config)

API_URL_TEXT = config['API_URL_TEXT']
API_KEY_TEXT = config['API_KEY_TEXT']
API_URL_AUDIO = config['API_URL_AUDIO']
API_KEY_AUDIO = config['API_KEY_AUDIO']
voices_dict = config['voices_dict']
languages_dict = config['languages_dict']
loading_messages_dict = config['loading_messages_dict']

def generate_text(prompt, chat_history=None):
    headers = {
        "accept": "audio/mpeg;charset=UTF-8",
        "authorization": app.config['API_KEY_TEXT'],
        "Content-Type": "application/json",
    }
    params = {"optimize_streaming_latency": 2}
    data = {
        "prompt": prompt,
        "chatbot_model": "gpt-3.5-turbo",
    }
    response = requests.post(app.config['API_URL_TEXT'], headers=headers, params=params, data=json.dumps(data))
    if response.status_code == 200:
        return response.json()["data"]["openai_response"]
    else:
        print(f"Error: {response.status_code}")
        print(response.text)

def generate_audio(text, voice_id):
    url = f"{app.config['API_URL_AUDIO']}{voice_id}"
    headers = {
        "accept": "audio/mpeg;charset=UTF-8",
        "xi-api-key": app.config['API_KEY_AUDIO'],
        "Content-Type": "application/json",
    }
    params = {"optimize_streaming_latency": 3}
    data = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.7,
            "similarity_boost": 0.7,
            "Use_speaker_boost": True,
            "voice_id": voice_id,
        },
    }
    response = requests.post(url, headers=headers, params=params, data=json.dumps(data))
    if response.status_code == 200:
        return response.content
    else:
        print(f"Error: {response.status_code}")
        print(response.text)

@app.route('/')
def index():
    return render_template('index.html', voices=voices_dict, languages=languages_dict, loading_messages_dict=loading_messages_dict)

@app.route('/chat', methods=['POST'])
def chat():
    user_input = request.json['user_input']
    selected_voice = request.json['selected_voice']
    selected_language = request.json['selected_language']

    # Get the language string from the dictionary, default to empty string if not found
    language_string = config['languages_dict'].get(selected_language, "")
    user_input_with_language = f"{user_input} {language_string}"

    text = generate_text(user_input_with_language)
    audio = generate_audio(text, selected_voice)

    # Encode the audio data as a base64 string
    audio_base64 = base64.b64encode(audio).decode('utf-8')

    response = {
        'text': text,
        'audio': audio_base64
    }

    return jsonify(response)


if __name__ == '__main__':
    app.run(debug=True)
