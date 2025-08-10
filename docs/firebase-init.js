// firebase-init.js 
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
  orderBy,
  updateDoc,
  deleteDoc,
  limit,
  startAfter,
  onSnapshot
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

/* ---------- Legacy username helpers (unchanged) ---------- */
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

/* ---------- Modern email/password ---------- */
export async function signupWithEmail(email, password, displayName){
  if(!email) throw new Error("Email required");
  if(password.length < 8) throw new Error("Password must be at least 8 characters");
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if(displayName){
    await updateProfile(cred.user, { displayName: displayName.trim() });
  }
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
export function onAuth(cb){ return onAuthStateChanged(auth, cb); }
export function logout(){ return signOut(auth); }

/* ---------- Notes Logic ---------- */
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
    file_size: file.size,
    file_ext: ext,
    pinned: false,
    createdAt: Date.now()
  });
  return true;
}

/**
 * Real-time subscription to all user notes.
 * NOTE: If the dataset gets very large, consider pagination + limited real-time for newest.
 */
export function subscribeMyNotes(cb){
  const user = auth.currentUser;
  if(!user) throw new Error("Not authenticated");
  const qBase = query(
    collection(db,"notes"),
    where("userId","==", user.uid),
    orderBy("createdAt","desc")
  );
  return onSnapshot(qBase, snap=>{
    cb(snap.docs.map(d=>({ id:d.id, ...d.data() })));
  }, err=>{
    console.error("Realtime notes error:", err);
    cb(null, err);
  });
}

/**
 * Paged fetch for older notes (if you decide to limit initial subscription or append older).
 * Returns {notes, lastDoc}
 */
export async function pagedFetchNotes({ afterDoc=null, pageSize=25 } = {}){
  const user = auth.currentUser;
  if(!user) throw new Error("Not authenticated");
  let qBase = query(
    collection(db,"notes"),
    where("userId","==", user.uid),
    orderBy("createdAt","desc"),
    limit(pageSize)
  );
  if(afterDoc){
    qBase = query(
      collection(db,"notes"),
      where("userId","==", user.uid),
      orderBy("createdAt","desc"),
      startAfter(afterDoc),
      limit(pageSize)
    );
  }
  const snap = await getDocs(qBase);
  return {
    notes: snap.docs.map(d=>({ id:d.id, ...d.data(), _doc:d })),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length-1] : null
  };
}

export async function updateNote(id, updates){
  const user = auth.currentUser;
  if(!user) throw new Error("Not authenticated");
  const refDoc = doc(db,"notes", id);
  const current = await getDoc(refDoc);
  if(!current.exists()) throw new Error("Note not found");
  if(current.data().userId !== user.uid) throw new Error("Not authorized");
  const allowed = {};
  if(typeof updates.title === 'string') allowed.title = updates.title.trim();
  if(typeof updates.description === 'string') allowed.description = updates.description.trim();
  if(typeof updates.notes_type === 'string') allowed.notes_type = updates.notes_type;
  if(!Object.keys(allowed).length) return;
  await updateDoc(refDoc, allowed);
  return true;
}

export async function togglePinNote(id, pin){
  const user = auth.currentUser;
  if(!user) throw new Error("Not authenticated");
  const refDoc = doc(db,"notes", id);
  const current = await getDoc(refDoc);
  if(!current.exists()) throw new Error("Note not found");
  if(current.data().userId !== user.uid) throw new Error("Not authorized");
  await updateDoc(refDoc, { pinned: !!pin });
  return true;
}

export async function deleteNote(id){
  const user = auth.currentUser;
  if(!user) throw new Error("Not authenticated");
  const refDoc = doc(db,"notes", id);
  const current = await getDoc(refDoc);
  if(!current.exists()) return true;
  if(current.data().userId !== user.uid) throw new Error("Not authorized");
  await deleteDoc(refDoc);
  return true;
}

export async function fetchMyNotes(){
  // Kept for compatibility (non-realtime use)
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
