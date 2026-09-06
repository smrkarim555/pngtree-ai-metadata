// ==============================================================================
//                PNGTREE AI METADATA - AUTH & SYSTEM CONFIG
// ==============================================================================

const APP_CONFIG = {
  // 1. Admin Gmail Address (Full administrative control and user activation privileges)
  ADMIN_EMAIL: "smrkarim555@gmail.com",

  // 2. GitHub Repository (username/repo for auto-updates)
  GITHUB_REPO: "smrkarim555/pngtree-ai-metadata",
  CURRENT_COMMIT: "2468e05",

  // 3. Google OAuth Client ID (for Google Accounts sign-in)
  GOOGLE_CLIENT_ID: "916776251769-9cale3jpkbj83m4s0q55itkrmhj70sn2.apps.googleusercontent.com",

  // 4. Firebase Project Credentials
  FIREBASE: {
    apiKey: "AIzaSyBZMNCmA0sCiR7G0OEruoIrqK1byIDTS7U",
    authDomain: "pngtree-meta.firebaseapp.com",
    projectId: "pngtree-meta",
    databaseURL: "https://pngtree-meta-default-rtdb.firebaseio.com",
    appId: "1:916776251769:web:2328c636fa8dc045763fa8"
  },

  // 5. Subscription Duration (Default 30 days / 1 month)
  SUBSCRIPTION_DAYS: 30
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = APP_CONFIG;
}
