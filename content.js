// ================= Subscription verification =================
let cachedSub = null;
let lastSubCheck = 0;

async function checkSubCached(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSub && now - lastSubCheck < 8000) {
    return cachedSub;
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "checkSubscription" }, (res) => {
      cachedSub = res || { isValid: false, message: "সার্ভারে কানেক্ট করা যাচ্ছে না।" };
      lastSubCheck = Date.now();
      resolve(cachedSub);
    });
  });
}

// ================= React-safe value setter =================
function setNativeValue(element, value) {
  const proto = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  const setter = descriptor && descriptor.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ================= Keyword safety filter =================
// Pngtree (and most stock sites) reject uploads whose keywords contain
// brand/trademark names, celebrity names, or explicit/illegal terms.
// The AI occasionally slips one of these in — this strips them out
// client-side as a safety net before anything gets typed into the form.
const BANNED_KEYWORD_PATTERNS = [
  // Brands / trademarks / platforms
  /\b(adobe|photoshop|iphone|ipad|apple|android|google|microsoft|windows|meta|facebook|instagram|whatsapp|tiktok|twitter|snapchat|youtube|netflix|spotify|amazon|sony|samsung|nike|adidas|puma|reebok|gucci|prada|chanel|louis vuitton|rolex|coca[\s-]?cola|pepsi|mcdonald|starbucks|disney|marvel|pixar|dc comics|warner bros|nintendo|playstation|xbox|pokemon|star wars|harry potter|batman|superman|spider[\s-]?man|hello kitty|minecraft|fortnite)\b/i,
  // Explicit / adult / offensive
  /\b(nude|naked|nsfw|porn|sex|sexy|erotic|xxx)\b/i,
  // Violence / weapons / illegal drugs / self-harm
  /\b(gun|rifle|pistol|bomb|explosive|grenade|weapon|kill|murder|suicide|self[\s-]?harm|terroris\w*|nazi|swastika|cocaine|heroin|meth(amphetamine)?|marijuana|cannabis|weed|drugs?)\b/i,
  // Misc restricted claims
  /\b(cure|guaranteed|100%\s*free|counterfeit|fake|pirated|hack(ed|ing)?|crack(ed)?)\b/i,
];

function isKeywordSafe(word) {
  const w = (word || "").trim();
  if (!w) return false;
  return !BANNED_KEYWORD_PATTERNS.some((re) => re.test(w));
}

function sanitizeKeywords(list) {
  if (!Array.isArray(list)) return [];
  return list.map((k) => (k || "").trim()).filter((k) => k && isKeywordSafe(k));
}

// ================= Panel + field discovery =================
function findOpenPanel() {
  const headers = Array.from(document.querySelectorAll("*")).filter(
    (el) =>
      el.children.length === 0 &&
      el.textContent &&
      el.textContent.trim() === "Work details"
  );
  for (const h of headers) {
    let node = h;
    for (let i = 0; i < 10 && node; i++) {
      if (node.querySelector('input[placeholder*="title of the work" i]')) {
        return node;
      }
      node = node.parentElement;
    }
  }
  return null;
}

function findCategoryTrigger(panel) {
  const label = Array.from(panel.querySelectorAll("*")).find(
    (el) => el.children.length === 0 && el.textContent.trim() === "Category"
  );
  if (!label) return null;
  let row = label.parentElement;
  for (let i = 0; i < 4 && row; i++) {
    const candidate = getLeafTextElements(row).find(
      (el) => el !== label && !label.contains(el) && el.textContent.trim().length > 0
    );
    if (candidate) return candidate;
    row = row.parentElement;
  }
  return null;
}

function findFieldsInPanel(panel) {
  return {
    img: panel.querySelector("img"),
    title: panel.querySelector('input[placeholder*="title of the work" i]'),
    mainKeywords: panel.querySelector('input[placeholder*="main keywords" i]'),
    secondaryKeywords: panel.querySelector(
      'input[placeholder*="secondary keywords" i], textarea[placeholder*="secondary keywords" i]'
    ),
    aiPlatformUrl: panel.querySelector(
      'input[placeholder*="URL of the AI platform" i], input[placeholder*="AI platform used" i]'
    ),
    keywordsUsed: panel.querySelector(
      'input[placeholder*="keywords used when creating" i], textarea[placeholder*="keywords used when creating" i]'
    ),
    categoryTrigger: findCategoryTrigger(panel),
  };
}

function getLeafTextElements(root = document.body) {
  return Array.from(root.querySelectorAll("*")).filter(
    (el) => el.children.length === 0 && el.textContent.trim().length > 0
  );
}

async function selectCategory(panel, desiredCategory) {
  const fields = findFieldsInPanel(panel);
  if (!fields.categoryTrigger) return false;

  const beforeLabel = fields.categoryTrigger.textContent.trim();

  fields.categoryTrigger.click();
  await sleep(450);

  // Pngtree uses the iView (ivu-select) component library for this dropdown.
  // Target its option items specifically instead of guessing by screen position —
  // proximity-based guessing previously misfired and clicked the site logo.
  let options = Array.from(
    document.querySelectorAll(
      ".ivu-select-dropdown .ivu-select-item, .ivu-select-item, [class*='select-dropdown'] li, [class*='select-item']"
    )
  ).filter((el) => el.offsetParent !== null && el.textContent.trim().length > 0);

  if (!options.length) {
    // couldn't find a real option list — close safely via Escape, never click blindly
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  }

  let match = null;
  if (desiredCategory) {
    const wanted = desiredCategory.toLowerCase();
    match = options.find((el) => {
      const t = el.textContent.trim().toLowerCase();
      return t === wanted || t.includes(wanted) || wanted.includes(t);
    });
  }
  const chosen = match || options[0];

  for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
    chosen.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
  await sleep(350);

  const afterLabel = fields.categoryTrigger.textContent.trim();
  if (afterLabel === beforeLabel) {
    chosen.click();
    await sleep(300);
  }

  return true;
}

function findButtonByText(text, root = document) {
  const all = root.querySelectorAll("button, [role='button'], a, span");
  for (const el of all) {
    if (el.children.length === 0 && el.textContent.trim() === text) {
      return el;
    }
  }
  return null;
}

// Finds the small "✕" / close icon in the panel's top-right corner, near
// the "Work details" header — used to dismiss the panel after Submit.
// Confirmed via DevTools: Pngtree uses iView's drawer component, whose
// close button is always <a class="ivu-drawer-close"><i class="ivu-icon
// ivu-icon-ios-close">. Try that exact selector first — it's reliable —
// then fall back to generic heuristics if the site's markup ever changes.
function findPanelCloseButton(panel) {
  // Confirmed via DevTools (screenshot): after a successful Submit the panel
  // switches to a read-only "Pending" view whose footer is
  // <div class="footer-btn"><span class="ivu-btn ivu-btn-default">Cancel</span></div>.
  // Check this exact shape FIRST since it's the most common closing path.
  const footerCancel =
    panel.querySelector(".footer-btn .ivu-btn-default") ||
    document.querySelector(".footer-btn .ivu-btn-default");
  if (footerCancel && footerCancel.textContent.trim() === "Cancel") return footerCancel;

  const exact =
    document.querySelector("a.ivu-drawer-close") ||
    document.querySelector(".ivu-drawer-close") ||
    document.querySelector("i.ivu-icon-ios-close") ||
    panel.querySelector("a.ivu-drawer-close, .ivu-drawer-close, i.ivu-icon-ios-close");
  if (exact) return exact;

  const header = Array.from(panel.querySelectorAll("*")).find(
    (el) => el.children.length === 0 && el.textContent.trim() === "Work details"
  );
  let row = header ? header.parentElement : panel;

  for (let i = 0; i < 5 && row; i++) {
    const leaves = getLeafTextElements(row);
    const glyphMatch = leaves.find((el) => {
      const t = el.textContent.trim();
      return t === "×" || t === "✕" || t === "x" || t === "X" || t === "Close";
    });
    if (glyphMatch) return glyphMatch;

    const iconMatch = Array.from(row.querySelectorAll("i, svg, span, button")).find((el) => {
      const cls = (el.className && el.className.toString()) || "";
      const aria = (el.getAttribute && el.getAttribute("aria-label")) || "";
      return (/close/i.test(cls) || /close/i.test(aria)) && el.offsetParent !== null;
    });
    if (iconMatch) return iconMatch;

    row = row.parentElement;
  }
  return null;
}

// ================= AI call wrapper (Promise-based) =================
function generateMetadataForImage(imageUrl) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "generateMetadata", imageUrl }, (response) => {
      resolve(response);
    });
  });
}

