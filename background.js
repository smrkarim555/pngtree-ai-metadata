try {
  importScripts("auth-config.js", "auth-service.js");
} catch (e) {
  console.warn("Auth scripts import error in background:", e);
}

const SYSTEM_PROMPT = `You are an expert Pngtree PNG stock asset metadata writer.
Look at the image and return ONLY valid JSON (no markdown, no backticks, no extra text) in this exact shape:
{
  "title": "clear descriptive title, 8-15 words, no camera brand names, no keyword stuffing, unique phrasing",
  "main_keywords": ["keyword1", "keyword2", "keyword3"],
  "secondary_keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5","keyword6","keyword7","keyword8","keyword9","keyword10","keyword11","keyword12","keyword13","keyword14","keyword15"],
  "category": "one broad stock-site category name that best fits this image, e.g. Business, Technology, Nature, Food, Illustration, Background, Icon, Medical, Education, Travel, Fashion, Holiday, Abstract",
  "creation_prompt": "a short 10-18 word prompt-style sentence describing what this image depicts, written like an AI image-generation prompt"
}
Rules for Pngtree PNG uploads:
- main_keywords: exactly 2-3 highest-relevance keywords describing the core subject (most important first).
- secondary_keywords: 15-20 relevant, non-repeating, single-word or short-phrase keywords ordered by relevance,
  lowercase, covering subject, style, color, use-case, concept — no duplicates of main_keywords or of each other.
- NEVER include brand names, trademarks, platform names, celebrity names, or copyrighted character/franchise
  names (e.g. no "iPhone", "Disney", "Nike", "Pokemon") in any keyword or the title.
- NEVER include explicit, offensive, violent, weapon, drug, or illegal-activity terms in any keyword or the title.
- Title must NOT be wrapped in quotes, must not be a generic stock phrase, and must not duplicate the keywords verbatim.
- If the image has a transparent/removed background (PNG cutout), mention that visually in the title only if natural.
- Do not include any explanation, only the JSON object.`;

function parseRetrySeconds(errText) {
  const m = errText.match(/try again in ([\d.]+)s/i);
  return m ? Math.ceil(parseFloat(m[1])) : 5;
}

async function callGroq(imageDataUrl, apiKey, model, attempt = 1) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Generate Adobe Stock style metadata JSON for this PNG image." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.4,
      max_tokens: 700,
    }),
  });

  if (res.status === 429 && attempt <= 3) {
    const bodyText = await res.text();
    const waitSec = parseRetrySeconds(bodyText);
    await new Promise((r) => setTimeout(r, (waitSec + 1) * 1000));
    return callGroq(imageDataUrl, apiKey, model, attempt + 1);
  }

  if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callMistral(imageDataUrl, apiKey, model, attempt = 1) {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Generate Adobe Stock style metadata JSON for this PNG image." },
            { type: "image_url", image_url: imageDataUrl },
          ],
        },
      ],
      temperature: 0.4,
      max_tokens: 700,
    }),
  });

  if (res.status === 429 && attempt <= 3) {
    await new Promise((r) => setTimeout(r, 6000));
    return callMistral(imageDataUrl, apiKey, model, attempt + 1);
  }

  if (!res.ok) throw new Error(`Mistral error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callGemini(imageDataUrl, apiKey, model, attempt = 1) {
  const cleanModel = (model || "gemini-3.1-flash-lite").trim().replace(/^models\//, "");

  let mimeType = "image/png";
  let base64Data = imageDataUrl;
  const commaIdx = imageDataUrl.indexOf(",");
  if (commaIdx !== -1) {
    const header = imageDataUrl.slice(0, commaIdx);
    base64Data = imageDataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/^data:([^;]+);/);
    if (mimeMatch) mimeType = mimeMatch[1];
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: "Generate Adobe Stock style metadata JSON for this PNG image." },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1000,
        responseMimeType: "application/json",
      },
    }),
  });

  if (res.status === 429 && attempt <= 3) {
    await new Promise((r) => setTimeout(r, 6000 * attempt));
    return callGemini(imageDataUrl, apiKey, model, attempt + 1);
  }

  if (!res.ok) {
    let errorDetail = "";
    try {
      const errData = await res.json();
      errorDetail = errData.error?.message || JSON.stringify(errData);
    } catch {
      errorDetail = await res.text();
    }
    throw new Error(`Gemini error ${res.status}: ${errorDetail}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked request: ${data.promptFeedback.blockReason}`);
    }
    throw new Error("Gemini থেকে কোনো রেসপন্স আসেনি।");
  }

  const text = candidate.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini response empty (finishReason: ${candidate.finishReason || "unknown"}).`);
  }
  return text;
}

function parseJsonSafe(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const jsonStr = cleaned.slice(start, end + 1);
  return JSON.parse(jsonStr);
}

async function imageUrlToDataUrl(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const blob = await res.blob();
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const mime = blob.type || "image/png";
  return `data:${mime};base64,${base64}`;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 1. Check user subscription status
  if (msg.action === "checkSubscription") {
    (async () => {
      try {
        const sub = await AuthService.checkSubscriptionStatus();
        sendResponse(sub);
      } catch (err) {
        sendResponse({ isValid: false, status: "error", message: err.message });
      }
    })();
    return true;
  }

  // 2. Check GitHub update
  if (msg.action === "checkGitHubUpdate") {
    (async () => {
      try {
        const update = await AuthService.checkGitHubUpdate();
        sendResponse(update);
      } catch (err) {
        sendResponse({ hasUpdate: false, error: err.message });
      }
    })();
    return true;
  }

  // 3. Generate AI Metadata (Enforcing 1-month active subscription)
  if (msg.action === "generateMetadata") {
    (async () => {
      try {
        // Enforce active subscription
        const sub = await AuthService.checkSubscriptionStatus();
        if (!sub.isValid) {
          throw new Error(
            sub.message ||
              "সাবস্ক্রিপশন মেয়াদ শেষ বা একাউন্ট এক্টিভ নয়। এডমিনের সাথে যোগাযোগ করুন।"
          );
        }

        const s = await chrome.storage.local.get([
          "provider", "groqKey", "groqModel", "mistralKey", "mistralModel",
          "geminiKey", "geminiModel",
        ]);
        const provider = s.provider || "gemini";

        const imageDataUrl = await imageUrlToDataUrl(msg.imageUrl);

        let raw;
        if (provider === "groq") {
          if (!s.groqKey) throw new Error("Groq API key দেওয়া নেই — extension popup-এ গিয়ে সেভ করো।");
          raw = await callGroq(imageDataUrl, s.groqKey, s.groqModel || "meta-llama/llama-4-scout-17b-16e-instruct");
        } else if (provider === "mistral") {
          if (!s.mistralKey) throw new Error("Mistral API key দেওয়া নেই — extension popup-এ গিয়ে সেভ করো।");
          raw = await callMistral(imageDataUrl, s.mistralKey, s.mistralModel || "pixtral-large-latest");
        } else if (provider === "gemini") {
          if (!s.geminiKey) throw new Error("Gemini API key দেওয়া নেই — extension popup-এ গিয়ে সেভ করো।");
          raw = await callGemini(imageDataUrl, s.geminiKey, s.geminiModel || "gemini-3.1-flash-lite");
        }
        const parsed = parseJsonSafe(raw);
        sendResponse({ ok: true, data: parsed });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
});
