<h2>Chatbot implemented with Langchain and OpenAI's Automatic Speach Recognition - Whisper</h2>

<br>

<p>Create a .env file with api key for the desired llm model, change the model in main.py</p>
<p>Whisper is configured with model: whisper-large-v3 that uses a recording.webm file. Configuration can be changed in api.py</p>

<p>Startup backend: .envv\Scripts\uvicorn api:app --reload --port 8000 -> from root</p>
<p>Startup frontend: ng serve --port 4200 -> from chat-widget folder</p>
