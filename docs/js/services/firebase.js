/*
 * File: docs/js/services/firebase.js
 * Description: Firebase services wrapper - initializes Firebase app and provides auth, Firestore, and Storage helper functions used across the app.
 * Notes: Exported helpers include authentication, note CRUD, and storage helpers. Friendly errors are mapped here.
 */

import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  limit,
  startAfter,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytesResumable,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
const firebaseConfig = {
  apiKey: "AIzaSyALfKHvKnsXLDDYASilyGwHA9ycVpbzmuc",
  authDomain: "notes-u.firebaseapp.com",
  projectId: "notes-u",
  storageBucket: "notes-u.appspot.com",
  messagingSenderId: "694892183955",
  appId: "1:694892183955:web:6922cb6de148a155642866",
  measurementId: "G-RXBBXBRBHT"
};

function initApp() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getApp();
}

const app = initApp();
export const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
export function friendlyError(err) {
  if (!err) return "Unknown error.";
  const code = (err.code || err.message || "").toLowerCase();
  const map = {
    "auth/invalid-email": "Email address is invalid.",
    "auth/user-not-found": "No account with those credentials.",
    "auth/wrong-password": "Incorrect password.",
    "auth/email-already-in-use": "That email is already registered.",
    "auth/weak-password": "Password is too weak (minimum 6–8 chars).",
    "auth/too-many-requests": "Too many attempts, please wait and try again.",
    "auth/network-request-failed": "Network error, please retry.",
    "storage/unauthorized": "You don't have permission to upload this file.",
    "storage/canceled": "Upload was canceled.",
    "storage/retry-limit-exceeded": "Upload retry limit exceeded."
  };
  for (const k in map) {
    if (code.includes(k)) return map[k];
  }
  return err.message || "An unexpected error occurred.";
}

/* Helpers */
function getFileExtension(file) {
  const name = file?.name || "";
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}
function sanitizeFilename(base) {
  return (base || "")
    .trim()
    .replace(/[^A-Za-z0-9_\- ]+/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 80) || "file";
}
function hasValue(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/* Auth */
export function onAuth(cb) { return onAuthStateChanged(auth, cb); }
export async function signupWithEmail(email, password) {
  try { return (await createUserWithEmailAndPassword(auth, email, password)).user; }
  catch (e) { throw new Error(friendlyError(e)); }
}
export async function loginWithEmail(email, password) {
  try { return (await signInWithEmailAndPassword(auth, email, password)).user; }
  catch (e) { throw new Error(friendlyError(e)); }
}
export async function logout() {
  try { await signOut(auth); return true; }
  catch (e) { throw new Error(friendlyError(e)); }
}
export function getCurrentUser(timeoutMs = 10000) {
  return new Promise(resolve => {
    const timer = setTimeout(()=>{ unsub(); resolve(null); }, timeoutMs);
    const unsub = onAuthStateChanged(auth, user => {
      clearTimeout(timer); unsub(); resolve(user);
    });
  });
}

/* Notes */
const NOTE_COLLECTION = "notes";
const ALLOWED_EXT = ["pdf","doc","docx","txt","ppt","pptx","odt","ods","odp","rtf"];
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const CACHE_TTL_MS = 60 * 1000;
let _notesCache = null;
let _notesCacheTime = 0;

export async function createNote(data, onProgress) {
  // Create a note and upload file using resumable uploads with progress callbacks.
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated. Please log in.");
  const required = ["academic_year","semester","subject_code","notes_type","title"];
  for (const f of required) {
    if (!hasValue(data[f])) throw new Error(`Missing required field: ${f}`);
  }
  if (!data.file) throw new Error("File is required.");
  if (data.file.size > MAX_FILE_BYTES) throw new Error("File exceeds 25MB limit.");
  const ext = getFileExtension(data.file);
  if (!ALLOWED_EXT.includes(ext)) throw new Error("File type not allowed.");

  const safeBase = sanitizeFilename(data.title);
  const timestamp = Date.now();
  const storagePath = `users/${user.uid}/notes/${timestamp}_${safeBase}.${ext}`;
  const storageRef = ref(storage, storagePath);

  // Use resumable upload so we can surface progress in the UI
  const metadata = {
    contentType: data.file.type || "application/octet-stream",
    customMetadata: {
      uploadedBy: user.uid,
      subject_code: data.subject_code,
      notes_type: data.notes_type
    }
  };

  const uploadTask = uploadBytesResumable(storageRef, data.file, metadata);

  // Wrap the upload and Firestore write in a promise so callers can await completion
  return new Promise((resolve, reject) => {
    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (typeof onProgress === 'function') onProgress(progress);
      },
      (error) => {
        reject(new Error(friendlyError(error)));
      },
      async () => {
        try {
          const fileURL = await getDownloadURL(uploadTask.snapshot.ref);
          const meta = {
            uid: user.uid,
            title: data.title.trim(),
            description: (data.description || "").trim(),
            academic_year: data.academic_year,
            semester: data.semester,
            subject_code: data.subject_code,
            notes_type: data.notes_type,
            file_url: fileURL,
            file_ext: ext,
            file_size: data.file.size,
            storage_path: storagePath, // save storage path to ease cleanup later
            createdAt: Date.now(),
            createdAt_server: serverTimestamp()
          };

          const docRef = await addDoc(collection(db, NOTE_COLLECTION), meta);
          invalidateNotesCache();
          resolve({ id: docRef.id, ...meta });
        } catch (e) {
          reject(new Error(friendlyError(e)));
        }
      }
    );
  });
}

