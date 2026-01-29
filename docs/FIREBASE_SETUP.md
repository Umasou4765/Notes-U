Firebase setup notes (short)

1) Firestore Security Rules

- Replace your Firestore rules with the provided `docs/firebase.rules` content.
- Key points:
  - `read` is allowed for signed-in users so the platform is "shared".
  - `create` requires the document to be correctly formed and `uid` must match the authenticated user.
  - `update` / `delete` only allowed for the owner (`resource.data.uid == request.auth.uid`).

2) Composite Index

If you query both `where("subject_code","==", ...)` and `orderBy("createdAt","desc")` (as implemented in `fetchNotes`), Firestore will prompt an error with a link to create the required composite index. Open that link and create the index in Firebase Console, or create it via the Firebase CLI (see below).

Example index (Console will suggest exact fields and directions):
- Collection: `notes`
- Fields: `subject_code` (ASC) and `createdAt` (DESC), or as the console suggests.

CLI example to create index (optional):
- Add an `indexes.json` to your project or use `firebase deploy --only firestore:indexes` after configuring `firebase.json`.

3) Rules deployment

- You can paste `docs/firebase.rules` in Firestore Console > Rules and publish.
- For CI / repeatable deploys, use Firebase CLI: `firebase deploy --only firestore:rules`.

4) Notes

- We store `storage_path` in the note document to make deletion of storage objects reliable from the client.
- Keep the `notes` collection schema stable as per the rules to prevent malicious or malformed documents being created.