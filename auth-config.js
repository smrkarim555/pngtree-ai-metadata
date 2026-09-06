// ==============================================================================
//                PNGTREE AI METADATA - AUTH & SYSTEM CONFIG
// ==============================================================================
// এই ফাইলে আপনার Admin Email, Firebase ও GitHub ইনফো বসান।
// নিচে সুন্দর করে কমেন্ট সহ বুঝিয়ে দেওয়া আছে কোথায় কী দিতে হবে।

const APP_CONFIG = {
  // ১. আপনার Admin Gmail Address (এখানে যেই ইমেইল দিবেন শুধুমাত্র সেই একাউন্ট দিয়ে
  //    এডমিন প্যানেল দেখা যাবে এবং ইউজারদের ১ মাসের এক্সেস একটিভ/ডিএকটিভ করা যাবে)
  ADMIN_EMAIL: "smrkarim555@gmail.com",

  // ২. আপনার GitHub Repository (username/repo নাম)
  //    যেমন: "developer/pngtree-ai-metadata"
  //    এখান থেকে এক্সটেনশন নিজে নিজে নতুন আপডেট চেক করবে
  GITHUB_REPO: "smrkarim555/pngtree-ai-metadata",

  // ৩. Google OAuth Client ID (Google Login-এর জন্য)
  //    Google Cloud Console (console.cloud.google.com) থেকে Create OAuth 2.0 Client ID
  GOOGLE_CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",

  // ৪. Firebase Project Credentials (Firestore / Realtime Database)
  //    Firebase Console (console.firebase.google.com) থেকে আপনার প্রজেক্টের তথ্য দিন
  FIREBASE: {
    apiKey: "AIzaSy_YOUR_FIREBASE_API_KEY",
    projectId: "pngtree-meta",
    databaseURL: "https://pngtree-meta-default-rtdb.firebaseio.com"
  },

  // ৫. সাবস্ক্রিপশন ডিউরেশন (ডিফল্ট ৩০ দিন)
  SUBSCRIPTION_DAYS: 30,

  // ৬. ব্যাকআপ ডেমো মোড (যদি Firebase এখনও কনফিগার না থাকে, তবে টেস্ট করার জন্য true রাখতে পারেন)
  DEMO_MODE_IF_NO_CONFIG: true
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = APP_CONFIG;
}
