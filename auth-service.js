// ==============================================================================
//                PNGTREE AI METADATA - AUTH & SUBSCRIPTION SERVICE
// ==============================================================================

function sanitizeEmailKey(email) {
  return (email || "").toLowerCase().replace(/\./g, ",");
}

function desanitizeEmailKey(key) {
  return (key || "").replace(/,/g, ".");
}

const AuthService = {
  // Check if current user is admin
  isAdmin(email) {
    if (!email) return false;
    return (
      (APP_CONFIG.ADMIN_EMAIL || "").trim().toLowerCase() ===
      email.trim().toLowerCase()
    );
  },

  // Get current logged-in user from local storage
  async getCurrentUser() {
    const res = await chrome.storage.local.get(["currentUser", "allUsersMock"]);
    return res.currentUser || null;
  },

  // Save current user to local storage
  async setCurrentUser(userData) {
    await chrome.storage.local.set({ currentUser: userData });
  },

  // Instant Gmail login
  async loginWithEmail(email) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("সঠিক Gmail ঠিকানা লিখুন (যেমন: user@gmail.com)।");
    }

    const mockName = cleanEmail.split("@")[0];
    const profile = {
      sub: "user_" + Math.random().toString(36).substring(7),
      email: cleanEmail,
      name: mockName.charAt(0).toUpperCase() + mockName.slice(1),
      picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`
    };

    return await this.handleUserRecord(profile);
  },

  // Sign in with Google (Opens real Google Accounts login page)
  async signInWithGoogle() {
    return new Promise(async (resolve, reject) => {
      try {
        const apiKey = APP_CONFIG.FIREBASE.apiKey;
        const projectId = APP_CONFIG.FIREBASE.projectId;
        const continueUri = `https://${projectId}.firebaseapp.com/__/auth/handler`;

        // 1. Get official Google Accounts sign-in URI from Firebase Identity
        const authUriRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              providerId: "google.com",
              continueUri: continueUri
            })
          }
        );

        if (!authUriRes.ok) {
          throw new Error("Google Login লিংক তৈরি করা যায়নি।");
        }

        const { authUri } = await authUriRes.json();
        if (!authUri) throw new Error("Google OAuth URL পাওয়া যায়নি।");

        // 2. Launch Chrome web auth flow - directly opens accounts.google.com!
        chrome.identity.launchWebAuthFlow(
          { url: authUri, interactive: true },
          async (responseUrl) => {
            if (chrome.runtime.lastError || !responseUrl) {
              const errMsg = chrome.runtime.lastError?.message || "Google Sign-In বাতিল করা হয়েছে।";
              return reject(new Error(errMsg));
            }

            try {
              // 3. Extract Google id_token from responseUrl
              const hash = responseUrl.split("#")[1] || "";
              const search = responseUrl.split("?")[1] || "";
              const params = new URLSearchParams(hash || search);
              const idToken = params.get("id_token");

              let profile = null;
              if (idToken) {
                // Decode Google JWT payload safely
                const payloadBase64 = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
                const payloadJson = decodeURIComponent(
                  atob(payloadBase64)
                    .split("")
                    .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                    .join("")
                );
                const jwt = JSON.parse(payloadJson);
                profile = {
                  sub: jwt.sub,
                  email: (jwt.email || "").toLowerCase(),
                  name: jwt.name || jwt.given_name || "User",
                  picture: jwt.picture || ""
                };
              }

              if (!profile || !profile.email) {
                throw new Error("Google থেকে প্রোফাইল তথ্য পাওয়া যায়নি।");
              }

              // 4. Save to Firebase Realtime Database
              const user = await AuthService.handleUserRecord(profile);
              resolve(user);
            } catch (err) {
              reject(err);
            }
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  },

  // Save or fetch user record from Firebase / Local store
  async handleUserRecord(profile) {
    const email = profile.email.toLowerCase();
    const isAdmin = this.isAdmin(email);
    const sanitizedKey = sanitizeEmailKey(email);

    let existingData = await this.fetchUserFromDatabase(sanitizedKey);

    let userData;
    if (existingData) {
      userData = {
        ...existingData,
        name: profile.name || existingData.name,
        picture: profile.picture || existingData.picture,
        lastLoginAt: Date.now()
      };
      // If admin, ensure active
      if (isAdmin) {
        userData.role = "admin";
        userData.status = "active";
        userData.subscriptionExpiresAt = Date.now() + 3650 * 86400000;
      }
    } else {
      // New user registration
      userData = {
        email: email,
        name: profile.name || "User",
        picture: profile.picture || "",
        role: isAdmin ? "admin" : "user",
        // Admin gets auto-activated for 10 years, normal users get 'pending'
        status: isAdmin ? "active" : "pending",
        activatedAt: isAdmin ? Date.now() : null,
        subscriptionExpiresAt: isAdmin ? Date.now() + 3650 * 86400000 : null,
        createdAt: Date.now(),
        lastLoginAt: Date.now()
      };
    }

    await this.saveUserToDatabase(sanitizedKey, userData);
    await this.setCurrentUser(userData);
    return userData;
  },

  // Fetch single user from DB
  async fetchUserFromDatabase(sanitizedKey) {
    const fb = APP_CONFIG.FIREBASE;
    const isFirebaseConfigured =
      fb &&
      fb.databaseURL &&
      !fb.databaseURL.includes("your-firebase-project-id");

    if (isFirebaseConfigured) {
      try {
        const url = `${fb.databaseURL.replace(/\/$/, "")}/users/${sanitizedKey}.json`;
        const res = await fetch(url);
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn("Firebase fetch error:", err);
      }
    }

    // Fallback: Local Chrome Storage store
    const store = (await chrome.storage.local.get(["allUsersMock"])).allUsersMock || {};
    return store[sanitizedKey] || null;
  },

  // Save single user to DB
  async saveUserToDatabase(sanitizedKey, userData) {
    const fb = APP_CONFIG.FIREBASE;
    const isFirebaseConfigured =
      fb &&
      fb.databaseURL &&
      !fb.databaseURL.includes("your-firebase-project-id");

    if (isFirebaseConfigured) {
      try {
        const url = `${fb.databaseURL.replace(/\/$/, "")}/users/${sanitizedKey}.json`;
        await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData)
        });
      } catch (err) {
        console.warn("Firebase save error:", err);
      }
    }

    // Also sync to local storage
    const store = (await chrome.storage.local.get(["allUsersMock"])).allUsersMock || {};
    store[sanitizedKey] = userData;
    await chrome.storage.local.set({ allUsersMock: store });
  },

  // Check current user's subscription status
  async checkSubscriptionStatus() {
    let user = await this.getCurrentUser();
    if (!user) {
      return {
        isValid: false,
        status: "not_logged_in",
        message: "দয়া করে প্রথমে Google দিয়ে লগইন করুন।"
      };
    }

    // Refresh user state from database in background
    try {
      const sanitizedKey = sanitizeEmailKey(user.email);
      const fresh = await this.fetchUserFromDatabase(sanitizedKey);
      if (fresh) {
        user = fresh;
        await this.setCurrentUser(user);
      }
    } catch (e) {}

    // Admin is always valid
    if (this.isAdmin(user.email) || user.role === "admin") {
      return {
        isValid: true,
        status: "active",
        isAdmin: true,
        daysLeft: 9999,
        user
      };
    }

    if (user.status === "blocked") {
      return {
        isValid: false,
        status: "blocked",
        message: "আপনার একাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে। এডমিনের সাথে যোগাযোগ করুন।",
        user
      };
    }

    if (user.status === "pending" || !user.subscriptionExpiresAt) {
      return {
        isValid: false,
        status: "pending",
        message: "আপনার একাউন্ট এখনও একটিভ করা হয়নি। এডমিনের অনুমোদনের অপেক্ষায় রয়েছে।",
        user
      };
    }

    const now = Date.now();
    if (now > user.subscriptionExpiresAt) {
      return {
        isValid: false,
        status: "expired",
        message: "আপনার ১ মাসের সাবস্ক্রিপশনের মেয়াদ শেষ হয়ে গেছে। রিনিউ করতে এডমিনের সাথে যোগাযোগ করুন।",
        user
      };
    }

    const msLeft = user.subscriptionExpiresAt - now;
    const daysLeft = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

    return {
      isValid: true,
      status: "active",
      daysLeft,
      user
    };
  },

  // Admin function: Get all registered users
  async getAllUsers() {
    const currentUser = await this.getCurrentUser();
    if (!this.isAdmin(currentUser?.email)) {
      throw new Error("শুধুমাত্র Admin এই লিস্ট দেখতে পারবেন।");
    }

    const fb = APP_CONFIG.FIREBASE;
    const isFirebaseConfigured =
      fb &&
      fb.databaseURL &&
      !fb.databaseURL.includes("your-firebase-project-id");

    let usersMap = {};
    if (isFirebaseConfigured) {
      try {
        const url = `${fb.databaseURL.replace(/\/$/, "")}/users.json`;
        const res = await fetch(url);
        if (res.ok) {
          usersMap = (await res.json()) || {};
        }
      } catch (err) {
        console.warn("Firebase list error:", err);
      }
    }

    // Merge with local mock store
    const localStore =
      (await chrome.storage.local.get(["allUsersMock"])).allUsersMock || {};
    usersMap = { ...localStore, ...usersMap };

    // Convert to sorted array
    return Object.values(usersMap).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  // Admin function: Activate user for 1 month (30 days)
  async activateUserOneMonth(targetEmail) {
    const currentUser = await this.getCurrentUser();
    if (!this.isAdmin(currentUser?.email)) {
      throw new Error("শুধুমাত্র Admin ইউজার একটিভ করতে পারবেন।");
    }

    const sanitizedKey = sanitizeEmailKey(targetEmail);
    const existing = (await this.fetchUserFromDatabase(sanitizedKey)) || {
      email: targetEmail,
      createdAt: Date.now()
    };

    const days = APP_CONFIG.SUBSCRIPTION_DAYS || 30;
    const durationMs = days * 24 * 60 * 60 * 1000;

    // If existing expiry is still in future, extend from that date; else from now
    const baseTime =
      existing.subscriptionExpiresAt && existing.subscriptionExpiresAt > Date.now()
        ? existing.subscriptionExpiresAt
        : Date.now();

    existing.status = "active";
    existing.activatedAt = Date.now();
    existing.subscriptionExpiresAt = baseTime + durationMs;

    await this.saveUserToDatabase(sanitizedKey, existing);
    return existing;
  },

  // Admin function: Deactivate user
  async deactivateUser(targetEmail) {
    const currentUser = await this.getCurrentUser();
    if (!this.isAdmin(currentUser?.email)) {
      throw new Error("শুধুমাত্র Admin ইউজার ব্লক করতে পারবেন।");
    }

    const sanitizedKey = sanitizeEmailKey(targetEmail);
    const existing = await this.fetchUserFromDatabase(sanitizedKey);
    if (!existing) return null;

    existing.status = "blocked";
    existing.subscriptionExpiresAt = 0;

    await this.saveUserToDatabase(sanitizedKey, existing);
    return existing;
  },

  // Logout
  async signOut() {
    await chrome.storage.local.remove(["currentUser"]);
    if (chrome.identity && chrome.identity.clearAllCachedAuthTokens) {
      chrome.identity.clearAllCachedAuthTokens(() => {});
    }
  },

  // GitHub Auto-Update Checker
  async checkGitHubUpdate() {
    const repo = APP_CONFIG.GITHUB_REPO;
    if (!repo || repo.includes("yourusername")) {
      return { hasUpdate: false, reason: "repo_not_configured" };
    }

    try {
      const currentVersion = chrome.runtime.getManifest().version;
      const url = `https://raw.githubusercontent.com/${repo}/main/manifest.json?_t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) return { hasUpdate: false, reason: "fetch_failed" };

      const remoteManifest = await res.json();
      const remoteVersion = remoteManifest.version;

      if (this.isVersionHigher(remoteVersion, currentVersion)) {
        return {
          hasUpdate: true,
          currentVersion,
          latestVersion: remoteVersion,
          releaseUrl: `https://github.com/${repo}/releases`
        };
      }
      return { hasUpdate: false, currentVersion, latestVersion: remoteVersion };
    } catch (e) {
      return { hasUpdate: false, error: e.message };
    }
  },

  isVersionHigher(remote, current) {
    const rParts = (remote || "").split(".").map((n) => parseInt(n, 10) || 0);
    const cParts = (current || "").split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
      const r = rParts[i] || 0;
      const c = cParts[i] || 0;
      if (r > c) return true;
      if (r < c) return false;
    }
    return false;
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = AuthService;
}
