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
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
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

const app      = initApp();
export const auth     = getAuth(app);
const db       = getFirestore(app);
const storage  = getStorage(app);
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
  for (const key in map) {
    if (code.includes(key)) return map[key];
  }
  return err.message || "An unexpected error occurred.";
}

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

export function onAuth(cb) {
 
  return onAuthStateChanged(auth, cb);
}

export async function signupWithEmail(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

export async function loginWithEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

export async function logout() {
  try {
    await signOut(auth);
    return true;
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

export function getCurrentUser(timeoutMs = 10000) {

  return new Promise(resolve => {
    const timer = setTimeout(() => {
      unsub();
      resolve(null);
    }, timeoutMs);
    const unsub = onAuthStateChanged(auth, user => {
      clearTimeout(timer);
      unsub();
      resolve(user);
    });
  });
}


const NOTE_COLLECTION = "notes";
const ALLOWED_EXT     = ["pdf","doc","docx","txt","ppt","pptx","odt","ods","odp","rtf"];
const MAX_FILE_BYTES  = 25 * 1024 * 1024;
const CACHE_TTL_MS    = 60 * 1000;

let _notesCache     = null;
let _notesCacheTime = 0;

export async function createNote(data) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated. Please log in.");

  const required = ["academic_year","semester","subject_code","notes_type","title"];
  for (const f of required) {
    if (!hasValue(data[f])) throw new Error(`Missing required field: ${f}`);
  }
  if (!data.file) throw new Error("File is required.");
  if (data.file.size > MAX_FILE_BYTES) throw new Error("File exceeds 25MB limit.");

  const ext = getFileExtension(data.file);
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error("File type not allowed.");
  }

  const safeBase    = sanitizeFilename(data.title);
  const timestamp   = Date.now();
  const storagePath = `users/${user.uid}/notes/${timestamp}_${safeBase}.${ext}`;
  const storageRef  = ref(storage, storagePath);

  let snapshot;
  try {
    snapshot = await uploadBytes(storageRef, data.file, {
      contentType: data.file.type || "application/octet-stream",
      customMetadata: {
        uploadedBy: user.uid,
        subject_code: data.subject_code,
        notes_type: data.notes_type
      }
    });
  } catch (err) {
    throw new Error(friendlyError(err));
  }

  let fileURL;
  try {
    fileURL = await getDownloadURL(snapshot.ref);
  } catch {
    throw new Error("Uploaded file, but failed to get URL. Try refreshing.");
  }

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
    createdAt: Date.now(),
    createdAt_server: serverTimestamp()
  };

  try {
    const docRef = await addDoc(collection(db, NOTE_COLLECTION), meta);
    invalidateNotesCache();
    return { id: docRef.id, ...meta };
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

export function invalidateNotesCache() {
  _notesCache = null;
  _notesCacheTime = 0;
}

export async function fetchMyNotes(opts = {}) {
  const { force = false } = opts;
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");

  const now = Date.now();
  if (!force && _notesCache && now - _notesCacheTime < CACHE_TTL_MS) {
    return _notesCache.slice();
  }

  try {
    const qRef = query(
      collection(db, NOTE_COLLECTION),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(qRef);
    const arr = [];
    snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
    _notesCache = arr;
    _notesCacheTime = now;
    return arr.slice();
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    _notesCache = arr;
    _notesCacheTime = Date.now();
    cb(arr.slice());
  }, err => {
    console.error("subscribeMyNotes error", err);
    cb([], err);
  });
}

window.__NotesU = {
  auth,
  createNote,
  fetchMyNotes,
  subscribeMyNotes,
  invalidateNotesCache,
  signupWithEmail,
  loginWithEmail,
  logout,
  friendlyError
};
