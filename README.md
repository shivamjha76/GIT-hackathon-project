# 🛡️ SecretWatch — Student Repository Secret Leakage Monitor

> **Codefiesta 5.0 Flagship Hackathon (GIT Jaipur)**  
> **Track:** Cybersecurity | **Problem Statement #03**

**SecretWatch** is a lightweight, real-time, explainable credential leakage detection and alerting platform built specifically for student repositories, university coding clubs, and hackathon teams.

---

## 🌟 Key Features

1. **Two-Stage Detection Engine:**
   - **Stage 1 (Provider Regex Patterns):** High-confidence detection of AWS Access Keys, OpenAI Keys, GitHub Personal Access Tokens (classic & fine-grained), Google API Keys, Stripe Keys, SSH/RSA Private Keys, Database Connection URLs with passwords, Slack Tokens, Discord Webhooks, and JWTs.
   - **Stage 2 (Shannon Entropy + Context Heuristics):** Identifies unknown/generic high-entropy secrets based on character uncertainty ($H(X) = -\sum p(c)\log_2 p(c)$) and context variable names (`api_key`, `secret`, `token`).
   - **False Positive Controls:** Automatically filters out documented placeholders (`YOUR_API_KEY`, `dummy`, `example`), documentation, test files, lock files, and UUIDs.

2. **Zero Plaintext Storage (Security by Design):**
   - Credentials are **never stored or displayed unmasked**.
   - Only masked previews (e.g. `AKIA************MPLE`) and irreversible salted SHA-256 fingerprints are recorded.

3. **Instant Discord & Slack Alert Pipeline:**
   - Sends color-coded rich embeds within seconds of commit push.
   - Includes commit link, file, line number, masked preview, and **actionable 5-step remediation guidance** (reminding students that simply deleting the line from Git does not clear history).

4. **Dark Mode Cyber Dashboard:**
   - **Overview:** Live KPI counters, 7-day findings bar chart, severity distribution donut chart, and recent findings stream.
   - **Findings:** Search, multi-criteria filters, and detailed side-drawer with remediation steps, Discord alert confirmation, and "Mark resolved" / "False positive" workflows.
   - **Repositories:** Grid view of monitored student repos with live status badges (`Idle`, `Scanning`, `Error`), severity breakdown dots, on-demand scan triggers, and repository addition.
   - **Simulate Leak Button:** Built-in demo simulation tool to trigger real-time detection in under 3 seconds during live hackathon judging.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+

### 2. Backend Setup
```powershell
cd backend

# Configure environment variables (optional: add Discord Webhook and GitHub Token)
cp .env.example .env

# Run FastAPI Server
python -m uvicorn app.main:app --port 8000 --reload
```
The backend API and Swagger Docs will be available at:
- **API Health:** `http://127.0.0.1:8000/api/health`
- **Interactive Swagger Docs:** `http://127.0.0.1:8000/docs`

### 3. Frontend Setup
```powershell
cd frontend
npm install
npm run dev -- --port 5173
```
Open your browser at:
- **Dashboard UI:** `http://localhost:5173`

---

## 🔔 Discord Webhook Integration (Optional)

To receive real-time alerts in your Discord server:
1. In your Discord server: **Channel Settings > Integrations > Webhooks > New Webhook**.
2. Copy the Webhook URL.
3. Open `backend/.env` and paste:
   ```env
   DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/your-webhook-id/your-token"
   ```
4. Restart or trigger a scan—alerts will immediately arrive in your Discord channel!

---

## 🎯 Hackathon "Killer Demo" Pitch Flow

1. Open the dashboard at `http://localhost:5173`.
2. Show the **Overview** metrics, daily bar chart, and severity breakdown.
3. Switch to **Repositories** tab to display the monitored student projects.
4. Click **"Simulate Leak"** (top right) or push a test commit containing a fake AWS Key (`AKIAIOSFODNN7EXAMP99`).
5. Watch the dashboard update with the new finding and the Discord alert fire in under 3 seconds!
6. Open the finding details in the **Findings** tab to explain the two-stage detection, entropy score, masked value safety, and remediation guidance.
7. Click **"Mark resolved"** to demonstrate resolution tracking.