export function invalidateNotesCache() {
  _notesCache = null;
  _notesCacheTime = 0;
}

export async function fetchMyNotes({ force = false } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  const now = Date.now();
  if (!force && _notesCache && now - _notesCacheTime < CACHE_TTL_MS) {
    return _notesCache.slice();
  }
  try {
    const qRef = query(
      collection(db, NOTE_COLLECTION),
      where("uid","==", user.uid),
      orderBy("createdAt","desc")
    );
    const snap = await getDocs(qRef);
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    _notesCache = arr;
    _notesCacheTime = now;
    return arr.slice();
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

export async function fetchNotes({ category = 'all', sort = 'newest', limit: limitCount = 50, startAfter: startAfterDoc = null } = {}) {
  // Paginated fetch: returns object { notes, lastSnapshot, hasMore }
  try {
    const notesRef = collection(db, NOTE_COLLECTION);
    const constraints = [];

    if (category !== 'all') {
      constraints.push(where('subject_code', '==', category));
    }

    if (sort === 'newest') constraints.push(orderBy('createdAt','desc'));
    else if (sort === 'oldest') constraints.push(orderBy('createdAt','asc'));
    else if (sort === 'title') constraints.push(orderBy('title','asc'));

    // Fetch one extra to detect if more pages exist
    constraints.push(limit(limitCount + 1));

    if (startAfterDoc) constraints.push(startAfter(startAfterDoc));

    const qRef = query(notesRef, ...constraints);
    const snap = await getDocs(qRef);

    const docs = snap.docs || [];
    const hasMore = docs.length > limitCount;
    const usable = docs.slice(0, limitCount);
    const notes = usable.map(d => ({ id: d.id, ...d.data() }));
    const lastSnapshot = usable.length ? usable[usable.length - 1] : null;

    return { notes, lastSnapshot, hasMore };
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

export async function deleteNote(noteId, storagePath) {
  // Delete Firestore document, then attempt to delete storage object if path available
  if (!noteId) throw new Error('Note id is required.');
  try {
    // Read document first to get stored storage_path if storagePath not passed
    let resolvedPath = storagePath;
    if (!resolvedPath) {
      try {
        const dref = doc(db, NOTE_COLLECTION, noteId);
        const dSnap = await getDoc(dref);
        if (dSnap.exists()) {
          resolvedPath = dSnap.data().storage_path || resolvedPath;
        }
      } catch (e) {
        // ignore - we still attempt to delete doc below
      }
    }

    // Attempt to delete the document
    await deleteDoc(doc(db, NOTE_COLLECTION, noteId));
    invalidateNotesCache();

    // If a storage path was provided, delete the object; otherwise skip
    if (resolvedPath) {
      try {
        const objRef = ref(storage, resolvedPath);
        await deleteObject(objRef);
      } catch (e) {
        console.warn('File cleanup failed or skipped', e);
      }
    }

    return true;
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

export function subscribeMyNotes(cb) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  const qRef = query(
    collection(db, NOTE_COLLECTION),
    where("uid","==", user.uid),
    orderBy("createdAt","desc")
  );
  return onSnapshot(qRef, snap => {
    const arr = [];
    snap.forEach(d => arr.push({ id:d.id, ...d.data() }));
    _notesCache = arr;
    _notesCacheTime = Date.now();
    cb(arr.slice());
  }, err => {
    console.error("subscribeMyNotes error", err);
    cb([], err);
  });
}

// Send password reset email using Firebase Auth
export async function sendPasswordReset(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

// Fetch subject list from Firestore (collection: subjects)
export async function fetchSubjects() {
  try {
    const q = query(collection(db, 'subjects'), orderBy('code'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

window.__NotesU = {
  auth,
  createNote,
  fetchMyNotes,
  fetchNotes,
  deleteNote,
  subscribeMyNotes,
  invalidateNotesCache,
  signupWithEmail,
  loginWithEmail,
  logout,
  friendlyError,
  sendPasswordReset,
  fetchSubjects
};