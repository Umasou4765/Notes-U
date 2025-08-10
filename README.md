# Notes-U (Frontend Only + Firebase)

A simple university notes sharing platform (static frontend + Firebase).

Features:
- Firebase Authentication (username mapped to pseudo email)
- Firestore (users + notes metadata)
- Firebase Storage (file uploads)
- Client-side filtering & search

## Setup

1. Create a Firebase project.
2. Enable:
   - Authentication (Email/Password)
   - Firestore
   - Storage
3. In Firebase Console → Project Settings → Your Apps → Web, copy the config and paste it into `docs/firebase-init.js`.
4. Adjust security rules (see below).
5. Deploy via GitHub Pages:
   - Settings → Pages → Deploy from `main` branch `/docs`.

## Firestore Rules (basic example — refine for production)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update, delete: if request.auth != null && request.auth.uid == userId;
    }

    // Username mapping documents (public existence check avoided here).
    match /usernames/{uname} {
      allow read: if false; // Prevent enumeration of usernames.
      allow create: if request.auth != null;
      allow update, delete: if false; // Immutable mapping (optional).
    }

    match /notes/{noteId} {
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
      allow read, update, delete:
        if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

## Storage Rules (basic example)

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

Serve the `docs/` folder with any static server:

```
npx serve docs
# or
python -m http.server -d docs 8080
```

## Notes

- Pseudo email format: `<username>@notes-u.fake` (no real email delivery).
- Username validation: only `[a-z0-9._-]`, 3–30 chars (adjust in `firebase-init.js`).
- Max upload size: 25MB (client-side enforced).
- For production: add rate limiting, content moderation, robust validation, server timestamps, and indexing.

## License

MIT — see `LICENSE`.