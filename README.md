```markdown
# 📚 Notes-U

> A modern, collaborative platform for sharing and accessing university lecture notes, tutorial solutions, and past year papers.

**Notes-U** is a serverless web application built with **Vanilla JavaScript (ES Modules)** and **Firebase**. It features a clean, responsive UI with Dark Mode support, secure file uploads, and real-time data synchronization.

---

## ✨ Features

* **🔐 Secure Authentication**: Email/Password login, signup, and password reset flow via Firebase Auth.
* **📂 File Sharing**: Upload study materials (PDF, DOCX, PPTX, etc.) up to **25MB**.
* **🔍 Smart Discovery**: Filter notes by Academic Year, Semester, and Subject Code, or use the real-time search bar.
* **🎨 Modern UI**: Fully responsive design with Dark/Light Theme toggle and smooth animations.
* **🛡️ Robust Security**: Server-side validation for file types, sizes, and data integrity using Firestore & Storage Security Rules.
* **⚡ No Bundler Required**: Built using standard ES Modules – runs directly in modern browsers.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5, CSS3 (Variables, Grid/Flexbox), JavaScript (ES6+ Modules).
* **Backend (BaaS)**: Google Firebase.
    * **Authentication**: User management.
    * **Firestore**: NoSQL database for storing note metadata (titles, descriptions, subject codes).
    * **Storage**: Object storage for actual document files.
* **Deployment**: GitHub Pages (Ready-to-deploy `docs/` folder).

---

## 📂 Project Structure

The project uses a clean separation of concerns:

```text
Notes-U-main/
├── firebase.rules         # Firestore security rules
├── firebase.storage.rules # Storage security rules
└── docs/                  # Public web root (GitHub Pages)
    ├── css/
    │   └── app.css        # Unified styles & variables
    ├── js/
    │   ├── services/      # Reusable logic layer
    │   │   ├── firebase.js  # Firebase SDK init & API wrappers
    │   │   └── ui.js        # UI utilities (Toasts, etc.)
    │   ├── auth.js        # Login/Signup logic
    │   ├── home.js        # Dashboard & Search logic
    │   ├── upload.js      # File upload logic
    │   └── index.js       # Landing page logic
    ├── auth.html          # Auth page
    ├── home.html          # Main dashboard
    ├── upload.html        # Upload page
    └── index.html         # Landing page

```

---

## 🚀 Getting Started

### 1. Prerequisites

Since this project uses **ES Modules** (`import ... from ...`), you cannot open `.html` files directly from your file explorer. You must use a local static server.

**Option A: Node.js (Recommended)**

```bash
npx serve docs

```

**Option B: Python**

```bash
python -m http.server -d docs 8080

```

### 2. Firebase Configuration

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Authentication** (Email/Password provider).
3. Enable **Firestore Database** (Start in production mode).
4. Enable **Storage**.
5. Go to **Project Settings > General > Your apps**, select **Web**, and copy the `firebaseConfig` object.
6. Open `docs/js/services/firebase.js` and paste your config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

```

### 3. Security Rules (Crucial!)

To secure your app, copy the contents of the local rule files into your Firebase Console:

* **Firestore**: Copy content from `firebase.rules` to **Firestore > Rules**.
* **Storage**: Copy content from `firebase.storage.rules` to **Storage > Rules**.

> **Note**: These rules ensure users can only edit/delete their own notes and prevent uploading files larger than 25MB.

### 4. Create Indexes

If you see an error in the browser console regarding "indexes", click the link provided in the error message to automatically create the required Composite Index in Firestore (usually for sorting by `createdAt` while filtering by `subject_code`).

---

## 🚢 Deployment

This project is pre-configured for **GitHub Pages**.

1. Push your code to GitHub.
2. Go to **Settings > Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select the `main` branch and the `/docs` folder.
5. Click **Save**.

---

## 🛡️ Pre-Production Checklist

Before sharing your site publicly:

* **Restrict API Key**: Go to Google Cloud Console > APIs & Services > Credentials. Edit your API Key to restrict "HTTP Referrers" to your domain (e.g., `yourname.github.io` and `localhost`).
* **Verify Rules**: Ensure your Firestore and Storage rules are deployed.
* **Cache Busting**: When updating code, remember to bump the version query string in HTML files (e.g., `src="./js/home.js?v=2.1"`) to force browsers to load the new code.

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](https://www.google.com/search?q=LICENSE) for details.

```

```
