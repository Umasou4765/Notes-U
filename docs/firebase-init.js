/* See earlier provided firebase-init.js; identical for centralized logic */

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
  serverTimestamp,
  onSnapshot
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

function initApp(){
  if(!getApps().length) initializeApp(firebaseConfig);
  return getApp();
}
const app = initApp();
export const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export function friendlyError(err){
  if(!err) return "Unknown error.";
  const code = (err.code || err.message || "").toLowerCase();
  const map = {
    "auth/invalid-email":"Invalid email address.",
    "auth/user-not-found":"No user with those credentials.",
    "auth/wrong-password":"Incorrect password.",
    "auth/email-already-in-use":"Email already registered.",
    "auth/weak-password":"Password too weak.",
    "auth/too-many-requests":"Too many attempts. Try again later.",
    "storage/unauthorized":"Not allowed to upload.",
    "storage/canceled":"Upload canceled.",
    "storage/retry-limit-exceeded":"Retry limit exceeded."
  };
  for(const k in map){
    if(code.includes(k)) return map[k];
  }
  return err.message || "Unexpected error.";
}

/* Auth wrappers */
export const onAuth = (cb)=> onAuthStateChanged(auth, cb);
export async function signupWithEmail(email,pw){
  try { return (await createUserWithEmailAndPassword(auth,email,pw)).user; }
  catch(e){ throw new Error(friendlyError(e)); }
}
export async function loginWithEmail(email,pw){
  try { return (await signInWithEmailAndPassword(auth,email,pw)).user; }
  catch(e){ throw new Error(friendlyError(e)); }
}
export async function logout(){
  try { await signOut(auth); return true; }
  catch(e){ throw new Error(friendlyError(e)); }
}

const NOTES = "notes";
const ALLOWED = ["pdf","doc","docx","txt","ppt","pptx","odt","ods","odp","rtf"];
const MAX_BYTES = 25*1024*1024;
const CACHE_TTL = 60*1000;
let _cache = null;
let _cacheTime = 0;

function extOf(file){
  const n=file?.name||"";
  const i=n.lastIndexOf(".");
  return i===-1?"":n.slice(i+1).toLowerCase();
}
function sanitizeName(base){
  return (base||"").trim().replace(/[^A-Za-z0-9_\- ]+/g,"").replace(/\s+/g,"_").slice(0,80)||"file";
}

export async function createNote(data){
  const user = auth.currentUser;
  if(!user) throw new Error("Not authenticated.");
  const required = ["academic_year","semester","subject_code","notes_type","title"];
  for(const f of required){
    if(!data[f] || !String(data[f]).trim()) throw new Error(`Missing required field: ${f}`);
  }
  if(!data.file) throw new Error("File required.");
  if(data.file.size > MAX_BYTES) throw new Error("File exceeds 25MB limit.");
  const fileExt = extOf(data.file);
  if(!ALLOWED.includes(fileExt)) throw new Error("File type not allowed.");

  const safe = sanitizeName(data.title);
  const ts = Date.now();
  const path = `users/${user.uid}/notes/${ts}_${safe}.${fileExt}`;
  const storageRef = ref(storage, path);
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
  } catch(e) {
    throw new Error(friendlyError(e));
  }
  let url;
  try { url = await getDownloadURL(snapshot.ref); }
  catch { throw new Error("Uploaded but failed to get URL."); }

  const meta = {
    uid: user.uid,
    title: data.title.trim(),
    description: (data.description||"").trim(),
    academic_year: data.academic_year,
    semester: data.semester,
    subject_code: data.subject_code,
    notes_type: data.notes_type,
    file_url: url,
    file_ext: fileExt,
    file_size: data.file.size,
    createdAt: Date.now(),
    createdAt_server: serverTimestamp()
  };
  try {
    const docRef = await addDoc(collection(db, NOTES), meta);
    invalidateNotesCache();
    return { id: docRef.id, ...meta };
  } catch(e){
    throw new Error(friendlyError(e));
  }
}

export function invalidateNotesCache(){
  _cache = null; _cacheTime = 0;
}

export async function fetchMyNotes({ force=false } = {}){
  const user = auth.currentUser;
  if(!user) throw new Error("Not authenticated.");
  const now = Date.now();
  if(!force && _cache && now - _cacheTime < CACHE_TTL){
    return _cache.slice();
  }
  try {
    const qRef = query(
      collection(db, NOTES),
      where("uid","==", user.uid),
      orderBy("createdAt","desc")
    );
    const snap = await getDocs(qRef);
    const arr=[];
    snap.forEach(d=>arr.push({id:d.id,...d.data()}));
    _cache = arr;
    _cacheTime = now;
    return arr.slice();
  } catch(e){
    throw new Error(friendlyError(e));
  }
}

export function subscribeMyNotes(cb){
  const user = auth.currentUser;
  if(!user) throw new Error("Not authenticated.");
  const qRef = query(
    collection(db, NOTES),
    where("uid","==", user.uid),
    orderBy("createdAt","desc")
  );
  return onSnapshot(qRef, snap=>{
    const arr=[];
    snap.forEach(d=>arr.push({id:d.id,...d.data()}));
    _cache = arr;
    _cacheTime = Date.now();
    cb(arr.slice());
  }, err=>{
    console.error("subscribeMyNotes", err);
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