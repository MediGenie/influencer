from flask import Flask, request, jsonify, render_template
import json
import requests

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/send_message', methods=['POST'])
def send_message():
    user_input = request.form['user_input']
    selected_voice_name = request.form['selected_voice_name']
    selected_language = request.form['selected_language']

    voices_dict = {
        "정우성": "hjlaVGmIa72yfOAHbXYK",
        "베네딕트": "yX1KxsECsASVwOPQaEYu",
        "최태원": "T1amdp5Eoen3dp2HSdzK",
        "목사님": "duE75Yru8bRUrTejR3Zo",
        "카리나": "OISINXdqIoPsKzjovAY3",
        "지효": "RoZbkOINWj1i329fDdiO",
        "기완": "wK4ruMC51RV2miArFeZV",
        "인근": "jBDKmQMWVDjyq90WikrR",
        "강수진": "9aXCnmR4rc6ln10IZ2tk",
        "병우": "24KRlryrWHcsIlRFPmW9",
        "유경": "5YO0houLS315W8RbeOYA",
    }

    languages_dict = {
    "영어": ". Respond in English",
    "독일어": ". Respond in German",
    "한국어": ". Respond in Korean",
    "프랑스어": ". Respond in French",
    "일본어": ". Respond in Japanese",
        }

    loading_messages_dict = {
        "정우성": "정우성님이 대답중이에요...",
        "베네딕트": "베네딕트가 대답중이에요...",
        "최태원": "최태원 회장님이 대답중이에요...",
        "목사님": "목사님이 대답중이에요...",
        "카리나": "카리나가 대답중이에요...",
        "지효": "지효가 대답중이에요...",
        "기완": "기완이가 대답중이에요...",
        "인근": "인근이가 대답중이에요...",
        "강수진": "강수진 단장님이 대답중이에요...",
        "병우": "병우가 대답중이에요...",
        "유경": "유경이가 대답중이에요...",
    }


    voice_id = voices_dict[selected_voice_name]
    language_string = languages_dict[selected_language]
    user_input_with_language = f"{user_input} {language_string}"

    generated_text = generate_text2(user_input_with_language)
    audio = generate_audio(generated_text, voice_id)
    
    return jsonify({
        'user_input': user_input,
        'bot_response': generated_text,
        'audio': audio
    })

def generate_text2(prompt, chat_history=None):
    url = "https://app.customgpt.ai/api/v1/projects/15869/conversations/313732/messages?stream=false&lang=kr"

    headers = {
        "accept": "audio/mpeg;charset=UTF-8",
        "authorization": "Bearer 2304|K6uDrXla4bcb4YuH0rhbpqpMhZTQKtreOrLRzOPS",
        "Content-Type": "application/json"
    }
    params = {"optimize_streaming_latency": 2 }

    data = {
        "prompt": prompt,
        "chatbot_model": "gpt-3.5-turbo"
    }

    response = requests.post(url, headers=headers, params=params, data=json.dumps(data))

    if response.status_code == 200:
        dict = json.loads(response.text)  # Use json.loads() instead of json.load()
        return dict['data']['openai_response']
    else:
        print(f"Error: {response.status_code}")
        print(response.text)


def generate_audio(text, streaming=True):
    # Use the selected voice ID from the session state
    voice_id = st.session_state.voice_id
    
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    headers = {
        "accept": "audio/mpeg;charset=UTF-8",
        "xi-api-key": "bdb4614d39f712020be8916ceda8e1fb",
        "Content-Type": "application/json"
    }
    params = {"optimize_streaming_latency": 3}

    data = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.8,
            "similarity_boost": 0.7,
            "Use_speaker_boost": True,
            "voice_id": voice_id  # Use the selected voice ID
        }
    }

    response = requests.post(url, headers=headers, params=params, data=json.dumps(data))

    if response.status_code == 200:
        return response.content
    else:
        print(f"Error: {response.status_code}")
        print(response.text)

def play(audio):
    with io.BytesIO(audio) as audio_file:
        st.audio(audio_file)

    def send_text(self):
        user_input = self.input_text.text().strip()
        self.input_text.clear()

        if user_input:
            self.conversation_text.append(f"<b>User:</b> {user_input}")
            self.conversation_text.repaint()

            perform_action(self, user_input)

            generated_text = generate_text2(user_input)

            audio = generate_audio(generated_text, streaming=True)
            play(audio)

            self.conversation_text.append(f"<b>Assistant:</b> {generated_text}")
            self.conversation_text.repaint()

# Function to display user messages with rounded rectangle borders
def user_message(message):
    st.markdown(f'<div class="user-message" style="display: flex; justify-content: flex-end; padding: 5px;">'
                f'<div style="background-color: #656673; color: white; padding: 10px; border-radius: 10px; font-size:18px; margin-bottom:10px; margin-left:20px;">{message}</div>'
                f'</div>', unsafe_allow_html=True)

# Function to display bot messages with rounded rectangle borders
def bot_message(message):
    st.markdown(f'<div class="bot-message" style="display: flex; padding: 5px;">'
                f'<div style="background-color: #262730; color: white; padding: 10px; border-radius: 10px; font-size:18px; margin-bottom:10px; margin-right:20px;">{message}</div>'
                f'</div>', unsafe_allow_html=True)

if __name__ == '__main__':
    app.run(debug=True)