// Tag-input fields (Main keywords / Secondary keywords) show already-typed
// keywords as removable "pill" chips. Simply setting the underlying <input>'s
// value again (e.g. on Regenerate) does NOT remove old pills — it just adds
// more on top, which is why re-running the generator kept stacking keywords
// past the site's "no more than 3" limit. This clears existing pills first.
async function clearTagField(inputEl) {
  if (!inputEl) return;

  let container = inputEl.parentElement;
  for (let i = 0; i < 6 && container; i++) {
    if (container.querySelectorAll("i, svg, span").length > 2) break;
    container = container.parentElement;
  }
  if (!container) return;

  let guard = 0;
  while (guard < 60) {
    guard++;
    const closeIcons = Array.from(
      container.querySelectorAll(
        "i[class*='close' i], span[class*='close' i], svg[class*='close' i], " +
          "[class*='tag-close' i], [class*='remove' i], [class*='ivu-icon-ios-close' i]"
      )
    ).filter((el) => el.offsetParent !== null);

    if (!closeIcons.length) break;

    for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
      closeIcons[0].dispatchEvent(
        new MouseEvent(type, { bubbles: true, cancelable: true, view: window })
      );
    }
    await sleep(70);
  }
}

async function fillPanelWithAI(panel) {
  const fields = findFieldsInPanel(panel);
  if (!fields.img || !fields.img.src) {
    return { ok: false, error: "Image পাওয়া যায়নি এই panel-এ।" };
  }
  const response = await generateMetadataForImage(fields.img.src);
  if (!response || !response.ok) {
    return { ok: false, error: response ? response.error : "No response from background." };
  }
  const { title, main_keywords, secondary_keywords, category, creation_prompt } = response.data;

  if (fields.title && title) setNativeValue(fields.title, title);

  // Clear any previously-added pills before typing new ones (fixes duplicate
  // keyword stacking on Regenerate that triggered the "no more than 3" error).
  await clearTagField(fields.mainKeywords);
  await clearTagField(fields.secondaryKeywords);

  if (fields.mainKeywords && Array.isArray(main_keywords)) {
    const capped = sanitizeKeywords(main_keywords).slice(0, 3); // safe + hard cap at 3
    setNativeValue(fields.mainKeywords, capped.join(", "));
  }
  if (fields.secondaryKeywords && Array.isArray(secondary_keywords)) {
    const safeSecondary = sanitizeKeywords(secondary_keywords);
    setNativeValue(fields.secondaryKeywords, safeSecondary.join(", "));
  }

  if (fields.keywordsUsed && creation_prompt) {
    setNativeValue(fields.keywordsUsed, creation_prompt);
  }

  const settings = await chrome.storage.local.get(["aiPlatformUrl"]);
  let platformUrl = (settings.aiPlatformUrl && settings.aiPlatformUrl.trim()) || "https://ideogram.ai";
  // Pngtree's field rejects/clears URLs without a scheme — always ensure
  // https:// is present so it doesn't silently blank out after fill.
  if (!/^https?:\/\//i.test(platformUrl)) {
    platformUrl = "https://" + platformUrl;
  }
  if (fields.aiPlatformUrl) {
    setNativeValue(fields.aiPlatformUrl, platformUrl);
  }

  try {
    await selectCategory(panel, category);
  } catch (e) {
    // category selection is best-effort; don't fail the whole fill for this
    console.warn("Category select failed:", e);
  }

  return { ok: true };
}

