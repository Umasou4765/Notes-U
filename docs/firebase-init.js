// firebase-init.js (Updated)
// Adds email/password auth while keeping legacy username-based helpers (deprecated).

const firebaseConfig = {
  apiKey: "AIzaSyALfKHvKnsXLDDYASilyGwHA9ycVpbzmuc",
  authDomain: "notes-u.firebaseapp.com",
  projectId: "notes-u",
  storageBucket: "notes-u.appspot.com",
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

/* ---------------- LEGACY USERNAME MAPPING (Deprecated) ---------------- */
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;
function normalizeUsername(username){ return username.trim().toLowerCase(); }
async function isUsernameTaken(username){
  const snap = await getDoc(doc(db,"usernames", normalizeUsername(username)));
  return snap.exists();
}
async function saveUsernameMapping(username, email, uid){
  await setDoc(doc(db,"usernames", normalizeUsername(username)), { email, uid });
}
async function usernameToEmail(username){
  const snap = await getDoc(doc(db,"usernames", normalizeUsername(username)));
  return snap.exists() ? snap.data().email : null;
}
export async function signupWithUsername(username, password){
  const uname = username.trim();
  if(!uname) throw new Error("Username required");
  if(!USERNAME_REGEX.test(uname)) throw new Error("Invalid username format");
  if(password.length<8) throw new Error("Password must be at least 8 characters");
  if(await isUsernameTaken(uname)) throw new Error("Username already taken");
  const pseudoEmail = `${normalizeUsername(uname)}@notes-u.fake`;
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
export async function loginWithUsername(username, password){
  const email = await usernameToEmail(username);
  if(!email) throw new Error("Account not found");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/* ---------------- Modern Email/Password Auth ---------------- */
export async function signupWithEmail(email, password, displayName){
  if(!email) throw new Error("Email required");
  if(password.length < 8) throw new Error("Password must be at least 8 characters");
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if(displayName){
    await updateProfile(cred.user, { displayName: displayName.trim() });
  }
  // Basic user doc
  await setDoc(doc(db,"users", cred.user.uid), {
    email: email.toLowerCase(),
    displayName: cred.user.displayName || null,
    createdAt: Date.now()
  }, { merge:true });
  return cred.user;
}

export async function loginWithEmail(email, password){
  if(!email || !password) throw new Error("Missing credentials");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export function onAuth(cb){
  return onAuthStateChanged(auth, cb);
}

export function logout(){
  return signOut(auth);
}

/* ---------------- Notes Logic ---------------- */
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_EXT = ['pdf','doc','docx','txt','ppt','pptx','odt','ods','odp','rtf'];

export async function createNote({
  academic_year,
  semester,
  subject_code,
  notes_type,
  description,
  file,
  title
}){
  const user = auth.currentUser;
  if(!user) throw new Error("Not authenticated");
  if(!academic_year) throw new Error("Academic year required");
  if(!semester) throw new Error("Semester required");
  if(!subject_code) throw new Error("Subject code required");
  if(!notes_type) throw new Error("Notes type required");
  if(!file) throw new Error("File required");
  if(!title) throw new Error("Title required");

  const ext = file.name.split('.').pop().toLowerCase();
  if(!ALLOWED_EXT.includes(ext)) throw new Error("Invalid file type");
  if(file.size > MAX_FILE_SIZE) throw new Error("File exceeds 25MB limit");

  const safeName = file.name.replace(/[^\w.\-() ]+/g,'_');
  const fileRef = ref(storage, `notes/${user.uid}/${Date.now()}-${safeName}`);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);

  await addDoc(collection(db,"notes"), {
    userId: user.uid,
    academic_year,
    semester,
    subject_code,
    notes_type,
    description: description || "",
    file_url: url,
    title: title.trim(),
    createdAt: Date.now()
  });
  return true;
}

export async function fetchMyNotes(){
  const user = auth.currentUser;
  if(!user) throw new Error("Not authenticated");
  const q = query(
    collection(db,"notes"),
    where("userId","==", user.uid),
    orderBy("createdAt","desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
}

/* Friendly error translator */
export function friendlyError(err){
  if(!err) return "Unknown error";
  if(typeof err === 'string') return err;
  if(err.code){
    switch(err.code){
      case 'auth/email-already-in-use': return 'Email already in use.';
      case 'auth/invalid-email': return 'Invalid email address.';
      case 'auth/user-not-found': return 'User not found.';
      case 'auth/wrong-password': return 'Incorrect password.';
      case 'auth/weak-password': return 'Password too weak.';
      default: return err.message || err.code;
    }
  }
  return err.message || 'Unexpected error';
}