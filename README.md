# SpeakEasy 🎙️

**SpeakEasy** is an open-source, real-time AI voice assistant web application designed to help English learners overcome speaking anxiety, build confidence, and achieve natural fluency through low-pressure conversations with **Alex**, an empathetic AI partner powered by **Google Gemini 2.5 Flash** (`thinkingBudget: 0`) and the native **Web Speech API**.

---

## 📖 About SpeakEasy

Practicing spoken English with human partners or in traditional classrooms can often feel intimidating. SpeakEasy provides a calm, pressure-free environment where learners can practice natural, back-and-forth verbal conversations.

- **🎙️ Voice-First & Zero Extra Costs**: Uses your browser's built-in Speech Recognition and Speech Synthesis — no third-party STT/TTS billing or setup required.
- **⚡ Ultra-Low Latency**: Configured with `thinkingBudget: 0` for rapid, natural dialogue pacing with zero reasoning pauses.
- **📊 Live Conversation Tracking**: Measures session duration, speaking pace, turns, total word count, and detected filler words in real time.
- **📝 Comprehensive Feedback & CEFR Scoring**: One-click analysis delivering CEFR level estimates (A2–C1), grammar diff corrections ("You said" vs. "Native way"), pronunciation guidance, and customized daily practice drills.
- **🔒 Private & Client-Centric**: No backend required. API keys remain strictly on your device in `localStorage` and are transmitted securely via HTTP headers.

---

## ✨ Features

- **Voice-First Interaction**: Tap the prominent microphone to speak; Alex responds aloud in natural spoken English.
- **Zero-Latency Conversation**: Configured with `thinkingBudget: 0` on Gemini 2.5 Flash for rapid, natural back-and-forth dialogue.
- **Live Conversation Tracker**: Real-time counter of session duration, turns taken, total words spoken, and vocabulary richness.
- **Comprehensive Feedback Report**: One-click AI evaluation powered by Gemini 2.5 Flash:
  - **Estimated CEFR Level & Overall Score** (0–100) with Fluency, Grammar, and Vocabulary subscores.
  - **Grammar & Sentence Structure**: Side-by-side "You said" vs. "Native way to say it" diff cards with clear grammatical rule explanations.
  - **Pronunciation & Clarity Guidance**: Pinpoints sound traps, dropped endings (e.g. `-ed`, `-s`), and phonetic articulation advice (tongue/mouth placement, syllable stress).
  - **Fluency & Vocabulary**: Speaking momentum, filler word breakdown ("um", "like", etc.), and recommended upgraded vocabulary.
  - **Celebrated Strengths**: Positive reinforcement highlighting what you did well.
  - **Targeted Action Plan & Strategies**: Daily drills and practical exercises customized to your specific mistakes.
- **Report Export & Archive**: Copy report summary to clipboard, download `.txt` report, and view historical reports anytime.
- **Client-Side & Private**: No backend server required! Your Gemini API key is stored safely in `localStorage` and sent directly to Google AI Studio.
- **Native Web Speech API**:
  - Speech Recognition (`webkitSpeechRecognition` / `SpeechRecognition`)
  - Speech Synthesis (`speechSynthesis`) with customizable voice and speech rate
- **Auto-Listen Mode**: Automatically resumes listening after Alex finishes speaking for continuous hands-free dialogue.
- **Calming & Friendly Design**: Soft sage green and sky blue palette, gentle breathing/pulsing audio animations, and dark mode support to alleviate speaking stress.
- **Fallback Typing**: Easily switch between voice and text input.
- **Replay Audio**: Tap "Replay" on any of Alex's messages to practice listening and pronunciation.

---

## 🚀 Quick Start (Local Run)

Because the app is built as a pure client-side ES6 module application, it runs directly from any local static HTTP server.

### Option 1: Python
```bash
# In the project directory:
python -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in **Google Chrome** or **Microsoft Edge**.

### Option 2: Node.js (`npx serve`)
```bash
npx serve .
```

### Option 3: VS Code Live Server
Right-click `index.html` in VS Code and choose **"Open with Live Server"**.

---

## 🔑 Gemini API Key Setup

1. Get your free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Open SpeakEasy in your browser.
3. Click the **Settings** icon (gear in top-right) or the welcome banner.
4. Paste your API key and click **Done**.

---

## 🌐 Deployment

Deploy to any static hosting service for free in seconds:

### GitHub Pages
1. Push the repository to GitHub.
2. Go to **Settings > Pages**.
3. Under **Build and deployment > Source**, select `Deploy from a branch` and choose `main` / `/ (root)`.
4. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

### Vercel / Netlify / Cloudflare Pages
Simply import the repository. No build command is required (`Publish directory: .`).

---

## 🎙️ Browser Compatibility

| Browser | Speech Recognition (STT) | Speech Synthesis (TTS) | Recommended |
|---|:---:|:---:|:---:|
| **Google Chrome** (Desktop & Android) | ✅ Full Support | ✅ Full Support | ⭐ Best Experience |
| **Microsoft Edge** | ✅ Full Support | ✅ Full Support | ⭐ Best Experience |
| **Brave / Chromium** | ✅ Full Support | ✅ Full Support | ⭐ Good |
| **Safari / iOS** | ⚠️ Partial / Text fallback | ✅ Supported | Typing fallback available |
| **Firefox** | ❌ Text fallback | ✅ Supported | Typing fallback available |

*Note: The app detects browser support on startup and provides graceful alerts and fallbacks.*

---

## 📁 Project Structure

```
EasySpeak/
├── index.html          # Semantic single-page layout & modals
├── css/
│   └── styles.css      # Calming theme variables, mic animations, and responsive layout
├── js/
│   ├── app.js          # Main coordinator & conversation lifecycle
│   ├── gemini.js       # Gemini 2.5 Flash API client (thinkingBudget: 0)
│   ├── speech.js       # Web Speech API (STT & TTS) wrapper
│   └── storage.js      # LocalStorage manager
└── README.md           # Documentation
```

---

## 💡 Conversation Partner: "Alex"

Alex follows strict conversational voice rules:
- Speaks in **1 to 3 short, natural sentences**.
- **Never uses lists or markdown** formatting.
- Always ends with an engaging question to keep the learner talking.
- Models correct grammar gently and celebrates effort to eliminate fear of making mistakes.
