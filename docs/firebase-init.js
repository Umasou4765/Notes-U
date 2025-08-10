// firebase-init.js (username -> pseudo email mapping)
const firebaseConfig = {
  apiKey: "AIzaSyALfKHvKnsXLDDYASilyGwHA9ycVpbzmuc",
  authDomain: "notes-u.firebaseapp.com",
  projectId: "notes-u",
  storageBucket: "notes-u.firebasestorage.app",
  messagingSenderId: "694892183955",
  appId: "1:694892183955:web:6922cb6de148a155642866",
  measurementId: "G-RXBBXBRBHT"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
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

async function isUsernameTaken(username) {
  const uname = username.trim().toLowerCase();
  const snap = await getDoc(doc(db, "usernames", uname));
  return snap.exists();
}

async function saveUsernameMapping(username, email, uid) {
  const uname = username.trim().toLowerCase();
  await setDoc(doc(db, "usernames", uname), { email, uid });
}

async function usernameToEmail(username) {
  const uname = username.trim().toLowerCase();
  const snap = await getDoc(doc(db, "usernames", uname));
  if (!snap.exists()) return null;
  return snap.data().email;
}

export async function signupWithUsername(username, password) {
  const uname = username.trim();
  if (!uname) throw new Error("Username required");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  if (await isUsernameTaken(uname)) throw new Error("Username already taken");
  const pseudoEmail = `${uname}@notes-u.fake`;
  const cred = await createUserWithEmailAndPassword(auth, pseudoEmail, password);
  await updateProfile(cred.user, { displayName: uname });
  await saveUsernameMapping(uname, pseudoEmail, cred.user.uid);
  await setDoc(doc(db, "users", cred.user.uid), {
    username: uname,
    usernameLower: uname.toLowerCase(),
    createdAt: Date.now()
  });
  return cred.user;
}

export async function loginWithUsername(username, password) {
  const email = await usernameToEmail(username);
  if (!email) throw new Error("Account not found");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export function logout() {
  return signOut(auth);
}

export async function createNote({ academic_year, semester, subject_code, notes_type, description, file, title }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  if (!academic_year || !semester || !subject_code || !notes_type || !file || !title) {
    throw new Error("Missing required fields");
  }
  const allowed = ['pdf','doc','docx','txt','ppt','pptx','odt','ods','odp','rtf'];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) throw new Error("Invalid file type");
  const fileRef = ref(storage, `notes/${user.uid}/${Date.now()}-${file.name}`);
  await uploadBytes(fileRef, file);
  const fileUrl = await getDownloadURL(fileRef);
  await addDoc(collection(db, "notes"), {
    userId: user.uid,
    academic_year,
    semester,
    subject_code,
    notes_type,
    description: description || "",
    file_url: fileUrl,
    title,
    createdAt: Date.now()
  });
  return true;
}

export async function fetchMyNotes() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const q = query(
    collection(db, "notes"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}