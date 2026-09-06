Pngtree AI Metadata Filler — Chrome Extension
===============================================

কী করে এই extension:
- upload.pngtree.com/manage পেজে "Work details" panel খুললে একটা
  "🤖 Generate AI Metadata" বাটন বসে যাবে।
- বাটনে ক্লিক করলে panel-এর ছবিটা Gemini, Groq বা Mistral vision AI-কে পাঠায়।
- AI থেকে JSON আকারে Title + Main keywords + Secondary keywords ফেরত আসে,
  আর সেগুলো নিজে নিজে ফর্মের ইনপুটে বসে যায় (React-safe fill, তাই page ঠিকমতো detect করবে)।

ইনস্টল করার নিয়ম (Chrome):
1. chrome://extensions/ খোলো
2. উপরে ডানদিকে "Developer mode" ON করো
3. "Load unpacked" ক্লিক করো
4. এই ফোল্ডারটা (pngtree-ai-metadata) সিলেক্ট করো
5. Extension icon-এ ক্লিক করে Gemini, Groq বা Mistral API key + model name বসিয়ে
   "Save Settings" চাপো

Gemini API key: https://aistudio.google.com/app/apikey থেকে নাও
Groq API key: https://console.groq.com/keys থেকে নাও
Mistral API key: https://console.mistral.ai/ থেকে নাও

Model নাম (এখন সবকয়টি Dropdown আকারে দেওয়া আছে):
- Gemini: gemini-3.1-flash-lite (Default), gemini-3.5-flash-lite, gemini-3.8-flash
- Groq (সর্বোচ্চ ৩টি কার্যকর মডেল): llama-4-scout-17b, llama-3.2-90b-vision, llama-3.2-11b-vision
- Mistral: pixtral-large-latest, pixtral-12b-2409
(প্রয়োজনে Custom Model অপশন দিয়ে অন্য যেকোনো মডেলও বসানো যাবে)

যদি বাটন প্যানেলে না বসে বা ফিল্ড fill না হয়:
- upload.pngtree.com/manage পেজে যেই input field-টা fill হচ্ছে না,
  ওটার উপর right-click করে "Inspect" করো
- DevTools-এ ওই <input> ট্যাগের placeholder/class/id দেখো
- content.js ফাইলে findFieldsInPanel() ফাংশনে গিয়ে সেই selector বসাও
  (এখন placeholder টেক্সট ধরে খোঁজে, যদি Pngtree placeholder বদলে ফেলে
  তাহলে এখানেই আপডেট লাগবে)

নতুন ফিচার — Auto Run All:
- পেজের নিচে ডানদিকে একটা floating panel দেখবে: "▶ Auto Run All (Generate + Save)"
- এতে ক্লিক করলে ও নিজে নিজে একটার পর একটা "To Submit" card open করবে,
  AI দিয়ে metadata generate করবে, ফিল্ড fill করবে, তারপর "Save" বাটনে ক্লিক করবে,
  এভাবে সব card শেষ না হওয়া পর্যন্ত চলবে। বাটনটা কমলা রঙে pulse করবে (active দেখাবে)।
- যেকোনো সময় "⏹ Stop" চাপলে থেমে যাবে।
- কোনো error হলে (যেমন API key ভুল) auto-run নিজে থেমে যাবে আর status-এ কারণ দেখাবে।

"Invalid API Key" (401) error ফিক্স করতে:
- Extension icon → popup খুলে Groq API key box-টা আবার খুলে দেখো ভুল/স্পেস আছে কিনা
- console.groq.com/keys থেকে নতুন key কপি করে বসাও, "Save Settings" চাপো
- Model box-এ থাকবে: meta-llama/llama-4-scout-17b-16e-instruct
- এরপর আবার Generate/Auto Run ট্রাই করো

নতুন এই আপডেটে যা যোগ হলো:
- Category dropdown: AI-এর guess করা category text ধরে dropdown open করে matching option
  ক্লিক করার চেষ্টা করে; না মিললে dropdown-এ প্রথম যেই option আসে সেটা সিলেক্ট করে।
  Pngtree-র dropdown কীভাবে render হয় তা আগে থেকে জানা নেই, তাই এটা "best-effort" —
  যদি ভুল category বসে বা না বসে, panel-এ manual চেক করে বলো, আমি টিউন করে দেব।
- AI platform URL: প্রতিটা card-এ একটাই fixed link বসে, যেটা extension popup-এ
  "Default AI platform URL" বক্সে বসাবে (default: https://groq.com)।
- Keywords used to create the image: AI ইমেজ দেখে একটা ছোট prompt-এর মতো
  বাক্য বানিয়ে এখানে বসিয়ে দেয়।

Rate limit (429) হ্যান্ডলিং:
- Groq/Mistral rate limit ধরা পড়লে extension নিজে থেকে ৫-৭ সেকেন্ড wait করে
  আবার চেষ্টা করে (৩ বার পর্যন্ত রিট্রাই)।
- Auto Run All মোডে প্রতিটা card-এর পর প্রায় ২ সেকেন্ড wait করে, যাতে
  per-minute token limit-এ কম hit হয়। তাও বেশি hit হলে Groq console থেকে
  Dev Tier-এ upgrade করার কথা ভাবতে পারো (message-এ লিংক দেওয়া থাকে)।
