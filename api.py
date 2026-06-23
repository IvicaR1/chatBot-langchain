import os
import tempfile
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from knowledge import SYSTEM_PROMPT

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: change in prod
    allow_methods=["POST"],
    allow_headers=["*"],
)

llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.5)
groq_client = Groq()

MAX_MESSAGES = 20


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


class ChatResponse(BaseModel):
    reply: str
    limitReached: bool


class TranscribeResponse(BaseModel):
    text: str


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    user_turns = sum(1 for m in req.messages if m.role == "user")

    if user_turns > MAX_MESSAGES:
        return ChatResponse(reply="", limitReached=True)

    history = [SystemMessage(content=SYSTEM_PROMPT)]
    for m in req.messages:
        if m.role == "user":
            history.append(HumanMessage(content=m.content))
        else:
            history.append(AIMessage(content=m.content))

    try:
        response = llm.invoke(history)
        return ChatResponse(reply=response.content, limitReached=user_turns >= MAX_MESSAGES)
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower() or "rate" in err.lower():
            msg = (
                "The AI service is temporarily unavailable due to rate limits. "
                "Please try again in a few minutes or visit neocom.com.mk."
            )
        else:
            msg = "Something went wrong. Please try again or visit neocom.com.mk."
        return ChatResponse(reply=msg, limitReached=False)


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(audio: UploadFile = File(...)):
    data = await audio.read()
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        with open(tmp_path, "rb") as f:
            result = groq_client.audio.transcriptions.create(
                file=("recording.webm", f, "audio/webm"),
                model="whisper-large-v3",
                response_format="json",
            )
        return TranscribeResponse(text=result.text.strip())
    except Exception as e:
        print(f"[transcribe error] {e}")
        return TranscribeResponse(text="")
    finally:
        os.unlink(tmp_path)
