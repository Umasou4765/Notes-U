// Replace the config object with your Firebase project's config
// (Found in Firebase Console -> Project settings -> Your apps -> SDK setup)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

/*
  IMPORTANT: To prevent exposing powerful admin capabilities, NEVER paste
  service account keys here. This is only client SDK config (safe to expose).
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Helper to ensure unique usernames (simple client-side check)
export async function isUsernameTaken(username) {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("usernameLower", "==", username.toLowerCase()));
  const snap = await getDocs(q);
  return !snap.empty;
}

// Signup
export async function registerUser({ email, password, username }) {
  const usernameClean = username.trim();
  if (!usernameClean) throw new Error("Username required.");
  if (await isUsernameTaken(usernameClean)) {
    throw new Error("Username already taken.");
  }
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: usernameClean });
  await setDoc(doc(db, "users", cred.user.uid), {
    username: usernameClean,
    usernameLower: usernameClean.toLowerCase(),
    email: email,
    createdAt: Date.now()
  });
  return cred.user;
}

// Login
export async function loginUser({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// Create note
export async function createNote({ title, academicYear, semester, subjectCode, notesType, description, file }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  let fileUrl = null;
  if (file) {
    const fileRef = ref(storage, `notes/${user.uid}/${Date.now()}-${file.name}`);
    const metadata = { customMetadata: { userId: user.uid } };
    await uploadBytes(fileRef, file, metadata);
    fileUrl = await getDownloadURL(fileRef);
  }
  const notesRef = collection(db, "notes");
  const noteDoc = await addDoc(notesRef, {
    userId: user.uid,
    title,
    academicYear,
    semester,
    subjectCode,
    notesType,
    description: description || "",
    fileUrl,
    createdAt: Date.now()
  });
  return noteDoc.id;
}

// Fetch user notes
export async function fetchNotes() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  const notesRef = collection(db, "notes");
  const q = query(notesRef, where("userId", "==", user.uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Auth state listener helper
export function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

// Logout
export function logout() {
  return signOut(auth);
}