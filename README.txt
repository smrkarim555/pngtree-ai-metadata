Pngtree AI Metadata Filler — Chrome Extension
===============================================

What this extension does:
- In upload.pngtree.com/manage, when you open any "Work details" drawer, it automatically injects a "🤖 Generate AI Metadata" button.
- Clicking the button sends the card's thumbnail to Gemini, Groq, or Mistral vision AI.
- The AI returns JSON with Title + Main keywords (capped at 3) + Secondary keywords + Category + AI Prompt.
- Form fields are auto-filled using React-safe native value dispatching.

Installation Instructions (Chrome):
1. Open chrome://extensions/
2. Turn ON "Developer mode" in the top-right corner.
3. Click "Load unpacked".
4. Select this folder (pngtree-ai-metadata).
5. Click the extension icon in Chrome toolbar, enter your Vision API key (Gemini, Groq, or Mistral), and click "Save Settings".

API Key Links:
- Gemini API Key: https://aistudio.google.com/app/apikey
- Groq API Key: https://console.groq.com/keys
- Mistral API Key: https://console.mistral.ai/

Supported Models (Available in dropdowns):
- Gemini: gemini-3.1-flash-lite (Default), gemini-3.5-flash-lite, gemini-3.8-flash
- Groq: llama-4-scout-17b, llama-3.2-90b-vision, llama-3.2-11b-vision
- Mistral: pixtral-large-latest, pixtral-12b-2409
(Custom Model option is also available if needed)

Key Features:
- Auto Run All: Floating control panel at bottom-right ("▶ Auto Run All (Generate + Save)"). Opens pending cards one by one, fills metadata, and clicks Submit automatically.
- Stop Button: "⏹ Stop" pauses the batch at any time safely.
- 1-Month Admin Approval System: New users sign up with Gmail. The Admin (configured in auth-config.js) activates users for 1 month (30 days).
- Mobile Admin Dashboard (admin.html): Allows admin to activate users from mobile using PIN protection (default: 5555).
- Rate-Limit Retries: Automatically backs off and retries on 429 rate limit responses.
