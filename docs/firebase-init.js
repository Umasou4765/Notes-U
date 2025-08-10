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


import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";


export const app = initializeApp(firebaseConfig);
try {
  getAnalytics(app); 
} catch (e) {
  console.warn("[Analytics] Not initialized:", e.message);
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export async function isUsernameTaken(username) {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("usernameLower", "==", username.toLowerCase()));
  const snap = await getDocs(q);
  return !snap.empty;
}


export async function registerUser({ email, password, username }) {
  const uname = (username || "").trim();
  if (!uname) throw new Error("Username required.");
  if (await isUsernameTaken(uname)) {
    throw new Error("Username already taken.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const cred = await createUserWithEmailAndPassword(auth, email, password);
 
  await updateProfile(cred.user, { displayName: uname });

 
  await setDoc(doc(db, "users", cred.user.uid), {
    username: uname,
    usernameLower: uname.toLowerCase(),
    email,
    createdAt: Date.now()
  });

  return cred.user;
}


export async function loginUser({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}


export async function getCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const profileRef = doc(db, "users", user.uid);
  const profileSnap = await getDoc(profileRef);
  const profileData = profileSnap.exists() ? profileSnap.data() : {};
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    ...profileData
  };
}

export async function createNote({ title, academicYear, semester, subjectCode, notesType, description, file }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");

  if (!title || !academicYear || !semester || !subjectCode || !notesType) {
    throw new Error("Missing required note fields.");
  }

  let fileUrl = null;

  if (file) {
   
    const allowed = ['pdf','doc','docx','txt','ppt','pptx','odt','ods','odp','rtf'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      throw new Error("Invalid file type.");
    }

    const fileRef = ref(storage, `notes/${user.uid}/${Date.now()}-${file.name}`);
  
    const metadata = { customMetadata: { userId: user.uid, originalName: file.name } };
    await uploadBytes(fileRef, file, metadata);
    fileUrl = await getDownloadURL(fileRef);
  }

  const notesRef = collection(db, "notes");
  const docRef = await addDoc(notesRef, {
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

  return docRef.id;
}

export async function fetchNotes() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  const notesRef = collection(db, "notes");
  const q = query(notesRef, where("userId", "==", user.uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}


export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function logout() {
  return signOut(auth);
}
