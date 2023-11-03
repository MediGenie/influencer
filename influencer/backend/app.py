from flask import Flask, request, jsonify, send_from_directory
import json
import requests
import base64
import os
from flask_cors import CORS
import traceback


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

# Configuration settings moved to a separate file (config.json)
with open("config.json", encoding='utf-8') as f:
    config = json.load(f)

app.config.update(config)

# Define the path to the React app's build folder
build_folder = os.path.join(os.path.dirname(__file__), 'frontend', 'build')

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
    params = {"optimize_streaming_latency": 1}
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
    params = {"optimize_streaming_latency": 1}
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
    
    try:
        response = requests.post(url, headers=headers, params=params, data=json.dumps(data))
        response.raise_for_status()  # This will raise an exception for HTTP errors
        return response.content
    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")  # HTTP error
    except requests.exceptions.ConnectionError as conn_err:
        print(f"Connection error occurred: {conn_err}")  # Connection error
    except requests.exceptions.Timeout as timeout:
        print(f"Timeout occurred: {timeout}")  # Timeout error
    except requests.exceptions.RequestException as err:
        print(f"An error occurred: {err}")  # Other errors
    return None

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(build_folder, path)):
        return send_from_directory(build_folder, path)
    else:
        return send_from_directory(build_folder, 'index.html')

@app.route('/config')
def get_config():
    print("Received request for config")
    voices = config['voices_dict']
    languages = config['languages_dict']
    print("Sending response data:", {'voices': voices, 'languages': languages})
    return jsonify({'voices': voices, 'languages': languages})


@app.errorhandler(Exception)
def handle_exception(e):
    print("An exception occurred:", e)
    traceback.print_exc()
    return jsonify({'error': str(e)}), 500

# New route for handling chat interactions (POST requests from React)
@app.route('/chat', methods=['POST'])
def chat():
    data = request.json  # Get the JSON data from the request

    user_input = data['user_input']
    selected_voice = data['selected_voice']
    selected_language = data['selected_language']

    # Get the language string from the dictionary, default to empty string if not found
    language_string = config['languages_dict'].get(selected_language, "")
    user_input_with_language = f"{user_input} {language_string}"

    text = generate_text(user_input_with_language)
    audio = generate_audio(text, selected_voice)

    # Check if audio is not None before encoding
    if audio is not None:
        audio_base64 = base64.b64encode(audio).decode('utf-8')
    else:
        audio_base64 = None

    response = {
        'text': text,
        'audio': audio_base64
    }

    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True)