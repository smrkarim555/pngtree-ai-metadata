// ==============================================================================
//                PNGTREE AI METADATA - AUTH & SYSTEM CONFIG
// ==============================================================================

const APP_CONFIG = {
  // ১. আপনার Admin Gmail Address (এখানে যেই ইমেইল থাকবে সে Admin হিসেবে ফুল কন্ট্রোল পাবে)
  ADMIN_EMAIL: "smrkarim555@gmail.com",

  // ২. আপনার GitHub Repository (username/repo নাম)
  GITHUB_REPO: "smrkarim555/pngtree-ai-metadata",

  // ৩. Google OAuth Client ID (Google Login-এর জন্য)
  GOOGLE_CLIENT_ID: "916776251769-9cale3jpkbj83m4s0q55itkrmhj70sn2.apps.googleusercontent.com",

  // ৪. Firebase Project Credentials
  FIREBASE: {
    apiKey: "AIzaSyBZMNCmA0sCiR7G0OEruoIrqK1byIDTS7U",
    authDomain: "pngtree-meta.firebaseapp.com",
    projectId: "pngtree-meta",
    databaseURL: "https://pngtree-meta-default-rtdb.firebaseio.com",
    appId: "1:916776251769:web:2328c636fa8dc045763fa8"
  },

  // ৫. সাবস্ক্রিপশন ডিউরেশন (ডিফল্ট ৩০ দিন / ১ মাস)
  SUBSCRIPTION_DAYS: 30
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = APP_CONFIG;
}
