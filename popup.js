const $ = (id) => document.getElementById(id);

const DEFAULT_AI_PLATFORM_URL = "https://ideogram.ai";

function normalizeUrl(raw) {
  const v = (raw || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return "https://" + v;
}

// ================= Vision Provider segmented switch =================
function setProvider(value) {
  const isGroq = value === "groq";
  const isMistral = value === "mistral";
  const isGemini = value === "gemini";

  $("btnGroq").classList.toggle("active", isGroq);
  $("btnMistral").classList.toggle("active", isMistral);
  $("btnGemini").classList.toggle("active", isGemini);

  $("panelGroq").classList.toggle("active", isGroq);
  $("panelMistral").classList.toggle("active", isMistral);
  $("panelGemini").classList.toggle("active", isGemini);
}

$("btnGroq").addEventListener("click", () => setProvider("groq"));
$("btnMistral").addEventListener("click", () => setProvider("mistral"));
$("btnGemini").addEventListener("click", () => setProvider("gemini"));

// ================= Custom model input toggles =================
function setupDropdownCustomToggle(selectId, customInputId) {
  $(selectId).addEventListener("change", (e) => {
    const isCustom = e.target.value === "custom";
    $(customInputId).style.display = isCustom ? "block" : "none";
    if (isCustom) $(customInputId).focus();
  });
}

setupDropdownCustomToggle("groqModelSelect", "groqModelCustom");
setupDropdownCustomToggle("mistralModelSelect", "mistralModelCustom");
setupDropdownCustomToggle("geminiModelSelect", "geminiModelCustom");

function syncDropdownValue(selectId, customInputId, value, standardList, defaultVal) {
  const finalVal = value || defaultVal;
  if (standardList.includes(finalVal)) {
    $(selectId).value = finalVal;
    $(customInputId).style.display = "none";
    $(customInputId).value = "";
  } else {
    $(selectId).value = "custom";
    $(customInputId).style.display = "block";
    $(customInputId).value = finalVal;
  }
}

function getDropdownFinalValue(selectId, customInputId, defaultVal) {
  const sel = $(selectId).value;
  if (sel === "custom") {
    return $(customInputId).value.trim() || defaultVal;
  }
  return sel;
}

// ================= External Links =================
document.querySelectorAll(".get-key-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: link.href });
    } else {
      window.open(link.href, "_blank");
    }
  });
});

// ================= Password show/hide =================
document.querySelectorAll(".toggle-visibility").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = $(btn.dataset.target);
    const showing = target.type === "text";
    target.type = showing ? "password" : "text";
    btn.textContent = showing ? "👁" : "🙈";
  });
});

// ================= Authentication & 1-Month Subscription UI =================
let allUsersCache = [];