// ================= Single "Generate" button inside panel =================
function stopEventFromClosingPanel(el) {
  ["mousedown", "mouseup", "click"].forEach((type) => {
    el.addEventListener(type, (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
  });
}

function ensurePanelButton(panel) {
  if (panel.querySelector(".ai-meta-btn")) return;
  const btn = document.createElement("button");
  btn.className = "ai-meta-btn";
  btn.type = "button";
  btn.textContent = "🤖 Generate AI Metadata";
  stopEventFromClosingPanel(btn);

  // Check subscription and lock if needed
  checkSubCached().then((sub) => {
    if (sub && !sub.isValid) {
      btn.classList.add("locked");
      btn.disabled = true;
      btn.textContent = "🔒 Locked (Approval Needed)";
    }
  });

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    e.preventDefault();

    const sub = await checkSubCached(true);
    if (!sub || !sub.isValid) {
      btn.classList.add("locked");
      btn.disabled = true;
      btn.textContent = "🔒 Locked (Approval Needed)";
      alert("⚠️ এক্সেস সীমাবদ্ধ!\n\n" + (sub?.message || "আপনার একাউন্ট এখনও একটিভ করা হয়নি। এডমিনের অনুমোদনের অপেক্ষায় রয়েছে।"));
      return;
    }

    btn.disabled = true;
    btn.textContent = "⏳ Generating...";
    const result = await fillPanelWithAI(panel);
    if (result.ok) {
      btn.disabled = false;
      btn.textContent = "✅ Done — Regenerate";
    } else {
      btn.disabled = false;
      btn.textContent = "⚠️ Error — Retry";
      if (result.error && (result.error.includes("সাবস্ক্রিপশন") || result.error.includes("এডমিন") || result.error.includes("Admin") || result.error.includes("লগইন"))) {
        alert("⚠️ এক্সেস সীমাবদ্ধ!\n\n" + result.error + "\n\n(এডমিনের সাথে যোগাযোগ করে এক্টিভেশন অনুমোদন নিন)");
      } else {
        alert("Error: " + result.error);
      }
    }
  });
  const titleField = panel.querySelector('input[placeholder*="title of the work" i]');
  if (titleField && titleField.parentElement) {
    titleField.parentElement.insertAdjacentElement("afterend", btn);
  } else {
    panel.appendChild(btn);
  }
}

