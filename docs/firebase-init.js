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
  apiKey:            "REPLACE_ME",
  authDomain:        "REPLACE_ME.firebaseapp.com",
  projectId:         "REPLACE_ME",
  storageBucket:     "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId:             "REPLACE_ME",
};

function initApp() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getApp();
}

const app       = initApp();
export const auth     = getAuth(app);
const db       = getFirestore(app);
const storage  = getStorage(app);

const NOTE_COLLECTION = "notes";


const ALLOWED_EXT = [
  "pdf","doc","docx","txt","ppt","pptx","odt","ods","odp","rtf"
];

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB


export function friendlyError(err) {
  if (!err) return "Unknown error.";
  const code = err.code || err.message || "";
  const map = {
    "auth/invalid-email": "Email address is invalid.",
    "auth/user-not-found": "No account with those credentials.",
    "auth/wrong-password": "Incorrect password.",
    "auth/email-already-in-use": "That email is already registered.",
    "auth/weak-password": "Password is too weak (minimum 6–8 chars).",
    "auth/too-many-requests": "Too many attempts, please wait and try again.",
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
  if (idx === -1) return "";
  return name.slice(idx + 1).toLowerCase();
}


function sanitizeFilename(base) {
  return base
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

export async function createNote(data) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated. Please log in.");

  // Validate required fields
  const required = ["academic_year","semester","subject_code","notes_type","title"];
  for (const field of required) {
    if (!hasValue(data[field])) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  if (!data.file) throw new Error("File is required.");

  // File validation
  if (data.file.size > MAX_FILE_BYTES) {
    throw new Error("File exceeds 25MB limit.");
  }
  const ext = getFileExtension(data.file);
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error("File type not allowed.");
  }

  // Construct storage path: users/<uid>/notes/<timestamp>_<sanitizedTitle>.<ext>
  const baseName = sanitizeFilename(data.title);
  const timestamp = Date.now();
  const storagePath = `users/${user.uid}/notes/${timestamp}_${baseName}.${ext}`;
  const storageRef = ref(storage, storagePath);

  // Upload
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

  // Download URL
  let fileURL;
  try {
    fileURL = await getDownloadURL(snapshot.ref);
  } catch (err) {
    throw new Error("Uploaded file, but failed to get URL. Try refreshing.");
  }

  // Firestore doc
  const metadata = {
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
    const docRef = await addDoc(collection(db, NOTE_COLLECTION), metadata);
    return { id: docRef.id, ...metadata };
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

let _notesCache = null;
let _notesCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; 

export async function fetchMyNotes(opts = {}) {
  const { force = false } = opts;
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");

  const now = Date.now();
  if (!force && _notesCache && now - _notesCacheTime < CACHE_TTL_MS) {
    return _notesCache.slice();
  }

  try {

    const q = query(
      collection(db, NOTE_COLLECTION),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    const notes = [];
    snap.forEach(doc => {
      notes.push({ id: doc.id, ...doc.data() });
    });
    _notesCache = notes;
    _notesCacheTime = now;
    return notes.slice();
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

export function invalidateNotesCache() {
  _notesCache = null;
  _notesCacheTime = 0;
}


