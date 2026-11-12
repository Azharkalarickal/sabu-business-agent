# 👦🏽 Sabu (സാബു) - Autonomous Business Student AI Agent

An autonomous AI Agent who participates on the **[ProChat Platform](https://open-world-chat-box.onrender.com/)** as **Sabu** (`sabu123`), a 15-year-old 10th standard student from Kerala passionate about business, startups, and technology. Sabu networks with real-world professionals (Doctors, Developers, Engineers, Marketers, Founders), engages in World Chat and 1-on-1 personal discussions, extracts business insights, and preserves them in his memory.

---

## 🌟 Key Features

1. **Human-like Persona & Soul**:
   - Acts and talks like a real curious Malayali student.
   - Adapts to the speaker's language (Malayalam, Manglish, or English).
   - Simulates human typing delays (2-4 seconds).
2. **Autonomous World Chat Participant**:
   - Listens to the public live room on ProChat.
   - Automatically joins relevant discussions or answers when addressed.
3. **1-on-1 Direct Messaging**:
   - Handles personal DMs, introducing himself politely and asking about the user's field.
4. **Proactive Discovery Loop**:
   - Periodically searches ProChat for newly joined professionals (Developers, Doctors, Managers) and sends polite greetings.
5. **Business Wisdom Vault (Hostinger MySQL)**:
   - Automatically extracts practical business lessons from conversations and saves them to Hostinger MySQL with fallback memory protection.
6. **Live Web Command Dashboard**:
   - Hosted on Render with live activity feed, thought process logs, memory notes, and manual controls.

---

## 🛠️ Project Structure

```
Business man/
├── package.json
├── .env.example
├── .env
├── .gitignore
├── README.md
├── index.js
└── src/
    ├── config.js
    ├── database/
    │   ├── db.js             # Hostinger MySQL connector & memory fallback
    │   └── schema.sql        # MySQL table definitions
    ├── agent/
    │   ├── sabuPersona.js    # Persona and prompt system
    │   ├── brain.js          # Groq AI LLM caller & insight extractor
    │   └── autoBehavior.js   # Autonomous decision loops
    ├── platform/
    │   └── client.js         # REST & Socket.IO client for ProChat
    └── server/
        ├── app.js            # Express app & API endpoints
        └── public/           # Real-time web dashboard (HTML, CSS, JS)
```

---

## 🚀 Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the agent:
   ```bash
   npm start
   ```
3. Open the live dashboard in your browser:
   ```
   http://localhost:3001
   ```

---

## 🌐 Deploying to Render (Step-by-Step)

### Step 1: Push Project to GitHub
1. In your GitHub account, create a new repository: `sabu-business-agent`.
2. Push this project folder to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Sabu Business Agent"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/sabu-business-agent.git
   git push -u origin main
   ```

### Step 2: Create Web Service on Render
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** ➔ **Web Service**.
2. Connect your GitHub repository `sabu-business-agent`.
3. Set the following settings:
   - **Name**: `sabu-business-agent`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Under **Environment Variables**, add:
   - `PLATFORM_URL`: `https://open-world-chat-box.onrender.com`
   - `PLATFORM_USERNAME`: `sabu123`
   - `PLATFORM_PASSWORD`: `your_password_here`
   - `GROQ_API_KEY`: `your_groq_api_key_here`
   - `GROQ_MODEL`: `qwen/qwen3.8-27b`
   - `DB_HOST`: `your_hostinger_db_host`
   - `DB_PORT`: `3306`
   - `DB_USER`: `your_db_user`
   - `DB_PASSWORD`: `your_db_password`
   - `DB_NAME`: `your_db_name`
5. Click **Create Web Service**.

Once deployed, your Render app URL will display the live dashboard where you can see Sabu in action!

---

## 🗄️ Hostinger Remote MySQL Setup

To allow Render or your local machine to connect to Hostinger MySQL:
1. Log in to **Hostinger hPanel**.
2. Go to **Databases** ➔ **Remote MySQL**.
3. Under **Create Remote Database Connection**:
   - **IP (IPv4)**: Enter `%` (allows connection from Render's dynamic IP).
   - **Database**: Select `u918480384_chatbot`.
   - Click **Create**.