// ================= Batch runner (Auto: card -> generate -> save -> next) =================
let autoRunning = false;
let autoStopRequested = false;

function getPendingCards() {
  // Confirmed via DevTools (screenshot): each grid tile is
  // <div class="single-work"> ... <img class="work-img"> ... <div class="work-footer">
  //   <label>...checkbox...</label> <span>●To Submit</span> <i>trash</i>
  // </div></div>
  // Prefer this exact shape — it's precise and won't accidentally grab
  // unrelated elements. Fall back to the old generic text-walk if the
  // site's markup ever changes.
  const exactCards = Array.from(document.querySelectorAll(".single-work")).filter(
    (card) =>
      card.querySelector("img") &&
      /to\s*submit/i.test(card.textContent) &&
      !/pending|rejected|approved/i.test(
        (card.querySelector(".work-footer")?.textContent || "").toLowerCase()
      )
  );
  if (exactCards.length) return exactCards;

  const statusEls = Array.from(document.querySelectorAll("body *")).filter(
    (el) => el.children.length === 0 && el.textContent.trim() === "To Submit"
  );
  const cards = [];
  for (const el of statusEls) {
    let node = el;
    for (let i = 0; i < 6 && node; i++) {
      if (node.querySelector("img") && !cards.includes(node)) {
        cards.push(node);
        break;
      }
      node = node.parentElement;
    }
  }
  return cards;
}

function getCardImage(card) {
  // "work-img" is used both as a wrapper div's class AND directly on the
  // <img> tag depending on Pngtree's current markup — cover both.
  return (
    card.querySelector("img.work-img") ||
    card.querySelector(".work-img img") ||
    card.querySelector("img")
  );
}

async function waitForPanel(timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const panel = findOpenPanel();
    if (panel) return panel;
    await sleep(200);
  }
  return null;
}

// Looks for a validation/error toast the site shows after a failed Submit
// (e.g. an illegal/sensitive keyword, missing field, etc.) so the batch
// runner can react (skip + retry) instead of getting silently stuck.
function findErrorToast() {
  const candidates = Array.from(
    document.querySelectorAll(
      ".ivu-message, .ivu-notice, .ivu-message-notice, [class*='message' i], [class*='toast' i], [class*='notice' i]"
    )
  ).filter((el) => el.offsetParent !== null && el.textContent.trim().length > 0);

  return candidates.find((el) =>
    /illegal|sensitive|violat|not allowed|forbidden|risk|reject|fail|invalid|error/i.test(
      el.textContent
    )
  );
}

