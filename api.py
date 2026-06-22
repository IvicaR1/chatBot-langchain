# api.py — FastAPI backend for the Neocom chat widget
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from knowledge import SYSTEM_PROMPT

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: change domain in prod
    allow_methods=["POST"],
    allow_headers=["*"],
)

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.5)

MAX_MESSAGES = 20


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


class ChatResponse(BaseModel):
    reply: str
    limitReached: bool


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    user_turns = sum(1 for m in req.messages if m.role == "user")

    if user_turns > MAX_MESSAGES:
        return ChatResponse(
            reply="",
            limitReached=True,
        )

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
            msg = "Something went wrong. Please try again or visit continue browsing neocom.com.mk."
        return ChatResponse(reply=msg, limitReached=False)
