// Simulated, local-first database and authentication engine
// Replaces Firebase Firestore and Authentication with localStorage persistence

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  isAdmin?: boolean;
}

// Global in-memory storage, initialized from localStorage
const STORAGE_KEY = 'coinvax_firestore_database';
let localDB: { [path: string]: any } = {};

try {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    localDB = JSON.parse(data);
  }
} catch (e) {
  console.error("Local database restore failed:", e);
}

function saveDB() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localDB));
    triggerListeners();
  } catch (e) {
    console.error("Local database save failed:", e);
  }
}

// Active Firestore snapshot listeners
type Listener = {
  id: string;
  targetType: 'document' | 'collection' | 'query';
  targetPath?: string;
  collectionPath?: string;
  queryRef?: any;
  callback: (snapshot: any) => void;
};

const listeners: Listener[] = [];

function triggerListeners() {
  for (const listener of listeners) {
    try {
      if (listener.targetType === 'document') {
        const path = listener.targetPath || '';
        const id = path.split('/').pop() || '';
        const data = localDB[path] || null;
        
        listener.callback({
          id,
          exists: () => data !== null,
          data: () => data,
          ref: { id, path, type: 'document' }
        });
      } else {
        const collectionPath = listener.collectionPath || '';
        const docs = Object.keys(localDB)
          .filter(key => {
            const parts = key.split('/');
            parts.pop();
            return parts.join('/') === collectionPath;
          })
          .map(key => {
            return {
              id: key.split('/').pop() || '',
              data: localDB[key]
            };
          });
          
        let results = [...docs];
        if (listener.queryRef) {
          const q = listener.queryRef;
          for (const clause of q.whereClauses || []) {
            const { field, op, value } = clause;
            results = results.filter(item => {
              const itemVal = item.data?.[field];
              if (op === '==') return itemVal === value;
              if (op === '>=') return itemVal >= value;
              if (op === '<=') return itemVal <= value;
              if (op === '>') return itemVal > value;
              if (op === '<') return itemVal < value;
              if (op === 'array-contains') return Array.isArray(itemVal) && itemVal.includes(value);
              return true;
            });
          }
          
          for (const order of q.orderClauses || []) {
            const { field, direction } = order;
            results.sort((a, b) => {
              const valA = a.data?.[field];
              const valB = b.data?.[field];
              if (valA === undefined) return 1;
              if (valB === undefined) return -1;
              if (valA < valB) return direction === 'desc' ? 1 : -1;
              if (valA > valB) return direction === 'desc' ? -1 : 1;
              return 0;
            });
          }
          
          if (q.limitCount !== undefined) {
            results = results.slice(0, q.limitCount);
          }
        }
        
        listener.callback({
          docs: results.map(item => ({
            id: item.id,
            data: () => item.data,
            exists: () => true
          })),
          empty: results.length === 0,
          size: results.length,
          forEach: (cb: any) => {
            results.forEach((item, idx) => cb({
              id: item.id,
              data: () => item.data,
              exists: () => true
            }, idx));
          },
          docChanges: () => {
            return results.map(item => ({
              type: 'added' as const,
              doc: {
                id: item.id,
                data: () => item.data,
                exists: () => true
              }
            }));
          }
        });
      }
    } catch (e) {
      console.error("Listener update error:", e);
    }
  }
}

// User manager persistence
let currentUserId = localStorage.getItem('coinvax_auth_uid') || null;
type AuthListener = (user: User | null) => void;
const authListeners: AuthListener[] = [];

const DEFAULT_USER_ID = 'demo_user_123';
if (!localStorage.getItem('coinvax_users_list')) {
  const defaultUsers = {
    'demo@coinvax.com': {
      uid: DEFAULT_USER_ID,
      email: 'demo@coinvax.com',
      displayName: 'Demo Investor',
      emailVerified: true
    },
    'admin@coinvax.com': {
      uid: 'admin_user_999',
      email: 'admin@coinvax.com',
      displayName: 'System Admin',
      emailVerified: true,
      isAdmin: true
    }
  };
  localStorage.setItem('coinvax_users_list', JSON.stringify(defaultUsers));
  
  // Initialize balances and default user states
  localDB[`users/${DEFAULT_USER_ID}`] = {
    uid: DEFAULT_USER_ID,
    email: 'demo@coinvax.com',
    fullName: 'Demo Investor',
    displayName: 'Demo Investor',
    registrationStep: 'completed',
    balances: {
      USD: 15500,
      BTC: 0.42,
      ETH: 4.5,
      USDT: 5000
    },
    verified: {
      status: 'VERIFIED',
      level: 3,
      submittedAt: Date.now()
    }
  };
  
  localDB[`users/admin_user_999`] = {
    uid: 'admin_user_999',
    email: 'admin@coinvax.com',
    fullName: 'System Admin',
    displayName: 'System Admin',
    registrationStep: 'completed',
    balances: {
      USD: 1000000,
      BTC: 50,
      ETH: 1000,
      USDT: 1000000
    },
    verified: {
      status: 'VERIFIED',
      level: 3,
      submittedAt: Date.now()
    },
    isAdmin: true
  };
  
  saveDB();
}