async function waitForSubmitAndClose(panel) {
  const start = Date.now();
  let submitBtn = null;
  while (Date.now() - start < 4000) {
    submitBtn = findButtonByText("Submit", panel) || findButtonByText("Submit");
    if (submitBtn) break;
    await sleep(200);
  }
  if (!submitBtn) return { clicked: false, closed: false, errorText: null };

  for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
    submitBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }

  // Give the site a moment to process the submit before checking for errors.
  await sleep(900);

  const errorToast = findErrorToast();
  if (errorToast) {
    const errorText = errorToast.textContent.trim();
    // Dismiss whatever's open (error toast + panel) so the batch can retry
    // this same card cleanly on the next loop iteration.
    const openPanel = findOpenPanel();
    if (openPanel) {
      const dismissBtn =
        findPanelCloseButton(openPanel) || findButtonByText("Cancel", openPanel);
      if (dismissBtn) {
        for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
          dismissBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        }
        await sleep(500);
      }
    }
    return { clicked: true, closed: !findOpenPanel(), errorText };
  }

  // After a successful submit the panel switches into a read-only "Pending"
  // view (Submit Time appears, Status becomes "Pending") and swaps its
  // Submit/Save button for a "Cancel" button — so we now try BOTH the "✕"
  // cross AND the "Cancel" button to dismiss it, whichever appears first.
  const closeStart = Date.now();
  while (Date.now() - closeStart < 8000) {
    const openPanel = findOpenPanel();
    if (!openPanel) return { clicked: true, closed: true, errorText: null };

    const dismissBtn =
      findPanelCloseButton(openPanel) || findButtonByText("Cancel", openPanel);

    if (dismissBtn) {
      for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
        dismissBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      }
      await sleep(500);
    }
    await sleep(200);
  }
  return { clicked: true, closed: !findOpenPanel(), errorText: null };
}

function updateStatus(text) {
  const el = document.querySelector(".ai-batch-status");
  if (el) el.textContent = text;
}

async function runAutoBatch() {
  if (autoRunning) return;

  // Immediate subscription check BEFORE starting batch
  const sub = await checkSubCached(true);
  if (!sub || !sub.isValid) {
    alert("⚠️ এক্সেস সীমাবদ্ধ!\n\n" + (sub?.message || "আপনার একাউন্ট এখনও একটিভ করা হয়নি। এডমিনের অনুমোদনের অপেক্ষায় রয়েছে।"));
    updateStatus("🔒 একাউন্ট একটিভ নয় — এডমিনের অনুমোদন প্রয়োজন।");
    refreshControlPanelSub();
    return;
  }

  autoRunning = true;
  autoStopRequested = false;
  setControlPanelState("running");

  let processedCount = 0;
  let round = 0;
  let lastImgSrc = null;
  let sameCardStreak = 0;

  while (!autoStopRequested) {
    const cards = getPendingCards();
    if (!cards.length) {
      updateStatus("সব শেষ ✅ (কোনো 'To Submit' card বাকি নেই)");
      break;
    }

    round++;
    if (round > 200) {
      updateStatus("Safety stop: অনেকবার loop ঘুরেছে, ম্যানুয়ালি চেক করো।");
      break;
    }

    const card = cards[0];
    updateStatus(`Processing... (${processedCount + 1}টা হয়ে গেছে, বাকি আছে ${cards.length})`);

    const img = getCardImage(card);
    for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
      (img || card).dispatchEvent(
        new MouseEvent(type, { bubbles: true, cancelable: true, view: window })
      );
    }

    const panel = await waitForPanel();
    if (!panel) {
      updateStatus("⚠️ Panel খুলল না, থামানো হলো। Card-এ manual click করে চেক করো।");
      break;
    }

    const panelFields = findFieldsInPanel(panel);
    const curImgSrc = panelFields.img ? panelFields.img.src : null;
    if (curImgSrc && curImgSrc === lastImgSrc) {
      sameCardStreak++;
    } else {
      sameCardStreak = 0;
    }
    lastImgSrc = curImgSrc;
    if (sameCardStreak >= 3) {
      updateStatus("⚠️ একই card-এ ৩ বার আটকে গেছে (হয়তো বারবার keyword/field error) — থামানো হলো। Manual-এ চেক করো।");
      break;
    }

    ensurePanelButton(panel);
    const result = await fillPanelWithAI(panel);

    if (!result.ok) {
      updateStatus("⚠️ Error: " + result.error + " — থামানো হলো।");
      break;
    }

    await sleep(400);
    const submitResult = await waitForSubmitAndClose(panel);

    if (!submitResult.clicked) {
      updateStatus("⚠️ Submit বাটন খুঁজে পাইনি, থামানো হলো। ম্যানুয়ালি Submit করো।");
      break;
    }

    if (submitResult.errorText) {
      // Site rejected this attempt (e.g. illegal/sensitive keyword). Don't
      // stop the whole batch — dismiss and retry the SAME card fresh on the
      // next loop (new AI call + sanitizer will usually produce clean
      // keywords). sameCardStreak above caps this at 3 tries.
      updateStatus(`⚠️ Site থেকে error: "${submitResult.errorText}" — নতুন keyword দিয়ে আবার চেষ্টা করছি...`);
      await sleep(1200);
      continue;
    }

    if (!submitResult.closed) {
      updateStatus("⚠️ Submit চাপা হলো কিন্তু panel বন্ধ হয়নি — আবার চেষ্টা করছি...");
      await sleep(1000);
      continue;
    }

    processedCount++;
    updateStatus(`✅ Submitted (${processedCount}টা হয়ে গেছে)। পরের card-এ যাচ্ছি...`);
    await sleep(1800); // let the list refresh, and ease API rate limits

    if (autoStopRequested) break;
  }

  autoRunning = false;
  setControlPanelState("idle");
}

