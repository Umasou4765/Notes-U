# Notes-U (Frontend Only + Firebase)

This is a rebooted version hosted on **GitHub Pages** with:
- Firebase Authentication
- Firestore (notes metadata + user profiles)
- Firebase Storage (optional note files)

## Setup

1. Create Firebase project.
2. Enable:
   - Authentication (Email/Password)
   - Firestore
   - Storage
3. Copy your web config into `docs/firebase-init.js`.
4. Adjust security rules (below).
5. Commit & push.  
6. GitHub Settings -> Pages -> Deploy from `main` branch `/docs`.

## Firestore Rules (basic)

```
// Firestore Rules (simplistic; refine for production)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update, delete: if request.auth != null && request.auth.uid == userId;
    }

    match /notes/{noteId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read, update, delete:
        if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

## Storage Rules (basic)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /notes/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Development

You can run locally by serving the `docs/` folder with any static server (e.g., `npx serve docs`).