function getRegisteredUsers() {
  try {
    return JSON.parse(localStorage.getItem('coinvax_users_list') || '{}');
  } catch {
    return {};
  }
}

function saveRegisteredUsers(users: any) {
  localStorage.setItem('coinvax_users_list', JSON.stringify(users));
}

// ---------------- AUTH CLASS / EXPORTS ----------------

export const auth = {
  get currentUser() {
    if (!currentUserId) return null;
    const users = getRegisteredUsers();
    for (const email of Object.keys(users)) {
      if (users[email].uid === currentUserId) {
        return users[email];
      }
    }
    return {
      uid: currentUserId,
      email: 'user@coinvax.com',
      displayName: 'Valued Client',
      emailVerified: true
    };
  }
};

export function onAuthStateChanged(authInstance: any, callback: AuthListener) {
  authListeners.push(callback);
  setTimeout(() => {
    callback(auth.currentUser);
  }, 0);
  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx > -1) authListeners.splice(idx, 1);
  };
}

function notifyAuthListeners() {
  const user = auth.currentUser;
  for (const cb of authListeners) {
    try { cb(user); } catch (e) { console.error(e); }
  }
}

export async function signInWithEmailAndPassword(authInstance: any, email: string, pass: string) {
  const users = getRegisteredUsers();
  const matched = users[email.toLowerCase().trim()];
  if (!matched) {
    throw new Error("Invalid email or password.");
  }
  currentUserId = matched.uid;
  localStorage.setItem('coinvax_auth_uid', currentUserId || '');
  notifyAuthListeners();
  return { user: matched };
}

export async function createUserWithEmailAndPassword(authInstance: any, email: string, pass: string) {
  const users = getRegisteredUsers();
  const normEmail = email.toLowerCase().trim();
  if (users[normEmail]) {
    throw new Error("Email address already registered.");
  }
  const uid = 'user_' + Math.random().toString(36).substring(2, 11);
  const newUser = {
    uid,
    email: normEmail,
    displayName: '',
    emailVerified: false
  };
  users[normEmail] = newUser;
  saveRegisteredUsers(users);
  
  localDB[`users/${uid}`] = {
    uid,
    email: normEmail,
    fullName: '',
    displayName: '',
    registrationStep: 'personal',
    balances: {
      USD: 0,
      BTC: 0,
      ETH: 0,
      USDT: 0
    },
    verified: {
      status: 'UNVERIFIED',
      level: 0,
    }
  };
  saveDB();
  
  currentUserId = uid;
  localStorage.setItem('coinvax_auth_uid', currentUserId || '');
  notifyAuthListeners();
  return { user: newUser };
}

export async function signOut(authInstance?: any) {
  currentUserId = null;
  localStorage.removeItem('coinvax_auth_uid');
  notifyAuthListeners();
}

export async function updateProfile(userRef: any, profile: { displayName?: string, photoURL?: string }) {
  const users = getRegisteredUsers();
  for (const email of Object.keys(users)) {
    if (users[email].uid === currentUserId) {
      if (profile.displayName !== undefined) users[email].displayName = profile.displayName;
      if (profile.photoURL !== undefined) users[email].photoURL = profile.photoURL;
      break;
    }
  }
  saveRegisteredUsers(users);
  
  if (localDB[`users/${currentUserId}`]) {
    localDB[`users/${currentUserId}`].displayName = profile.displayName || '';
    saveDB();
  }
  notifyAuthListeners();
}

// ---------------- FIRESTORE CLASS / EXPORTS ----------------

export const db = { type: 'database' };