function stopAutoBatch() {
  autoStopRequested = true;
  updateStatus("থামানো হচ্ছে...");
}

// ================= Floating control panel (Run All / Stop) =================
function ensureControlPanel() {
  if (document.querySelector(".ai-batch-panel")) {
    refreshControlPanelSub();
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "ai-batch-panel";

  const title = document.createElement("div");
  title.className = "ai-batch-title";
  title.textContent = "🤖 Pngtree AI Metadata";

  const runBtn = document.createElement("button");
  runBtn.className = "ai-batch-run";
  runBtn.type = "button";
  runBtn.textContent = "▶ Auto Run All (Generate + Save)";
  stopEventFromClosingPanel(runBtn);
  runBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const sub = await checkSubCached(true);
    if (!sub || !sub.isValid) {
      alert("⚠️ এক্সেস সীমাবদ্ধ!\n\n" + (sub?.message || "আপনার একাউন্ট এখনও একটিভ করা হয়নি। এডমিনের অনুমোদনের অপেক্ষায় রয়েছে।"));
      refreshControlPanelSub();
      return;
    }
    runAutoBatch();
  });

  const stopBtn = document.createElement("button");
  stopBtn.className = "ai-batch-stop";
  stopBtn.type = "button";
  stopBtn.textContent = "⏹ Stop";
  stopBtn.disabled = true;
  stopEventFromClosingPanel(stopBtn);
  stopBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    stopAutoBatch();
  });

  const status = document.createElement("div");
  status.className = "ai-batch-status";
  status.textContent = "Ready";

  wrap.appendChild(title);
  wrap.appendChild(runBtn);
  wrap.appendChild(stopBtn);
  wrap.appendChild(status);
  document.body.appendChild(wrap);

  refreshControlPanelSub();
}

async function refreshControlPanelSub() {
  const runBtn = document.querySelector(".ai-batch-run");
  const status = document.querySelector(".ai-batch-status");
  if (!runBtn || autoRunning) return;

  const sub = await checkSubCached();
  if (!sub || !sub.isValid) {
    runBtn.classList.add("locked");
    runBtn.disabled = true;
    runBtn.textContent = "🔒 Locked (Pending Approval)";
    if (status) {
      status.textContent = "🔒 এডমিনের অনুমোদন প্রয়োজন";
      status.style.color = "#dc2626";
    }
  } else {
    runBtn.classList.remove("locked");
    runBtn.disabled = false;
    runBtn.textContent = "▶ Auto Run All (Generate + Save)";
    if (status && status.textContent.includes("অনুমোদন প্রয়োজন")) {
      status.textContent = "Ready";
      status.style.color = "";
    }
  }
}

function setControlPanelState(state) {
  const runBtn = document.querySelector(".ai-batch-run");
  const stopBtn = document.querySelector(".ai-batch-stop");
  if (!runBtn || !stopBtn) return;
  if (state === "running") {
    runBtn.disabled = true;
    runBtn.classList.add("active");
    stopBtn.disabled = false;
  } else {
    runBtn.disabled = false;
    runBtn.classList.remove("active");
    stopBtn.disabled = true;
  }
}

// ================= Watch DOM =================
const observer = new MutationObserver(() => {
  const panel = findOpenPanel();
  if (panel) ensurePanelButton(panel);
  ensureControlPanel();
});
observer.observe(document.body, { childList: true, subtree: true });

ensureControlPanel();
setControlPanelState("idle");
const initialPanel = findOpenPanel();
if (initialPanel) ensurePanelButton(initialPanel);