async function updateAuthUI() {
  const sub = await AuthService.checkSubscriptionStatus();
  const loggedOutView = $("loggedOutView");
  const loggedInView = $("loggedInView");
  const adminCard = $("adminCard");

  if (!sub.user) {
    loggedOutView.style.display = "block";
    loggedInView.style.display = "none";
    adminCard.classList.remove("show");
    return;
  }

  // User is logged in
  loggedOutView.style.display = "none";
  loggedInView.style.display = "block";

  $("userName").textContent = sub.user.name || "User";
  $("userEmail").textContent = sub.user.email || "";
  $("userAvatar").src =
    sub.user.picture ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(sub.user.email || "user")}`;

  const badge = $("subBadge");
  const msg = $("subMessage");
  badge.className = "badge";

  if (sub.isAdmin) {
    badge.classList.add("badge-admin");
    badge.textContent = "👑 Admin (Unlimited)";
    msg.textContent = "Admin account active. You can activate and manage any user.";
    adminCard.classList.add("show");
    loadAdminUsers();
  } else if (sub.status === "device_mismatch") {
    badge.classList.add("badge-blocked");
    badge.textContent = "🔒 Device Locked";
    msg.textContent = "⚠️ This account is registered on another device. Only 1 device allowed per account. Contact admin to reset your device.";
    adminCard.classList.remove("show");
  } else if (sub.status === "active") {
    badge.classList.add("badge-active");
    badge.textContent = `✅ Active (${sub.daysLeft} days left)`;
    msg.textContent = `Your 1-month subscription is active. Time left: ${sub.daysLeft} days.`;
    adminCard.classList.remove("show");
  } else if (sub.status === "expired") {
    badge.classList.add("badge-expired");
    badge.textContent = "❌ Expired";
    msg.textContent = "Your 1-month subscription has expired. Contact admin to renew.";
    adminCard.classList.remove("show");
  } else if (sub.status === "blocked") {
    badge.classList.add("badge-blocked");
    badge.textContent = "⛔ Blocked";
    msg.textContent = "Your account has been temporarily blocked.";
    adminCard.classList.remove("show");
  } else {
    badge.classList.add("badge-pending");
    badge.textContent = "⏳ Pending Approval";
    msg.textContent = "Your account is pending activation. Waiting for admin approval.";
    adminCard.classList.remove("show");
  }

  // Update device badge
  const devBadge = $("deviceBadge");
  if (devBadge) {
    if (sub.isAdmin) {
      devBadge.textContent = "👑 Any Device (Admin)";
      devBadge.style.background = "#e0e7ff";
      devBadge.style.color = "#4338ca";
    } else if (sub.status === "device_mismatch") {
      devBadge.textContent = "❌ Another Device (Blocked)";
      devBadge.style.background = "#fee2e2";
      devBadge.style.color = "#dc2626";
    } else if (sub.user?.boundDeviceId) {
      devBadge.textContent = "🔒 Bound to this PC";
      devBadge.style.background = "#dcfce7";
      devBadge.style.color = "#15803d";
    } else {
      devBadge.textContent = "🔓 Not Bound Yet (Will bind on next use)";
      devBadge.style.background = "#f1f5f9";
      devBadge.style.color = "#64748b";
    }
  }
}

// User Google Sign-In Handler
$("googleSignInBtn").addEventListener("click", async () => {
  const emailInput = $("loginEmailInput");
  const errDiv = $("loginErrorMsg");
  const email = emailInput ? emailInput.value.trim() : "";

  if (errDiv) errDiv.style.display = "none";

  if (!email) {
    if (errDiv) {
      errDiv.innerText = "⚠️ Please enter your Gmail address (e.g. user@gmail.com)";
      errDiv.style.display = "block";
    }
    if (emailInput) emailInput.focus();
    return;
  }

  const btn = $("googleSignInBtn");
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "<span>⏳ Connecting to Firebase...</span>";

  try {
    await AuthService.loginWithEmail(email);
    await updateAuthUI();
  } catch (err) {
    if (errDiv) {
      errDiv.innerText = "Login error: " + err.message;
      errDiv.style.display = "block";
    } else {
      alert("Login error: " + err.message);
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
});

// Auto update UI when storage changes (e.g. login from tab)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.currentUser) {
    updateAuthUI();
  }
});

// Sign-Out Handler
$("signOutBtn").addEventListener("click", async () => {
  if (confirm("Are you sure you want to log out?")) {
    await AuthService.signOut();
    await updateAuthUI();
  }
});

// ================= Admin Panel Logic =================
async function loadAdminUsers() {
  const listEl = $("adminUserList");
  listEl.innerHTML = "<div style='text-align:center; padding:10px; color:#888;'>Loading user list...</div>";

  try {
    const users = await AuthService.getAllUsers();
    allUsersCache = users;
    renderAdminUsers(users);
  } catch (err) {
    listEl.innerHTML = `<div style='color:red; padding:6px;'>Error: ${err.message}</div>`;
  }
}

function renderAdminUsers(users) {
  const listEl = $("adminUserList");
  listEl.innerHTML = "";

  const query = ($("adminSearchInput").value || "").trim().toLowerCase();
  const filtered = users.filter((u) =>
    (u.email || "").toLowerCase().includes(query) ||
    (u.name || "").toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    listEl.innerHTML = "<div style='text-align:center; padding:10px; color:#888;'>No users found.</div>";
    return;
  }

  filtered.forEach((u) => {
    const item = document.createElement("div");
    item.className = "user-item";

    let statusClass = "badge-pending";
    let statusText = "Pending";
    let daysLeftText = "";

    if (u.role === "admin") {
      statusClass = "badge-admin";
      statusText = "Admin";
    } else if (u.status === "blocked") {
      statusClass = "badge-blocked";
      statusText = "Blocked";
    } else if (u.status === "active" && u.subscriptionExpiresAt > Date.now()) {
      statusClass = "badge-active";
      const days = Math.max(1, Math.ceil((u.subscriptionExpiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
      statusText = `Active (${days}d)`;
      daysLeftText = `Expires: ${new Date(u.subscriptionExpiresAt).toLocaleDateString()}`;
    } else if (u.subscriptionExpiresAt && u.subscriptionExpiresAt <= Date.now()) {
      statusClass = "badge-expired";
      statusText = "Expired";
      daysLeftText = `Expired: ${new Date(u.subscriptionExpiresAt).toLocaleDateString()}`;
    } else {
      statusClass = "badge-pending";
      statusText = "Pending";
    }

    const isDeviceLocked = !!u.boundDeviceId;
    const deviceLabel = isDeviceLocked
      ? `<span style="color:#0284c7;font-weight:600;">🔒 Device: ${u.boundDeviceId.substring(0, 14)}...</span>`
      : `<span style="color:#64748b;">🔓 Device: Unbound</span>`;

    item.innerHTML = `
      <div class="user-item-header">
        <span class="user-item-email" title="${u.email}">${u.email}</span>
        <span class="badge ${statusClass}">${statusText}</span>
      </div>
      <div class="user-item-details">
        <span>Name: ${u.name || "N/A"}</span> ${daysLeftText ? `• <span>${daysLeftText}</span>` : ""}
        <div style="font-size:10.5px; margin-top:2px;">${deviceLabel}</div>
      </div>
      ${
        u.role === "admin"
          ? ""
          : `
        <div class="user-actions" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;">
          <button class="act-btn act-activate" data-email="${u.email}">⚡ +30d</button>
          <button class="act-btn act-custom" data-email="${u.email}" style="background:#0d9488;color:#fff;" title="Add custom days (e.g. 7, 15, 60, 90)">📅 Custom Days</button>
          <button class="act-btn act-reset-device" data-email="${u.email}" style="background:#0284c7;color:#fff;" title="Unbind device so user can connect another device">🔄 Reset Device</button>
          <button class="act-btn act-block" data-email="${u.email}">⛔ Block</button>
          <button class="act-btn act-delete" data-email="${u.email}" style="background:#ef4444;color:#fff;" title="Delete User">🗑️</button>
        </div>
      `
      }
    `;

    // Bind action events
    const actBtn = item.querySelector(".act-activate");
    if (actBtn) {
      actBtn.addEventListener("click", async () => {
        actBtn.disabled = true;
        actBtn.textContent = "⏳...";
        await AuthService.activateUserOneMonth(u.email, 30);
        await loadAdminUsers();
      });
    }

    const customBtn = item.querySelector(".act-custom");
    if (customBtn) {
      customBtn.addEventListener("click", async () => {
        const input = prompt(`How many days do you want to add for ${u.email}?\n(e.g. 7, 15, 30, 60, 90, 365):`, "30");
        if (input !== null) {
          const days = parseInt(input.trim(), 10);
          if (isNaN(days) || days <= 0) {
            alert("Please enter a valid positive number of days (e.g. 15, 30).");
            return;
          }
          customBtn.disabled = true;
          customBtn.textContent = "⏳...";
          await AuthService.activateUserOneMonth(u.email, days);
          await loadAdminUsers();
        }
      });
    }

    const resetDevBtn = item.querySelector(".act-reset-device");
    if (resetDevBtn) {
      resetDevBtn.addEventListener("click", async () => {
        if (confirm(`Reset device lock for ${u.email}? This will allow the user to bind a new device/PC.`)) {
          resetDevBtn.disabled = true;
          resetDevBtn.textContent = "⏳...";
          await AuthService.resetUserDevice(u.email);
          await loadAdminUsers();
        }
      });
    }

    const blockBtn = item.querySelector(".act-block");
    if (blockBtn) {
      blockBtn.addEventListener("click", async () => {
        if (confirm(`Do you want to block ${u.email}?`)) {
          blockBtn.disabled = true;
          blockBtn.textContent = "⏳...";
          await AuthService.deactivateUser(u.email);
          await loadAdminUsers();
        }
      });
    }

    const delBtn = item.querySelector(".act-delete");
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        if (confirm(`Are you sure you want to completely DELETE user ${u.email}?`)) {
          delBtn.disabled = true;
          delBtn.textContent = "⏳...";
          await AuthService.deleteUser(u.email);
          await loadAdminUsers();
        }
      });
    }

    listEl.appendChild(item);
  });
}

$("adminRefreshBtn").addEventListener("click", loadAdminUsers);
$("adminSearchInput").addEventListener("input", () => renderAdminUsers(allUsersCache));

// ================= GitHub Auto-Update Check =================
let currentUpdateIdentifier = null;

async function checkUpdateBanner(isManual = false) {
  const checkBtn = $("manualCheckUpdateBtn");
  const checkIcon = $("checkUpdateIcon");
  const checkText = $("checkUpdateText");
  const statusMsg = $("updateStatusMsg");
  const banner = $("updateBanner");
  const verText = $("updateVersion");
  const commitMsg = $("updateCommitMsg");
  const badge = $("currentVersionBadge");

  const currentVer = chrome.runtime.getManifest().version;
  if (badge) badge.textContent = `v${currentVer}`;

  if (isManual && checkBtn) {
    checkBtn.disabled = true;
    checkText.textContent = "Checking GitHub...";
    if (checkIcon) checkIcon.textContent = "⏳";
  }

  try {
    const update = await AuthService.checkGitHubUpdate();
    if (update && update.hasUpdate) {
      const updateId = (update.latestCommit && update.latestCommit.sha) || update.latestVersion || "latest";
      currentUpdateIdentifier = updateId;

      // Check if user already dismissed this specific update notification
      const saved = await chrome.storage.local.get(["dismissedUpdate"]);
      const isDismissed = saved.dismissedUpdate === updateId;

      verText.textContent = `v${update.latestVersion} Available!`;
      commitMsg.textContent = "Run update.bat inside the extension folder to update.";
      commitMsg.style.display = "block";

      // Show banner if not dismissed or if user clicked manual check
      if (isManual || !isDismissed) {
        banner.style.display = "flex";
      }

      if (statusMsg) {
        statusMsg.style.display = "block";
        statusMsg.style.background = "#fef3c7";
        statusMsg.style.color = "#92400e";
        statusMsg.innerHTML = `🚀 <strong>Update available (v${update.latestVersion})!</strong> Run <code>update.bat</code> inside extension folder to update.`;
      }
    } else {
      banner.style.display = "none";
      if (isManual && statusMsg) {
        statusMsg.style.display = "block";
        statusMsg.style.background = "#dcfce7";
        statusMsg.style.color = "#15803d";
        statusMsg.innerHTML = "✅ You are running the latest version!";
        setTimeout(() => {
          if (statusMsg) statusMsg.style.display = "none";
        }, 3500);
      }
    }
  } catch (e) {
    console.warn("Update check failed:", e);
    if (isManual && statusMsg) {
      statusMsg.style.display = "block";
      statusMsg.style.background = "#fee2e2";
      statusMsg.style.color = "#b91c1c";
      statusMsg.innerHTML = `⚠️ Check failed: ${e.message}`;
    }
  } finally {
    if (isManual && checkBtn) {
      checkBtn.disabled = false;
      checkText.textContent = "Check for Updates";
      if (checkIcon) checkIcon.textContent = "🔄";
    }
  }
}

// Close button on update banner (Dismiss notification)
const closeBannerBtn = $("closeUpdateBannerBtn");
if (closeBannerBtn) {
  closeBannerBtn.addEventListener("click", async () => {
    $("updateBanner").style.display = "none";
    if (currentUpdateIdentifier) {
      await chrome.storage.local.set({ dismissedUpdate: currentUpdateIdentifier });
    }
    if (chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: "" });
    }
  });
}



// Bind manual check button
const manualBtn = $("manualCheckUpdateBtn");
if (manualBtn) {
  manualBtn.addEventListener("click", () => checkUpdateBanner(true));
}

// ================= Load Saved Settings =================
async function load() {
  const s = await chrome.storage.local.get([
    "provider", "groqKey", "groqModel", "mistralKey", "mistralModel",
    "geminiKey", "geminiModel", "aiPlatformUrl",
  ]);

  const provider = s.provider || "gemini";
  setProvider(provider);

  $("groqKey").value = s.groqKey || "";
  const groqStandards = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.2-90b-vision-preview",
    "llama-3.2-11b-vision-preview",
  ];
  syncDropdownValue(
    "groqModelSelect",
    "groqModelCustom",
    s.groqModel,
    groqStandards,
    "meta-llama/llama-4-scout-17b-16e-instruct"
  );

  $("mistralKey").value = s.mistralKey || "";
  const mistralStandards = [
    "pixtral-large-latest",
    "pixtral-12b-2409",
  ];
  syncDropdownValue(
    "mistralModelSelect",
    "mistralModelCustom",
    s.mistralModel,
    mistralStandards,
    "pixtral-large-latest"
  );

  $("geminiKey").value = s.geminiKey || "";
  const geminiStandards = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];
  syncDropdownValue(
    "geminiModelSelect",
    "geminiModelCustom",
    s.geminiModel,
    geminiStandards,
    "gemini-2.5-flash"
  );

  $("aiPlatformUrl").value = s.aiPlatformUrl || DEFAULT_AI_PLATFORM_URL;

  // Initialize Auth & Updates
  await updateAuthUI();
  await checkUpdateBanner();
}

// ================= Save Settings =================
let saveResetTimer = null;

$("save").addEventListener("click", async () => {
  let activeProvider = "gemini";
  if ($("btnGroq").classList.contains("active")) activeProvider = "groq";
  else if ($("btnMistral").classList.contains("active")) activeProvider = "mistral";
  else if ($("btnGemini").classList.contains("active")) activeProvider = "gemini";

  const normalizedUrl = normalizeUrl($("aiPlatformUrl").value) || DEFAULT_AI_PLATFORM_URL;
  $("aiPlatformUrl").value = normalizedUrl;

  const groqModelFinal = getDropdownFinalValue(
    "groqModelSelect",
    "groqModelCustom",
    "meta-llama/llama-4-scout-17b-16e-instruct"
  );
  const mistralModelFinal = getDropdownFinalValue(
    "mistralModelSelect",
    "mistralModelCustom",
    "pixtral-large-latest"
  );
  const geminiModelFinal = getDropdownFinalValue(
    "geminiModelSelect",
    "geminiModelCustom",
    "gemini-2.5-flash"
  );

  await chrome.storage.local.set({
    provider: activeProvider,
    groqKey: $("groqKey").value.trim(),
    groqModel: groqModelFinal,
    mistralKey: $("mistralKey").value.trim(),
    mistralModel: mistralModelFinal,
    geminiKey: $("geminiKey").value.trim(),
    geminiModel: geminiModelFinal,
    aiPlatformUrl: normalizedUrl,
  });

  const btn = $("save");
  const label = $("saveLabel");
  const icon = $("saveIcon");
  btn.classList.add("saved");
  icon.textContent = "✅";
  label.textContent = "Saved!";

  const status = $("status");
  status.classList.add("show");

  clearTimeout(saveResetTimer);
  saveResetTimer = setTimeout(() => {
    btn.classList.remove("saved");
    icon.textContent = "💾";
    label.textContent = "Save Settings";
    status.classList.remove("show");
  }, 1800);
});

load();