export const connectionPromise = Promise.resolve(true);

export function collection(dbInstance: any, ...pathSegments: string[]) {
  return { type: 'collection' as const, path: pathSegments.join('/') };
}

export function doc(...args: any[]) {
  let collectionPath = '';
  let id = '';
  
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && args[0].type === 'collection') {
    collectionPath = args[0].path;
    id = 'doc_' + Math.random().toString(36).substring(2, 11);
  } else if (args.length >= 2) {
    const segments = args.slice(1).map(x => typeof x === 'string' ? x : (x && x.path) || '');
    const path = segments.filter(Boolean).join('/');
    const parts = path.split('/');
    if (parts.length % 2 === 0) {
      id = parts[parts.length - 1];
      collectionPath = parts.slice(0, -1).join('/');
    } else {
      collectionPath = path;
      id = 'doc_' + Math.random().toString(36).substring(2, 11);
    }
  }
  
  return {
    type: 'document' as const,
    id,
    collectionPath,
    path: `${collectionPath}/${id}`
  };
}

export function query(collectionRef: any, ...queryConstraints: any[]) {
  const q = {
    type: 'query' as const,
    collectionPath: collectionRef.path,
    whereClauses: [] as any[],
    orderClauses: [] as any[],
    limitCount: undefined as number | undefined
  };
  
  for (const constraint of queryConstraints) {
    if (constraint.type === 'where') {
      q.whereClauses.push({ field: constraint.field, op: constraint.op, value: constraint.value });
    } else if (constraint.type === 'orderBy') {
      q.orderClauses.push({ field: constraint.field, direction: constraint.direction });
    } else if (constraint.type === 'limit') {
      q.limitCount = constraint.limitCount;
    }
  }
  return q;
}

