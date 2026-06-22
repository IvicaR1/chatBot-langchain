# main.py
import streamlit as st
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from knowledge import SYSTEM_PROMPT

load_dotenv()

MAX_MESSAGES = 20

# Streamlit page setup - demo purposes - streamlit run main.py in venv
st.set_page_config(
    page_title="Neocom Assistant",
    page_icon="🖥️",
    layout="centered",
)

st.markdown("""
    <style>
        .neocom-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 4px;
        }
        .neocom-title {
            font-size: 1.8rem;
            font-weight: 700;
            color: #003f8a;
            margin: 0;
        }
        .neocom-subtitle {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 20px;
        }
    </style>
""", unsafe_allow_html=True)

st.markdown("""
    <div class="neocom-header">
        <span style="font-size:2rem">🖥️</span>
        <p class="neocom-title">Neocom Assistant</p>
    </div>
    <p class="neocom-subtitle">
        Hi! I'm the virtual assistant for <strong>Neocom AD Skopje</strong>.
        Ask me anything about our services, products, or how we can help your business.
    </p>
""", unsafe_allow_html=True)

st.divider()

# Model init
@st.cache_resource
def get_llm():
    return ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.5,
    )

llm = get_llm()

if "messages" not in st.session_state:
    st.session_state.messages = [SystemMessage(content=SYSTEM_PROMPT)]

def human_message_count() -> int:
    return sum(1 for m in st.session_state.messages if isinstance(m, HumanMessage))

at_limit = human_message_count() >= MAX_MESSAGES

for msg in st.session_state.messages:
    if isinstance(msg, HumanMessage):
        with st.chat_message("user"):
            st.markdown(msg.content)
    elif isinstance(msg, AIMessage):
        with st.chat_message("assistant", avatar="🖥️"):
            st.markdown(msg.content)

if at_limit:
    st.info(
        f"You've reached the {MAX_MESSAGES}-message limit for this session. "
        "Use the **Clear conversation** button in the sidebar to start a new chat, "
        "or visit [neocom.com.mk](https://www.neocom.com.mk) to contact us directly.",
        icon="ℹ️",
    )

if user_input := st.chat_input(
    "Ask about Neocom's services, cloud, support...",
    disabled=at_limit,
):
    with st.chat_message("user"):
        st.markdown(user_input)

    st.session_state.messages.append(HumanMessage(content=user_input))

    with st.chat_message("assistant", avatar="🖥️"):
        with st.spinner("Thinking..."):
            try:
                response = llm.invoke(st.session_state.messages)
                reply = response.content
            except Exception as e:
                err = str(e)
                if "429" in err or "quota" in err.lower() or "rate" in err.lower():
                    reply = (
                        "⚠️ The AI service is temporarily unavailable due to rate limits. "
                        "Please try again in a few minutes, or contact Neocom directly at "
                        "[neocom.com.mk](https://www.neocom.com.mk)."
                    )
                else:
                    reply = (
                        "⚠️ Something went wrong. Please try again or visit "
                        "[neocom.com.mk](https://www.neocom.com.mk) to reach us directly."
                    )
        st.markdown(reply)

    st.session_state.messages.append(AIMessage(content=reply))
    st.rerun()

# Sidebar
with st.sidebar:
    st.image(
        "https://www.neocom.com.mk/wp-content/uploads/2021/03/neocom-logo.png",
        use_container_width=True,
    )
    st.markdown("---")

    st.markdown("### Quick Links")
    st.markdown("🌐 [neocom.com.mk](https://www.neocom.com.mk)")
    st.markdown("☁️ [neoCloud](https://neocloud.mk)")
    st.markdown("🏢 [neoDC](https://neodc.mk)")

    st.markdown("---")
    st.markdown("### Contact")
    st.markdown("📍 Bul. Kuzman Josifovski Pitu 15, Skopje")
    st.markdown("📍 City center, Bitola")

    st.markdown("---")

    count = human_message_count()
    st.caption(f"Messages: {count} / {MAX_MESSAGES}")
    st.progress(count / MAX_MESSAGES)

    if st.button("🗑️ Clear conversation", use_container_width=True):
        st.session_state.messages = [SystemMessage(content=SYSTEM_PROMPT)]
        st.rerun()