export function where(field: string, op: string, value: any) {
  return { type: 'where' as const, field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy' as const, field, direction };
}

export function limit(limitCount: number) {
  return { type: 'limit' as const, limitCount };
}

export async function addDoc(collectionRef: any, data: any) {
  const id = 'doc_' + Math.random().toString(36).substring(2, 11);
  const path = `${collectionRef.path}/${id}`;
  const cleanedData = { ...data };
  for (const k of Object.keys(cleanedData)) {
    if (cleanedData[k] && (cleanedData[k] === 'serverTimestamp' || typeof cleanedData[k] === 'function' || cleanedData[k].type === 'serverTimestamp')) {
      cleanedData[k] = Date.now();
    }
  }
  localDB[path] = cleanedData;
  saveDB();
  return { id, path, type: 'document' as const };
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  const path = docRef.path;
  const cleanedData = { ...data };
  for (const k of Object.keys(cleanedData)) {
    if (cleanedData[k] && (cleanedData[k] === 'serverTimestamp' || typeof cleanedData[k] === 'function' || cleanedData[k].type === 'serverTimestamp')) {
      cleanedData[k] = Date.now();
    }
  }
  if (options?.merge && localDB[path]) {
    localDB[path] = { ...localDB[path], ...cleanedData };
  } else {
    localDB[path] = cleanedData;
  }
  saveDB();
}

export async function updateDoc(docRef: any, data: any) {
  const path = docRef.path;
  if (!localDB[path]) {
    localDB[path] = {};
  }
  const cleanedData = { ...data };
  for (const k of Object.keys(cleanedData)) {
    if (cleanedData[k] && (cleanedData[k] === 'serverTimestamp' || typeof cleanedData[k] === 'function' || cleanedData[k].type === 'serverTimestamp')) {
      cleanedData[k] = Date.now();
    }
  }
  
  const updated = { ...localDB[path] };
  for (const key of Object.keys(cleanedData)) {
    if (key.includes('.')) {
      const parts = key.split('.');
      let current = updated;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = cleanedData[key];
    } else {
      updated[key] = cleanedData[key];
    }
  }
  localDB[path] = updated;
  saveDB();
}

export async function getDoc(docRef: any) {
  const path = docRef.path;
  const data = localDB[path] || null;
  return {
    id: docRef.id,
    exists: () => data !== null,
    data: () => data
  };
}

export async function getDocFromServer(docRef: any) {
  return getDoc(docRef);
}

export function onSnapshot(target: any, callback: (snapshot: any) => void, onError?: (error: any) => void) {
  const listenerId = Math.random().toString(36).substring(2, 11);
  let newListener: Listener;
  
  if (target.type === 'document') {
    newListener = { id: listenerId, targetType: 'document', targetPath: target.path, callback };
  } else if (target.type === 'collection') {
    newListener = { id: listenerId, targetType: 'collection', collectionPath: target.path, callback };
  } else if (target.type === 'query') {
    newListener = { id: listenerId, targetType: 'query', collectionPath: target.collectionPath, queryRef: target, callback };
  } else {
    newListener = { id: listenerId, targetType: 'collection', collectionPath: target.path || '', callback };
  }
  
  listeners.push(newListener);
  
  // Trigger initial snapshot trigger asynchronously
  setTimeout(() => {
    try {
      if (newListener.targetType === 'document') {
        const data = localDB[newListener.targetPath || ''] || null;
        callback({
          id: target.id,
          exists: () => data !== null,
          data: () => data,
          ref: target
        });
      } else {
        const collectionPath = newListener.collectionPath || '';
        const docs = Object.keys(localDB)
          .filter(key => {
            const parts = key.split('/');
            parts.pop();
            return parts.join('/') === collectionPath;
          })
          .map(key => ({
            id: key.split('/').pop() || '',
            data: localDB[key]
          }));
          
        let results = [...docs];
        if (newListener.queryRef) {
          const q = newListener.queryRef;
          for (const clause of q.whereClauses || []) {
            const { field, op, value } = clause;
            results = results.filter(item => {
              const itemVal = item.data?.[field];
              if (op === '==') return itemVal === value;
              if (op === '>=') return itemVal >= value;
              if (op === '<=') return itemVal <= value;
              if (op === '>') return itemVal > value;
              if (op === '<') return itemVal < value;
              if (op === 'array-contains') return Array.isArray(itemVal) && itemVal.includes(value);
              return true;
            });
          }
          
          for (const order of q.orderClauses || []) {
            const { field, direction } = order;
            results.sort((a, b) => {
              const valA = a.data?.[field];
              const valB = b.data?.[field];
              if (valA === undefined) return 1;
              if (valB === undefined) return -1;
              if (valA < valB) return direction === 'desc' ? 1 : -1;
              if (valA > valB) return direction === 'desc' ? -1 : 1;
              return 0;
            });
          }
          
          if (q.limitCount !== undefined) {
            results = results.slice(0, q.limitCount);
          }
        }
        
        callback({
          docs: results.map(item => ({
            id: item.id,
            data: () => item.data,
            exists: () => true
          })),
          empty: results.length === 0,
          size: results.length,
          forEach: (cb: any) => {
            results.forEach((item, idx) => cb({
              id: item.id,
              data: () => item.data,
              exists: () => true
            }, idx));
          },
          docChanges: () => {
            return results.map(item => ({
              type: 'added' as const,
              doc: {
                id: item.id,
                data: () => item.data,
                exists: () => true
              }
            }));
          }
        });
      }
    } catch (e) {
      console.error("Initial emission error:", e);
    }
  }, 0);
  
  return () => {
    const idx = listeners.indexOf(newListener);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

export async function runTransaction(dbInstance: any, updateFunction: (transaction: any) => Promise<any>) {
  const transaction = {
    get: async (docRef: any) => getDoc(docRef),
    update: async (docRef: any, data: any) => updateDoc(docRef, data),
    set: async (docRef: any, data: any) => setDoc(docRef, data),
    delete: async (docRef: any) => {
      delete localDB[docRef.path];
      saveDB();
    }
  };
  return await updateFunction(transaction);
}

export function writeBatch(dbInstance: any) {
  const operations: Array<{ type: 'set' | 'update' | 'delete', ref: any, data?: any }> = [];
  return {
    set: (docRef: any, data: any) => operations.push({ type: 'set', ref: docRef, data }),
    update: (docRef: any, data: any) => operations.push({ type: 'update', ref: docRef, data }),
    delete: (docRef: any) => operations.push({ type: 'delete', ref: docRef }),
    commit: async () => {
      for (const op of operations) {
        if (op.type === 'set') {
          await setDoc(op.ref, op.data);
        } else if (op.type === 'update') {
          await updateDoc(op.ref, op.data);
        } else if (op.type === 'delete') {
          delete localDB[op.ref.path];
        }
      }
      saveDB();
    }
  };
}

export function serverTimestamp() {
  return { type: 'serverTimestamp' as const };
}
