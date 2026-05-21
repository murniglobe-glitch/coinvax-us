import React, { useState, useEffect } from 'react';
import { Home, Wallet, LineChart, BarChart2, User, LogOut, X, TrendingUp, TrendingDown, Activity, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine, CreditCard, Users, Bitcoin, ArrowLeft, Send, HeadphonesIcon, MessageSquare, Bell, Sun, Moon, CheckCircle2, Edit2, Save, Search, QrCode, Newspaper, PlaySquare, Play, Phone } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, PieChart, Pie, Cell, Tooltip, BarChart, Bar } from 'recharts';
import { cn } from '../lib/utils';
import TradeView, { Asset } from './TradeView';
import NewsView from './NewsView';
import { format } from 'date-fns';
import Logo from './Logo';
import P2PView from './P2PView';
import AdminView from './AdminView';
import { SlidersHorizontal } from 'lucide-react';
import { fetchBinance } from '../lib/api';
import { 
  auth, 
  db, 
  signOut, 
  updateProfile, 
  doc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  getDocFromServer, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  setDoc, 
  serverTimestamp, 
  runTransaction 
} from '../firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface CoinData {
  symbol: string;
  price: number;
  change: number;
}

interface MainAppProps {
  onLogout: () => void;
}

interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: number;
  read: boolean;
}

export default function MainApp({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<'HOME' | 'ASSETS' | 'TRADE' | 'MARKET' | 'P2P' | 'ADMIN'>('HOME');
  const [showProfile, setShowProfile] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [marketData, setMarketData] = useState<CoinData[]>([]);
  
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset>('BTCUSDT');
  const [supportMessages, setSupportMessages] = useState<{id: string, text: string, sender: 'user'|'agent', time: number}[]>([
    { id: 'welcome', text: 'Hello! Welcome to COINVAX US support. How can we help you today?', sender: 'agent', time: 0 }
  ]);
  const [supportInput, setSupportInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const supportEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showSupport) {
      supportEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [supportMessages, showSupport]);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const addNotification = React.useCallback((title: string, message: string) => {
    setNotifications(prev => [{
      id: Math.random().toString(36).substring(7),
      title,
      message,
      time: Date.now(),
      read: false
    }, ...prev]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const [currentUser, setCurrentUser] = useState<any>(user);

  useEffect(() => {
    if (currentUser) {
      const q = query(
        collection(db, 'support_tickets', currentUser.uid, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(50)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];
        
        const welcomeMsg = { id: 'welcome', text: 'Hello! Welcome to COINVAX US support. How can we help you today?', sender: 'agent' as const, time: 0 };
        
        const dbMsgs = msgs.map(m => ({
          id: m.id,
          text: m.text,
          sender: m.sender,
          time: m.createdAt
        }));

        const finalMsgs = [welcomeMsg, ...dbMsgs];

        setSupportMessages(prev => {
          // Check for new agent message to show notification
          const lastMsg = finalMsgs[finalMsgs.length - 1];
          const prevLastMsg = prev[prev.length - 1];
          if (lastMsg.sender === 'agent' && lastMsg.id !== 'welcome' && (!prevLastMsg || lastMsg.id !== prevLastMsg.id)) {
            addNotification('Support', 'New message from Customer Support');
          }
          
          return finalMsgs;
        });
      }, (error) => {
        // Only log if it's not a permission error for a non-existent ticket
        if (!(error instanceof Error && error.message.includes('permission-denied'))) {
          handleFirestoreError(error, OperationType.GET, `support_tickets/${currentUser.uid}/messages`);
        }
      });
      return () => unsubscribe();
    }
  }, [currentUser]);

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportInput.trim() || !currentUser) return;
    
    const text = supportInput;
    setSupportInput('');

    try {
      // Ensure ticket exists
      await setDoc(doc(db, 'support_tickets', currentUser.uid), {
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'User',
        status: 'OPEN',
        lastMessage: text,
        updatedAt: Date.now()
      }, { merge: true });

      // Add user message
      await addDoc(collection(db, 'support_tickets', currentUser.uid, 'messages'), {
        userId: currentUser.uid,
        sender: 'user',
        text,
        createdAt: Date.now()
      });

      // Automated AI Response (from "Firebase")
      setIsTyping(true);
      const chat = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: `User: ${text}` }] }
        ],
        config: {
          systemInstruction: "You are the COINVAX US Customer Support AI. Be professional, helpful, and concise. If the user has a technical issue, provide general guidance. If they need manual intervention, tell them an agent will review their ticket soon. Always refer to yourself as COINVAX Support.",
        }
      });

      const response = await chat;
      const aiText = response.text || "Thank you for your message. An agent will review your account and respond shortly.";

      // Small delay for natural feel
      setTimeout(async () => {
        setIsTyping(true);
        try {
          // Add AI message to Firestore
          await addDoc(collection(db, 'support_tickets', currentUser.uid, 'messages'), {
            userId: currentUser.uid,
            sender: 'agent',
            text: aiText,
            createdAt: Date.now()
          });

          // Update ticket last message
          await updateDoc(doc(db, 'support_tickets', currentUser.uid), {
            lastMessage: aiText,
            updatedAt: Date.now()
          });
        } finally {
          setIsTyping(false);
        }
      }, 1500);

    } catch (error) {
      setIsTyping(false);
      handleFirestoreError(error, OperationType.WRITE, `support_tickets/${currentUser.uid}/messages`);
    }
  };

  useEffect(() => {
    if (user) {
      setCurrentUser(user);
      
      // Listen to user data in Firestore
      const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setCurrentUser((prev: any) => ({ ...prev, ...data }));
          if (data.allocations) {
            setAllocations(data.allocations);
          } else if (data.balance !== undefined) {
            setAllocations(prev => ({ ...prev, 'Main Account': data.balance }));
          }
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      });

      // Listen to withdrawals
      const q = query(collection(db, 'withdrawals'), where('uid', '==', user.uid), limit(50));
      const unsubscribeWithdrawals = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          const data = change.doc.data();
          if (data.status !== 'PENDING' && !data.notified) {
            if (data.status === 'APPROVED') {
              addNotification('Withdrawal Approved', `Your withdrawal of $${data.amount} has been approved.`);
              try { await updateDoc(doc(db, 'withdrawals', change.doc.id), { notified: true }); } catch (e) { console.error(e); }
            } else if (data.status === 'FREEZED') {
              addNotification('Withdrawal Frozen', `Your withdrawal of $${data.amount} has been frozen by management.`);
              try { await updateDoc(doc(db, 'withdrawals', change.doc.id), { notified: true }); } catch (e) { console.error(e); }
            } else if (data.status === 'CANCELED' || data.status === 'DISAPPROVED') {
              const statusText = data.status === 'CANCELED' ? 'Canceled' : 'Disapproved';
              addNotification(`Withdrawal ${statusText}`, `Your withdrawal of $${data.amount} has been ${statusText.toLowerCase()}.`);
              // Refund the amount to Main Account using transaction to prevent double refund
              try {
                await runTransaction(db, async (transaction) => {
                  const withdrawalRef = doc(db, 'withdrawals', change.doc.id);
                  const withdrawalDoc = await transaction.get(withdrawalRef);
                  if (!withdrawalDoc.exists() || withdrawalDoc.data().refunded) {
                    return; // Already refunded
                  }
                  
                  const userRef = doc(db, 'users', user.uid);
                  const userDoc = await transaction.get(userRef);
                  if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const currentAllocations = userData.allocations || {};
                    const currentMain = currentAllocations['Main Account'] || 0;
                    const newAllocations = { ...currentAllocations, 'Main Account': currentMain + data.amount };
                    const newTotalBalance = Object.values(newAllocations).reduce((a, b) => (a as number) + (b as number), 0);
                    
                    transaction.update(userRef, {
                      allocations: newAllocations,
                      balance: newTotalBalance
                    });
                    transaction.update(withdrawalRef, { refunded: true, notified: true });
                  }
                });
              } catch (error) {
                console.error("Failed to refund withdrawal", error);
              }
            }
          }
        });
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'withdrawals');
      });

      // Listen to deposits
      const qDeposits = query(collection(db, 'deposits'), where('uid', '==', user.uid), limit(50));
      const unsubscribeDeposits = onSnapshot(qDeposits, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          const data = change.doc.data();
          if (data.status !== 'PENDING' && !data.notified) {
            if (data.status === 'APPROVED') {
              addNotification('Deposit Approved', `Your deposit of ${data.amount} ${data.method} has been approved.`);
              // Add the amount to Main Account using transaction
              try {
                await runTransaction(db, async (transaction) => {
                  const depositRef = doc(db, 'deposits', change.doc.id);
                  const depositDoc = await transaction.get(depositRef);
                  if (!depositDoc.exists() || depositDoc.data().notified) {
                    return; // Already processed
                  }
                  
                  const userRef = doc(db, 'users', user.uid);
                  const userDoc = await transaction.get(userRef);
                  if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const currentAllocations = userData.allocations || {};
                    const currentMain = currentAllocations['Main Account'] || 0;
                    const newAllocations = { ...currentAllocations, 'Main Account': currentMain + data.amount };
                    const newTotalBalance = Object.values(newAllocations).reduce((a, b) => (a as number) + (b as number), 0);
                    
                    transaction.update(userRef, {
                      allocations: newAllocations,
                      balance: newTotalBalance
                    });
                    transaction.update(depositRef, { notified: true });
                  }
                });
              } catch (error) {
                console.error("Failed to process deposit approval", error);
              }
            } else if (data.status === 'DENIED') {
              addNotification('Deposit Denied', `Your deposit of ${data.amount} ${data.method} has been denied.`);
              try { await updateDoc(doc(db, 'deposits', change.doc.id), { notified: true }); } catch (e) { console.error(e); }
            }
          }
        });
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'deposits');
      });

      return () => {
        unsubscribeUser();
        unsubscribeWithdrawals();
        unsubscribeDeposits();
      };
    }
  }, [user]);

  useEffect(() => {
    // Connection test is already handled in src/firebase.ts with robust retries
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setAvatarDataUrl(base64);
        if (currentUser) {
          localStorage.setItem(`avatar_${currentUser.uid}`, base64);
          addNotification('Profile Updated', 'Your profile picture has been updated successfully.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (currentUser) {
      const saved = localStorage.getItem(`avatar_${currentUser.uid}`);
      if (saved) setAvatarDataUrl(saved);
    }
  }, [currentUser]);
  
  const [allocations, setAllocations] = useState<Record<string, number>>({
    'Main Account': 4500,
    'Trading Account': 3000,
    'Options Account': 1500,
    'P2P Account': 1000
  });

  const balance = Object.values(allocations).reduce((a, b) => (a as number) + (b as number), 0) as number;

  const updateUserAllocations = async (newAllocations: Record<string, number>) => {
    if (currentUser) {
      try {
        const newTotalBalance = Object.values(newAllocations).reduce((a, b) => a + b, 0);
        await updateDoc(doc(db, 'users', currentUser.uid), {
          allocations: newAllocations,
          balance: newTotalBalance
        });
      } catch (error) {
        console.error("Failed to update allocations in Firestore", error);
      }
    }
  };

  const handleUpdateAllocations = (newAllocations: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
    setAllocations(prev => {
      const next = typeof newAllocations === 'function' ? newAllocations(prev) : newAllocations;
      updateUserAllocations(next);
      return next;
    });
  };

  const handleSetBalance = (updater: number | ((prev: number) => number)) => {
    handleUpdateAllocations(prev => {
      const currentTrading = prev['Trading Account'];
      const newTrading = typeof updater === 'function' ? updater(currentTrading) : updater;
      return { ...prev, 'Trading Account': newTrading };
    });
  };

  const handleResendVerification = async () => {
    if (currentUser && !currentUser.emailVerified) {
      try {
        // Mock resend verification
        setVerificationSent(true);
        setTimeout(() => setVerificationSent(false), 60000); // Reset after 60s
      } catch (error) {
        console.error("Failed to send verification email", error);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (currentUser && editName.trim()) {
      try {
        await updateProfile(auth.currentUser!, {
          displayName: editName.trim()
        });
        
        await updateDoc(doc(db, 'users', currentUser.uid), {
          displayName: editName.trim()
        });

        setIsEditingProfile(false);
        addNotification('Profile Updated', 'Your display name has been updated.');
      } catch (error) {
        console.error("Failed to update profile", error);
      }
    }
  };

  useEffect(() => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'DOTUSDT', 'LINKUSDT', 'AVAXUSDT'];
    
    const fetchMarketData = async () => {
      try {
        const data = await fetchBinance('/api/v3/ticker/24hr');
        if (Array.isArray(data)) {
          const filtered = data.filter(d => symbols.includes(d.symbol));
          setMarketData(filtered.map(d => ({
            symbol: d.symbol,
            price: parseFloat(d.lastPrice),
            change: parseFloat(d.priceChangePercent)
          })));
        }
      } catch (error) {
        console.error("Failed to fetch market data:", error);
        addNotification('Market Data Error', 'Failed to fetch initial market data. Retrying via WebSocket...');
      }
    };

    fetchMarketData();

    const ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMarketData(prev => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        data.forEach((ticker: any) => {
          if (symbols.includes(ticker.s)) {
            const idx = next.findIndex(item => item.symbol === ticker.s);
            if (idx !== -1) {
              const open = parseFloat(ticker.o);
              const close = parseFloat(ticker.c);
              next[idx] = {
                ...next[idx],
                price: close,
                change: open === 0 ? 0 : ((close - open) / open) * 100
              };
            }
          }
        });
        return next;
      });
    };
    return () => ws.close();
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'HOME':
        return <HomeView marketData={marketData} onTradeClick={() => setActiveTab('TRADE')} />;
      case 'ASSETS':
        return <AssetsView allocations={allocations} setAllocations={handleUpdateAllocations} balance={balance} addNotification={addNotification} userCountry={currentUser?.country} />;
      case 'TRADE':
        return <TradeView user={currentUser} balance={allocations['Trading Account']} setBalance={handleSetBalance} addNotification={addNotification} currentAsset={selectedAsset} setCurrentAsset={setSelectedAsset} />;
      case 'MARKET':
        return <MarketView marketData={marketData} />;
      case 'P2P':
        return <P2PView addNotification={addNotification} defaultAsset={selectedAsset} />;
      case 'ADMIN':
        return <AdminView currentUser={currentUser} addNotification={addNotification} onClose={() => setActiveTab('HOME')} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-50 pb-20 font-sans selection:bg-emerald-500/30">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-zinc-800 px-4 py-3 flex justify-between items-center">
        <Logo showText={true} horizontal={true} className="flex-shrink-0" />

        <div className="flex items-center gap-1">
          <button onClick={() => { setShowNotifications(!showNotifications); setNotifications(prev => prev.map(n => ({ ...n, read: true }))); }} className="relative p-2 hover:bg-zinc-900 rounded-full transition-colors">
            <Bell className="w-5 h-5 text-zinc-400" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-black"></span>
            )}
          </button>
          <button onClick={() => setShowSupport(true)} className="p-2 hover:bg-zinc-900 rounded-full transition-colors">
            <HeadphonesIcon className="w-5 h-5 text-zinc-400" />
          </button>
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-2 p-1.5 hover:bg-zinc-900 rounded-full transition-colors overflow-hidden">
            <div className="flex flex-col items-end mr-1 hidden sm:flex">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">Account</span>
              <span className="text-xs font-black text-emerald-500">{currentUser?.phone || 'No Phone'}</span>
            </div>
            <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-800">
              {avatarDataUrl ? (
                <img src={avatarDataUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                  <User className="w-4 h-4 text-zinc-400" />
                </div>
              )}
            </div>
          </button>
          <button onClick={handleLogout} className="p-2 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 rounded-lg transition-colors" title="Log Out">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="absolute top-16 right-4 w-80 bg-black border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-bold">Notifications</h3>
            <button onClick={() => setShowNotifications(false)} className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-zinc-600 dark:text-zinc-400 text-sm">No notifications yet</div>
            ) : (
              notifications.map(notif => (
                <div key={notif.id} className="p-4 border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors">
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{notif.title}</h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{notif.message}</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2">{format(notif.time, 'MMM dd, HH:mm')}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowProfile(false)} className="absolute top-4 right-4 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 rounded-full p-1">
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center gap-4 mb-6 mt-2">
              <div 
                className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center border-2 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer overflow-hidden relative group"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarDataUrl ? (
                  <img src={avatarDataUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-emerald-500" />
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold text-white">UPLOAD</span>
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
              
              {isEditingProfile ? (
                <div className="w-full space-y-3 mb-2">
                  <div>
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">Full Name</label>
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)} 
                      className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditingProfile(false)} className="flex-1 py-2 rounded-lg border border-zinc-800 text-sm font-medium hover:bg-zinc-900 transition-colors">Cancel</button>
                    <button onClick={handleSaveProfile} className="flex-1 py-2 rounded-lg bg-emerald-500 text-zinc-950 text-sm font-bold hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1"><Save className="w-4 h-4" /> Save</button>
                  </div>
                </div>
              ) : (
                <div className="text-center relative w-full">
                  <button onClick={() => { setEditName(currentUser?.displayName || ''); setIsEditingProfile(true); }} className="absolute right-0 top-0 p-1.5 text-zinc-400 hover:text-emerald-500 bg-zinc-100 dark:bg-zinc-800 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <h2 className="text-2xl font-bold">
                    {currentUser?.displayName || 'User'}
                    {currentUser?.phone && (
                      <span className="block text-sm font-normal text-zinc-500 dark:text-zinc-400 mt-1">
                        {currentUser.phone}
                      </span>
                    )}
                  </h2>
                  <p className="text-emerald-400 font-sans font-black text-sm mt-1 bg-emerald-500/10 px-3 py-1 rounded-full inline-block border border-emerald-500/20">ID: CVX-{currentUser?.uid?.substring(0, 6).toUpperCase() || '982374'}</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="bg-black p-3.5 rounded-xl border border-zinc-800 flex items-center gap-3">
                <div className="p-2 bg-zinc-900 rounded-lg"><User className="w-4 h-4 text-zinc-500" /></div>
                <div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Email Address</p>
                  <p className="text-sm font-medium">{currentUser?.email || 'Not provided'}</p>
                </div>
              </div>
              <div className="bg-black p-3.5 rounded-xl border border-zinc-800 flex items-center gap-3">
                <div className="p-2 bg-zinc-900 rounded-lg"><User className="w-4 h-4 text-zinc-500" /></div>
                <div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Phone Number</p>
                  <p className="text-sm font-medium">{currentUser?.phone || 'Not provided'}</p>
                </div>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full mt-6 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold py-3 rounded-xl transition-colors border border-rose-500/20 flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {showSupport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-black border border-zinc-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col h-[600px] max-h-[80vh]">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <HeadphonesIcon className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Customer Support</h2>
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Online 24/7
                  </p>
                </div>
              </div>
              <button onClick={() => setShowSupport(false)} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 rounded-full p-2 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-2">
                {supportMessages.map(msg => (
                  <div key={msg.id} className={cn(
                    "max-w-[80%] rounded-2xl p-3 text-sm border flex flex-col gap-1",
                    msg.sender === 'agent' 
                      ? "bg-zinc-100 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 self-start rounded-tl-sm border-zinc-300 dark:border-zinc-700/50" 
                      : "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 self-end rounded-tr-sm border-emerald-500/30"
                  )}>
                    {msg.sender === 'agent' && (
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">COINVAX Support</span>
                    )}
                    {msg.text}
                  </div>
                ))}
                {isTyping && (
                  <div className="bg-zinc-100 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 self-start rounded-2xl rounded-tl-sm p-3 border border-zinc-300 dark:border-zinc-700/50 flex items-center gap-1">
                    <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce"></span>
                    <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                )}
                <div ref={supportEndRef} />
            </div>
            
            <form onSubmit={handleSendSupport} className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
              <input 
                type="text" 
                value={supportInput}
                onChange={(e) => setSupportInput(e.target.value)}
                placeholder="Type your message..." 
                className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <button type="submit" disabled={!supportInput.trim()} className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 p-3 rounded-xl transition-colors flex items-center justify-center">
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="w-full max-w-[1600px] mx-auto">
        {renderTabContent()}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full bg-black/95 backdrop-blur-md border-t border-zinc-800 flex justify-around items-center pb-safe pt-2 px-2 z-40">
        <NavButton icon={<Home className="w-6 h-6" />} label="Home" isActive={activeTab === 'HOME'} onClick={() => setActiveTab('HOME')} />
        <NavButton icon={<Wallet className="w-6 h-6" />} label="Assets" isActive={activeTab === 'ASSETS'} onClick={() => setActiveTab('ASSETS')} />
        <NavButton icon={<LineChart className="w-6 h-6" />} label="Trade" isActive={activeTab === 'TRADE'} onClick={() => setActiveTab('TRADE')} />
        <NavButton icon={<BarChart2 className="w-6 h-6" />} label="Market" isActive={activeTab === 'MARKET'} onClick={() => setActiveTab('MARKET')} />
        <NavButton icon={<Users className="w-6 h-6" />} label="P2P" isActive={activeTab === 'P2P'} onClick={() => setActiveTab('P2P')} />
        {(currentUser?.role === 'admin' || currentUser?.email === 'murni.globe@gmail.com' || currentUser?.uid === 'F9Hd82WxLgSSsXZF6btmyka0fqg2') && (
          <NavButton icon={<SlidersHorizontal className="w-6 h-6 text-emerald-400 animate-pulse" />} label="Admin" isActive={activeTab === 'ADMIN'} onClick={() => setActiveTab('ADMIN')} />
        )}
      </nav>
    </div>
  );
}

function NavButton({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-16 h-14 gap-1 transition-colors",
        isActive ? "text-emerald-400" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
      )}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function MiniChart({ symbol, color }: { symbol: string, color: string }) {
  const [data, setData] = useState<{ time: number, price: number }[]>([]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchKlines = async () => {
      try {
        const json = await fetchBinance(`/api/v3/klines?symbol=${symbol}&interval=1m&limit=20`);
        if (!isMounted) return;
        const points = json.map((d: any) => ({
          time: d[0],
          price: parseFloat(d[4])
        }));
        setData(points);
      } catch (error) {
        console.error(`Failed to fetch klines for ${symbol}:`, error);
      }
    };

    fetchKlines();

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`);
    ws.onmessage = (event) => {
      if (!isMounted) return;
      const ticker = JSON.parse(event.data);
      setData(prev => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        next[next.length - 1] = { time: ticker.E, price: parseFloat(ticker.c) };
        return next;
      });
    };

    return () => {
      isMounted = false;
      ws.close();
    };
  }, [symbol]);

  if (data.length === 0) return <div className="h-full w-full flex items-center justify-center text-zinc-800"><Activity className="w-4 h-4 animate-pulse" /></div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <YAxis domain={['auto', 'auto']} hide />
        <Area 
          type="monotone" 
          dataKey="price" 
          stroke={color} 
          strokeWidth={2}
          fillOpacity={1} 
          fill={`url(#grad-${symbol})`} 
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}


function HomeView({ marketData, onTradeClick }: { marketData: CoinData[], onTradeClick: () => void }) {
  const topCoins = marketData.slice(0, 4);
  
  return (
    <div className="p-4 lg:p-6 flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-emerald-900/40 to-zinc-900 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <TrendingUp className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-2">Welcome to COINVAX US</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-md mb-6">Trade crypto options with real-time market data. Predict price movements and earn up to 85% payouts in seconds.</p>
          <button onClick={onTradeClick} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-2.5 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            Start Trading
          </button>
        </div>
      </div>

      {/* Live Market Overview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" /> Live Market
          </h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {topCoins.map(coin => (
            <div key={coin.symbol} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <span className="font-bold">{coin.symbol.replace('USDT', '')}</span>
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded flex items-center gap-0.5", coin.change >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
                  {coin.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(coin.change).toFixed(2)}%
                </span>
              </div>
              <span className="text-xl font-sans font-black font-bold">${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
              <div className="h-16 mt-2 -mx-2">
                <MiniChart symbol={coin.symbol} color={coin.change >= 0 ? '#10b981' : '#f43f5e'} />
              </div>
            </div>
          ))}
          {topCoins.length === 0 && (
            <div className="col-span-full py-8 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center gap-2">
              <Activity className="w-6 h-6 animate-pulse" />
              Loading live market data...
            </div>
          )}
        </div>
      </div>

      {/* News Feed */}
      <div className="mt-4">
        <NewsView />
      </div>
    </div>
  );
}

const INTERVIEW_SOURCES = ['Bloomberg Crypto US', 'BNN Bloomberg Canada', 'CoinDesk North America', 'Yahoo Finance US', 'Yahoo Finance Canada', 'CNBC Television', 'Fox Business'];
const INTERVIEW_TITLES = [
  "US Bitcoin ETF Inflows Surge: What's Next?",
  "Canada's Crypto Regulation: Impact on USDT",
  "Bitcoin Mining in North America: US vs Canada",
  "USDT Stablecoin Adoption in Canadian Markets",
  "SEC vs Crypto: US Regulations on Bitcoin and Tether",
  "Bank of Canada's Stance on Bitcoin and USDT",
  "US Market Open: Bitcoin Price Action Analysis",
  "Tether (USDT) Liquidity in US Crypto Exchanges",
  "Canadian Bitcoin ETFs: A Comparative Analysis",
  "North American Bitcoin Miners Prepare for Halving",
  "US Treasury's New Guidelines for USDT",
  "Bitcoin Adoption Trends in US and Canada"
];

function generateRandomInterview(id: number) {
  const source = INTERVIEW_SOURCES[Math.floor(Math.random() * INTERVIEW_SOURCES.length)];
  const title = INTERVIEW_TITLES[Math.floor(Math.random() * INTERVIEW_TITLES.length)];
  const duration = `${Math.floor(Math.random() * 15 + 5)}:${Math.floor(Math.random() * 50 + 10).toString().padStart(2, '0')}`;
  
  // Use a set of known valid YouTube video IDs for Bitcoin and USDT news/interviews
  const videoIds = [
    'HvkqptHkPUI', // CNBC Michael Saylor
    '8eaJ3VuzhmY', // Michael Saylor Responds to Bitcoin Critics
    'kh9UoCoRxI0', // Bitcoin's journey
    'OAVTMr9XuvE', // Michael Saylor: Why Bitcoin Is STRONGER Than Ever
    'b0KU4cJgj6g', // Michael Saylor: The Bitcoin Treasury Endgame
    '1oDgxAvQVQk', // What's Next for USDT?! Interview With Tether CEO!
    'kpbRJUsB7II', // USDT Founder Admits Bitcoin Will Never Replace Money
    'od18lWAex8Y', // Interview with CEO / CTO, Tether (USDT)
    '-Fl3rP7jgAc', // Are Exchanges Delisting USDT? | Tether CEO Interview
    'xXRxV-e7crI', // USDT Founder: Bitcoin, Gold, Stablecoin, & Tether
    'w3Kh9FVOtwA'  // The Truth about Tether ($USDT)
  ];
  const videoId = videoIds[Math.floor(Math.random() * videoIds.length)];

  return {
    id: `vid-${id}`,
    title,
    source,
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    videoId,
    timestamp: Date.now(),
    duration
  };
}

function MarketInterviews() {
  const [interviews, setInterviews] = useState(() => {
    return Array.from({ length: 4 }).map((_, i) => generateRandomInterview(Date.now() - i * 100000));
  });
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setInterviews(prev => {
        const newInterview = generateRandomInterview(Date.now());
        return [newInterview, ...prev.slice(0, 3)]; // Keep exactly 4
      });
    }, 12000); // Add a new one every 12 seconds to simulate "keep changing and updating to newest"
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <PlaySquare className="w-5 h-5 text-emerald-500" />
          Live Market Interviews
        </h2>
        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full animate-pulse uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Updating Live
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {interviews.map((video, idx) => (
          <div key={video.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden group hover:border-emerald-500/50 transition-colors animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="relative aspect-video bg-black">
              {playingVideoId === video.id ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1`}
                  title={video.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                ></iframe>
              ) : (
                <>
                  <img 
                    src={video.thumbnail} 
                    alt={video.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer" 
                    referrerPolicy="no-referrer" 
                    onClick={() => setPlayingVideoId(video.id)} 
                  />
                  <div 
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => setPlayingVideoId(video.id)}
                  >
                    <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-zinc-950 pl-1 shadow-lg shadow-emerald-500/20">
                      <Play className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none">
                    {video.duration}
                  </div>
                </>
              )}
            </div>
            <div className="p-4">
              <h3 
                className="font-bold text-sm line-clamp-2 leading-tight mb-2 group-hover:text-emerald-400 transition-colors cursor-pointer"
                onClick={() => setPlayingVideoId(video.id)}
              >
                {video.title}
              </h3>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span className="font-medium text-zinc-400">{video.source}</span>
                <span>{idx === 0 ? 'Just now' : `${idx * 2}m ago`}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketView({ marketData }: { marketData: CoinData[] }) {
  return (
    <div className="p-4 lg:p-6 flex flex-col gap-4 animate-in fade-in duration-300">
      <h2 className="text-xl font-bold mb-2">Market Prices</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-950 text-zinc-600 dark:text-zinc-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Asset</th>
                <th className="px-6 py-4 font-medium">Chart</th>
                <th className="px-6 py-4 font-medium text-right">Price (USD)</th>
                <th className="px-6 py-4 font-medium text-right">24h Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {marketData.map(coin => (
                <tr key={coin.symbol} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 font-bold flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px]">
                      {coin.symbol.substring(0, 1)}
                    </div>
                    {coin.symbol.replace('USDT', '')}
                  </td>
                  <td className="px-6 py-2 w-32">
                    <div className="h-10 w-24">
                      <MiniChart symbol={coin.symbol} color={coin.change >= 0 ? '#10b981' : '#f43f5e'} />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-sans font-black font-medium">
                    ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={cn("inline-flex items-center gap-1 font-bold", coin.change >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {coin.change >= 0 ? '+' : ''}{coin.change.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
              {marketData.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <Activity className="w-6 h-6 animate-pulse mx-auto mb-2" />
                    Loading market data...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Market Interviews */}
      <MarketInterviews />
    </div>
  );
}

interface AssetsViewProps {
  allocations: Record<string, number>;
  setAllocations: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  balance: number;
  addNotification?: (title: string, message: string) => void;
  userCountry?: string;
}

function AssetsView({ allocations, setAllocations, balance, addNotification, userCountry }: AssetsViewProps) {
  const [view, setView] = useState<'OVERVIEW' | 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER' | 'DEPOSIT_CRYPTO' | 'DEPOSIT_CARD' | 'DEPOSIT_PAYPAL' | 'DEPOSIT_BANK' | 'DEPOSIT_ZELLE' | 'DEPOSIT_INTERAC' | 'DEPOSIT_MOBILE_MONEY'>('OVERVIEW');
  const [cryptoType, setCryptoType] = useState<'BTC' | 'USDT'>('BTC');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositStatus, setDepositStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS'>('IDLE');

  // Mobile Money State
  const [mobileMoneyAmount, setMobileMoneyAmount] = useState('');
  const [mobileMoneyStatus, setMobileMoneyStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS'>('IDLE');
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState<'MTN' | 'Airtel'>('MTN');
  const [mobileNumber, setMobileNumber] = useState('');
  const [ussdSent, setUssdSent] = useState(false);

  // Transfer State
  const [fromAccount, setFromAccount] = useState('Main Account');
  const [toAccount, setToAccount] = useState('Options Account');
  const [transferAmount, setTransferAmount] = useState('');
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);

  // Card Deposit State
  const [cardDetails, setCardDetails] = useState({ number: '', expiry: '', cvv: '' });
  const [cardDepositAmount, setCardDepositAmount] = useState('');
  const [cardDepositStatus, setCardDepositStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS'>('IDLE');

  // Withdraw State
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawStatus, setWithdrawStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS'>('IDLE');
  const [withdrawMethod, setWithdrawMethod] = useState<'Bank Transfer (ACH)' | 'Wire Transfer' | 'Crypto Wallet (USDT)' | 'Mobile Money'>('Bank Transfer (ACH)');
  const [withdrawMobileNumber, setWithdrawMobileNumber] = useState('');

  // PayPal Deposit State
  const [paypalAmount, setPaypalAmount] = useState('');
  const [paypalStatus, setPaypalStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS'>('IDLE');

  // Bank/Zelle/Interac Deposit State
  const [bankDepositAmount, setBankDepositAmount] = useState('');
  const [bankDepositStatus, setBankDepositStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS'>('IDLE');
  const [bankDepositMethod, setBankDepositMethod] = useState<'Bank Transfer' | 'Zelle' | 'Interac e-Transfer'>('Bank Transfer');

  // Transactions State
  const [transactions, setTransactions] = useState<{id: string, type: string, asset: string, amount: string, status: string, date: string, details?: string}[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const qDeposits = query(collection(db, 'deposits'), where('uid', '==', auth.currentUser.uid));
    const qWithdrawals = query(collection(db, 'withdrawals'), where('uid', '==', auth.currentUser.uid));
    const qTransfers = query(collection(db, 'transfers'), where('uid', '==', auth.currentUser.uid));
    
    const unsubscribeDeposits = onSnapshot(qDeposits, (snapshot) => {
      const depositTxs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'Deposit',
          asset: data.method,
          amount: data.amount.toString(),
          status: data.status === 'APPROVED' ? 'Completed' : data.status === 'DENIED' ? 'Denied' : 'Pending',
          date: new Date(data.createdAt).toISOString()
        };
      });
      setTransactions(prev => {
        const otherTxs = prev.filter(tx => tx.type !== 'Deposit');
        return [...otherTxs, ...depositTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'deposits');
    });

    const unsubscribeWithdrawals = onSnapshot(qWithdrawals, (snapshot) => {
      const withdrawalTxs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'Withdraw',
          asset: 'USD',
          amount: data.amount.toString(),
          status: data.status === 'APPROVED' ? 'Completed' : data.status === 'PENDING' ? 'Pending' : data.status,
          date: new Date(data.createdAt).toISOString()
        };
      });
      setTransactions(prev => {
        const otherTxs = prev.filter(tx => tx.type !== 'Withdraw');
        return [...otherTxs, ...withdrawalTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'withdrawals');
    });

    const unsubscribeTransfers = onSnapshot(qTransfers, (snapshot) => {
      const transferTxs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'Transfer',
          asset: 'USD',
          amount: data.amount.toString(),
          status: 'Completed',
          date: new Date(data.createdAt).toISOString(),
          details: `${data.fromAccount} → ${data.toAccount}`
        };
      });
      setTransactions(prev => {
        const otherTxs = prev.filter(tx => tx.type !== 'Transfer');
        return [...otherTxs, ...transferTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transfers');
    });

    return () => {
      unsubscribeDeposits();
      unsubscribeWithdrawals();
      unsubscribeTransfers();
    };
  }, []);

  // Hardcoded addresses managed by admin
  const walletAddresses = {
    BTC: '138cecvURJxhcZMPqCxJzRDGnSV7nkH9WQ',
    USDT: 'THLjRhsWH44cM7TfVL2WEyfxFg2u1t56hW'
  };

  const handleDepositSubmit = async () => {
    if (!depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) <= 0) return;
    setDepositStatus('PENDING');
    
    try {
      const depositData = {
        uid: auth.currentUser?.uid,
        amount: Number(depositAmount),
        method: cryptoType,
        status: 'PENDING',
        notified: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await addDoc(collection(db, 'deposits'), depositData);
      
      setDepositStatus('SUCCESS');
      setTransactions(prev => [{ id: Date.now().toString(), type: 'Deposit', asset: cryptoType, amount: depositAmount, status: 'Pending', date: new Date().toISOString() }, ...prev]);
      addNotification?.('Deposit Submitted', `Your deposit of ${depositAmount} ${cryptoType} has been submitted and is waiting for management approval.`);
      
      setTimeout(() => {
        setView('OVERVIEW');
        setDepositStatus('IDLE');
        setDepositAmount('');
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'deposits');
      setDepositStatus('IDLE');
      addNotification?.('Error', 'Failed to submit deposit request.');
    }
  };

  const handleCardDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardDepositAmount || isNaN(Number(cardDepositAmount)) || Number(cardDepositAmount) <= 0) return;
    setCardDepositStatus('PENDING');
    
    try {
      const depositData = {
        uid: auth.currentUser?.uid,
        amount: Number(cardDepositAmount),
        method: 'Card',
        status: 'PENDING',
        notified: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await addDoc(collection(db, 'deposits'), depositData);
      
      setCardDepositStatus('SUCCESS');
      setTransactions(prev => [{ id: Date.now().toString(), type: 'Deposit', asset: 'USD', amount: cardDepositAmount, status: 'Pending', date: new Date().toISOString() }, ...prev]);
      addNotification?.('Deposit Submitted', `Your deposit of $${cardDepositAmount} via Card has been submitted and is waiting for management approval.`);
      
      setTimeout(() => {
        setView('OVERVIEW');
        setCardDepositStatus('IDLE');
        setCardDepositAmount('');
        setCardDetails({ number: '', expiry: '', cvv: '' });
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'deposits');
      setCardDepositStatus('IDLE');
      addNotification?.('Error', 'Failed to submit deposit request.');
    }
  };

  const handleWithdrawSubmit = async () => {
    if (!withdrawAmount || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) <= 0) return;
    if (Number(withdrawAmount) > balance) return;
    setWithdrawStatus('PENDING');
    
    try {
      const withdrawalData = {
        uid: auth.currentUser?.uid,
        amount: Number(withdrawAmount),
        method: withdrawMethod,
        mobileNumber: withdrawMethod === 'Mobile Money' ? withdrawMobileNumber : null,
        status: 'PENDING',
        refunded: false,
        notified: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await addDoc(collection(db, 'withdrawals'), withdrawalData);
      
      setWithdrawStatus('SUCCESS');
      setAllocations(prev => {
        const currentMain = prev['Main Account'];
        const amount = Number(withdrawAmount);
        return { ...prev, 'Main Account': Math.max(0, currentMain - amount) };
      });
      setTransactions(prev => [{ id: Date.now().toString(), type: 'Withdraw', asset: 'USD', amount: withdrawAmount, status: 'Pending', date: new Date().toISOString(), details: withdrawMethod === 'Mobile Money' ? `Mobile Money: ${withdrawMobileNumber}` : withdrawMethod }, ...prev]);
      addNotification?.('Withdrawal Submitted', `Your withdrawal request for $${withdrawAmount} via ${withdrawMethod} has been submitted and is waiting for management approval.`);
      
      setTimeout(() => {
        setView('OVERVIEW');
        setWithdrawStatus('IDLE');
        setWithdrawAmount('');
        setWithdrawMobileNumber('');
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'withdrawals');
      setWithdrawStatus('IDLE');
      addNotification?.('Error', 'Failed to submit withdrawal request.');
    }
  };

  const handlePaypalDeposit = async () => {
    if (!paypalAmount || isNaN(Number(paypalAmount)) || Number(paypalAmount) <= 0) return;
    setPaypalStatus('PENDING');
    
    try {
      const depositData = {
        uid: auth.currentUser?.uid,
        amount: Number(paypalAmount),
        method: 'PayPal',
        status: 'PENDING',
        notified: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await addDoc(collection(db, 'deposits'), depositData);
      
      setPaypalStatus('SUCCESS');
      setTransactions(prev => [{ id: Date.now().toString(), type: 'Deposit', asset: 'USD', amount: paypalAmount, status: 'Pending', date: new Date().toISOString() }, ...prev]);
      addNotification?.('Deposit Submitted', `Your deposit of $${paypalAmount} via PayPal has been submitted and is waiting for management approval.`);
      
      setTimeout(() => {
        setView('OVERVIEW');
        setPaypalStatus('IDLE');
        setPaypalAmount('');
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'deposits');
      setPaypalStatus('IDLE');
      addNotification?.('Error', 'Failed to submit deposit request.');
    }
  };

  const handleBankDepositSubmit = async (method: 'Bank Transfer' | 'Zelle' | 'Interac e-Transfer') => {
    if (!bankDepositAmount || isNaN(Number(bankDepositAmount)) || Number(bankDepositAmount) <= 0) return;
    setBankDepositMethod(method);
    setBankDepositStatus('PENDING');
    
    try {
      const depositData = {
        uid: auth.currentUser?.uid,
        amount: Number(bankDepositAmount),
        method: method,
        status: 'PENDING',
        notified: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await addDoc(collection(db, 'deposits'), depositData);
      
      setBankDepositStatus('SUCCESS');
      setTransactions(prev => [{ id: Date.now().toString(), type: 'Deposit', asset: 'USD', amount: bankDepositAmount, status: 'Pending', date: new Date().toISOString(), details: method }, ...prev]);
      addNotification?.('Deposit Submitted', `Your deposit of $${bankDepositAmount} via ${method} has been submitted and is waiting for management approval.`);
      
      setTimeout(() => {
        setView('OVERVIEW');
        setBankDepositStatus('IDLE');
        setBankDepositAmount('');
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'deposits');
      setBankDepositStatus('IDLE');
      addNotification?.('Error', 'Failed to submit deposit request.');
    }
  };

  const handleMobileMoneyDeposit = async () => {
    if (!mobileMoneyAmount || isNaN(Number(mobileMoneyAmount)) || Number(mobileMoneyAmount) <= 0 || !mobileNumber) return;
    setMobileMoneyStatus('PENDING');
    setUssdSent(true);
    
    // Simulate USSD Push delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const depositData = {
        uid: auth.currentUser?.uid,
        amount: Number(mobileMoneyAmount),
        method: `Mobile Money (${mobileMoneyProvider})`,
        status: 'PENDING',
        notified: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        details: `Phone: ${mobileNumber}`
      };
      
      await addDoc(collection(db, 'deposits'), depositData);
      
      setMobileMoneyStatus('SUCCESS');
      setTransactions(prev => [{ id: Date.now().toString(), type: 'Deposit', asset: 'USD', amount: mobileMoneyAmount, status: 'Pending', date: new Date().toISOString(), details: `${mobileMoneyProvider}: ${mobileNumber}` }, ...prev]);
      addNotification?.('USSD Push Sent', `A USSD push has been sent to ${mobileNumber}. Please enter your PIN on your phone.`);
      
      setTimeout(() => {
        setView('OVERVIEW');
        setMobileMoneyStatus('IDLE');
        setMobileMoneyAmount('');
        setMobileNumber('');
        setUssdSent(false);
      }, 5000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'deposits');
      setMobileMoneyStatus('IDLE');
      setUssdSent(false);
      addNotification?.('Error', 'Failed to submit deposit request.');
    }
  };

  if (view === 'DEPOSIT_CRYPTO') {
    return (
      <div className="p-4 lg:p-6 flex flex-col gap-6 animate-in fade-in duration-300 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => setView('DEPOSIT')} className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 rounded-full transition-colors border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">Deposit {cryptoType}</h2>
        </div>

        {depositStatus === 'SUCCESS' ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-400">Deposit Request Submitted</h3>
              <p className="text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mt-2">Your deposit of {depositAmount} {cryptoType} is being processed. It will reflect in your balance shortly after network confirmations.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col gap-6 text-zinc-900 dark:text-white">
            <div>
              <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mb-2">Select Cryptocurrency</label>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setCryptoType('BTC')}
                  className={cn("py-3 rounded-xl border font-bold transition-all", cryptoType === 'BTC' ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700")}
                >
                  Bitcoin (BTC)
                </button>
                <button 
                  onClick={() => setCryptoType('USDT')}
                  className={cn("py-3 rounded-xl border font-bold transition-all", cryptoType === 'USDT' ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700")}
                >
                  Tether (USDT)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mb-2">Deposit Address (Admin Managed)</label>
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex justify-center p-4 bg-white rounded-lg w-fit mx-auto text-zinc-900">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${walletAddresses[cryptoType]}`}
                    alt={`${cryptoType} QR Code`}
                    className="w-32 h-32"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">Send only {cryptoType} to this address</p>
                  <div className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                    <p className="font-sans font-black text-sm sm:text-base break-all select-all text-white">
                      {walletAddresses[cryptoType]}
                    </p>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(walletAddresses[cryptoType]);
                        addNotification?.('Copied', 'Wallet address copied to clipboard');
                      }}
                      className="ml-2 p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Amount Transferred</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-lg font-sans font-black focus:outline-none focus:border-emerald-500 transition-colors text-white"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 font-bold">{cryptoType}</span>
              </div>
            </div>

            <button 
              onClick={handleDepositSubmit}
              disabled={!depositAmount || depositStatus === 'PENDING'}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-zinc-950 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
            >
              {depositStatus === 'PENDING' ? (
                <><Activity className="w-5 h-5 animate-pulse" /> Processing...</>
              ) : (
                'I Have Made The Transfer'
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (view === 'DEPOSIT') {
    return (
      <div className="p-4 lg:p-6 flex flex-col gap-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => setView('OVERVIEW')} className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 rounded-full transition-colors border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">Deposit Funds</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button onClick={() => setView('DEPOSIT_CARD')} className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 transition-all group">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Credit/Debit Card</h3>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">Instant deposit via Visa or Mastercard</p>
            </div>
          </button>
          
          <button onClick={() => setView('DEPOSIT_PAYPAL')} className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 transition-all group">
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">PayPal</h3>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">Fast and secure deposit via PayPal</p>
            </div>
          </button>
          
          <button onClick={() => setView('DEPOSIT_CRYPTO')} className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 transition-all group">
            <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500">
              <Bitcoin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Crypto Wallet</h3>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">Deposit via BTC or USDT network</p>
            </div>
          </button>

          <button onClick={() => setView('DEPOSIT_BANK')} className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 transition-all group">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
              <ArrowDownToLine className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Bank Transfer (ACH/Wire)</h3>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">Direct transfer from US/CA banks</p>
            </div>
          </button>

          <button onClick={() => setView('DEPOSIT_ZELLE')} className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 transition-all group">
            <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Zelle</h3>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">Instant transfer for US users</p>
            </div>
          </button>

          <button onClick={() => setView('DEPOSIT_INTERAC')} className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 transition-all group">
            <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Interac e-Transfer</h3>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">Instant transfer for CA users</p>
            </div>
          </button>

          {userCountry === 'Uganda' && (
            <button onClick={() => setView('DEPOSIT_MOBILE_MONEY')} className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 transition-all group">
              <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Mobile Money</h3>
                <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">MTN or Airtel Money (Uganda)</p>
              </div>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (view === 'DEPOSIT_MOBILE_MONEY') {
    return (
      <div className="p-4 lg:p-6 flex flex-col gap-6 animate-in fade-in duration-300 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => setView('DEPOSIT')} className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 rounded-full transition-colors border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">Mobile Money Deposit</h2>
        </div>

        {mobileMoneyStatus === 'SUCCESS' ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-400">USSD Push Sent</h3>
              <p className="text-zinc-400 mt-2">A USSD push has been sent to your phone (+256 {mobileNumber}). Please enter your PIN to authorize the ${mobileMoneyAmount} deposit.</p>
              <p className="text-xs text-zinc-500 mt-4">Once authorized, your deposit will be marked as pending for management approval.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col gap-6 text-zinc-900 dark:text-white">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500">
                <Phone className="w-8 h-8" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Select Provider</label>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setMobileMoneyProvider('MTN')}
                  className={cn("py-3 rounded-xl border font-bold transition-all", mobileMoneyProvider === 'MTN' ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700")}
                >
                  MTN Uganda
                </button>
                <button 
                  onClick={() => setMobileMoneyProvider('Airtel')}
                  className={cn("py-3 rounded-xl border font-bold transition-all", mobileMoneyProvider === 'Airtel' ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700")}
                >
                  Airtel Uganda
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Mobile Number (Used for payment)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-zinc-500 font-bold">+256</span>
                </div>
                <input 
                  type="tel" 
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="7xx xxxxxx"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-16 pr-4 focus:outline-none focus:border-emerald-500 transition-colors text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Amount (USD Equivalent)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-zinc-500 font-bold">$</span>
                </div>
                <input 
                  type="number" 
                  value={mobileMoneyAmount}
                  onChange={(e) => setMobileMoneyAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-8 pr-4 focus:outline-none focus:border-emerald-500 transition-colors text-white font-sans font-black"
                />
              </div>
              <p className="text-[10px] text-zinc-500 mt-2 italic">Note: Exchange rate will be applied at the time of approval.</p>
            </div>
          </div>

          <button 
            onClick={handleMobileMoneyDeposit}
              disabled={!mobileMoneyAmount || !mobileNumber || mobileMoneyStatus === 'PENDING'}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {mobileMoneyStatus === 'PENDING' ? (
                <><Activity className="w-5 h-5 animate-pulse" /> {ussdSent ? 'Sending USSD Push...' : 'Processing...'}</>
              ) : (
                'Submit Deposit Request'
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (view === 'WITHDRAW') {
    return (
      <div className="p-4 lg:p-6 flex flex-col gap-6 animate-in fade-in duration-300 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => setView('OVERVIEW')} className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 rounded-full transition-colors border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">Withdraw Funds</h2>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-zinc-900 dark:text-white">
          <div className="flex justify-between items-center mb-6">
            <span className="text-zinc-400 dark:text-zinc-500 dark:text-zinc-400">Available Balance</span>
            <span className="font-sans font-black font-bold text-emerald-400">${allocations['Main Account'].toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Withdrawal Amount (USD)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-zinc-400 dark:text-zinc-500 font-bold">$</span>
                </div>
                <input 
                  type="number" 
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-8 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans font-black"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mb-2">Withdrawal Method</label>
              <select 
                value={withdrawMethod}
                onChange={(e) => setWithdrawMethod(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 appearance-none"
              >
                <option value="Bank Transfer (ACH)">Bank Transfer (ACH)</option>
                <option value="Wire Transfer">Wire Transfer</option>
                <option value="Crypto Wallet (USDT)">Crypto Wallet (USDT)</option>
                {userCountry === 'Uganda' && <option value="Mobile Money">Mobile Money</option>}
              </select>
            </div>

            {withdrawMethod === 'Mobile Money' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mb-2">Mobile Money Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="w-4 h-4 text-zinc-500" />
                  </div>
                  <input 
                    type="tel" 
                    value={withdrawMobileNumber}
                    onChange={(e) => setWithdrawMobileNumber(e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans font-black"
                  />
                </div>
              </div>
            )}
            
            <button 
              onClick={handleWithdrawSubmit}
              disabled={!withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > allocations['Main Account'] || withdrawStatus !== 'IDLE' || (withdrawMethod === 'Mobile Money' && !withdrawMobileNumber)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold py-3.5 rounded-xl mt-4 transition-colors flex items-center justify-center gap-2"
            >
              {withdrawStatus === 'PENDING' ? (
                <><Activity className="w-5 h-5 animate-spin" /> Processing...</>
              ) : withdrawStatus === 'SUCCESS' ? (
                <><CheckCircle2 className="w-5 h-5" /> Success!</>
              ) : (
                <><ArrowUpFromLine className="w-5 h-5" /> Submit Withdrawal Request</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'TRANSFER') {
    return (
      <div className="p-4 lg:p-6 flex flex-col gap-6 animate-in fade-in duration-300 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => setView('OVERVIEW')} className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 rounded-full transition-colors border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">Transfer Funds</h2>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-zinc-900 dark:text-white">
          <div className="space-y-6">
            <div className="relative">
              <div>
                <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-300 mb-2">From Account</label>
                <select 
                  value={fromAccount}
                  onChange={(e) => setFromAccount(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 appearance-none"
                >
                  <option>Main Account</option>
                  <option>Trading Account</option>
                  <option>P2P Account</option>
                  <option>Options Account</option>
                </select>
              </div>
              
              <div className="absolute left-1/2 -translate-x-1/2 top-[72px] z-10">
                <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-full p-2 text-zinc-500 dark:text-zinc-400">
                  <ArrowRightLeft className="w-4 h-4 rotate-90" />
                </div>
              </div>
              
              <div className="mt-6">
                <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-300 mb-2">To Account</label>
                <select 
                  value={toAccount}
                  onChange={(e) => setToAccount(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 appearance-none"
                >
                  <option>Main Account</option>
                  <option>Trading Account</option>
                  <option>P2P Account</option>
                  <option>Options Account</option>
                </select>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-300">Amount</label>
                <span 
                  className="text-xs text-emerald-400 cursor-pointer hover:underline"
                  onClick={() => setTransferAmount(allocations[fromAccount].toString())}
                >
                  Max: ${allocations[fromAccount].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-zinc-400 dark:text-zinc-500 font-bold">$</span>
                </div>
                <input 
                  type="number" 
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-8 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans font-black"
                />
              </div>
            </div>
            
            <button 
              onClick={() => {
                if (transferAmount && Number(transferAmount) > 0 && Number(transferAmount) <= allocations[fromAccount]) {
                  setShowTransferConfirm(true);
                }
              }}
              disabled={!transferAmount || Number(transferAmount) <= 0 || Number(transferAmount) > allocations[fromAccount] || fromAccount === toAccount}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold py-3.5 rounded-xl mt-2 transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" /> Confirm Transfer
            </button>
          </div>
        </div>

        {/* Transfer Confirmation Modal */}
        {showTransferConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 relative shadow-2xl animate-in zoom-in-95 duration-200 text-zinc-900 dark:text-white">
              <h3 className="text-xl font-bold mb-4">Confirm Transfer</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-zinc-400 dark:text-zinc-300 text-sm">From</span>
                  <span className="font-bold text-lg">{fromAccount}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-zinc-400 dark:text-zinc-300 text-sm">To</span>
                  <span className="font-bold text-lg">{toAccount}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-zinc-400 dark:text-zinc-300 text-sm">Amount</span>
                  <span className="font-sans font-black font-bold text-2xl text-emerald-400">${Number(transferAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowTransferConfirm(false)}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    setShowTransferConfirm(false);
                    setView('OVERVIEW');
                    
                    const amount = Number(transferAmount);
                    try {
                      // Update allocations
                      await setAllocations(prev => ({
                        ...prev,
                        [fromAccount]: prev[fromAccount] - amount,
                        [toAccount]: prev[toAccount] + amount
                      }));
                      
                      // Save to Firestore
                      await addDoc(collection(db, 'transfers'), {
                        uid: auth.currentUser?.uid,
                        fromAccount,
                        toAccount,
                        amount,
                        createdAt: Date.now()
                      });

                      addNotification?.('Transfer Successful', `Transferred $${amount.toLocaleString()} from ${fromAccount} to ${toAccount}`);
                      setTransferAmount('');
                    } catch (error) {
                      handleFirestoreError(error, OperationType.CREATE, 'transfers');
                      addNotification?.('Error', 'Failed to complete transfer.');
                    }
                  }}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-3 rounded-xl transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'DEPOSIT_CARD') {
    return (
      <div className="p-4 lg:p-6 flex flex-col gap-6 animate-in fade-in duration-300 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => setView('DEPOSIT')} className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 rounded-full transition-colors border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">Credit/Debit Card Deposit</h2>
        </div>

        {cardDepositStatus === 'SUCCESS' ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-400">Deposit Successful</h3>
              <p className="text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mt-2">Your deposit of ${cardDepositAmount} has been successfully processed and added to your balance.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCardDepositSubmit} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col gap-4 text-zinc-900 dark:text-white">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                <CreditCard className="w-8 h-8" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mb-2">Card Number</label>
              <input 
                type="text" 
                required
                value={cardDetails.number}
                onChange={(e) => setCardDetails({...cardDetails, number: e.target.value})}
                placeholder="0000 0000 0000 0000"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans font-black"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mb-2">Expiry Date</label>
                <input 
                  type="text" 
                  required
                  value={cardDetails.expiry}
                  onChange={(e) => setCardDetails({...cardDetails, expiry: e.target.value})}
                  placeholder="MM/YY"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans font-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mb-2">CVV</label>
                <input 
                  type="text" 
                  required
                  value={cardDetails.cvv}
                  onChange={(e) => setCardDetails({...cardDetails, cvv: e.target.value})}
                  placeholder="123"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans font-black"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mb-2">Deposit Amount (USD)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                   <span className="text-zinc-400 dark:text-zinc-500 font-bold">$</span>
                </div>
                <input 
                  type="number" 
                  required
                  value={cardDepositAmount}
                  onChange={(e) => setCardDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-8 pr-4 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans font-black text-white"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={cardDepositStatus === 'PENDING'}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold py-4 rounded-xl mt-4 transition-colors flex items-center justify-center gap-2"
            >
              {cardDepositStatus === 'PENDING' ? (
                <><Activity className="w-5 h-5 animate-pulse" /> Processing...</>
              ) : (
                'Deposit Funds'
              )}
            </button>
          </form>
        )}
      </div>
    );
  }

  if (view === 'DEPOSIT_PAYPAL') {
    return (
      <div className="p-4 lg:p-6 flex flex-col gap-6 animate-in fade-in duration-300 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => setView('DEPOSIT')} className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 rounded-full transition-colors border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">PayPal Deposit</h2>
        </div>

        {paypalStatus === 'SUCCESS' ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-400">Deposit Successful</h3>
              <p className="text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mt-2">Your deposit of ${paypalAmount} has been successfully processed and added to your balance.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col gap-6 text-zinc-900 dark:text-white">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                <span className="font-bold text-3xl text-blue-500">P</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Deposit Amount (USD)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-zinc-500">$</span>
                  </div>
                  <input 
                    type="number" 
                    value={paypalAmount}
                    onChange={(e) => setPaypalAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-8 pr-4 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans font-black text-white"
                  />
                </div>
              </div>

              <button 
                onClick={handlePaypalDeposit}
                disabled={!paypalAmount || Number(paypalAmount) <= 0 || paypalStatus === 'PENDING'}
                className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 rounded-xl mt-4 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {paypalStatus === 'PENDING' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  'Continue with PayPal'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'DEPOSIT_BANK' || view === 'DEPOSIT_ZELLE' || view === 'DEPOSIT_INTERAC') {
    const methodInfo = {
      'DEPOSIT_BANK': { title: 'Bank Transfer (ACH/Wire)', icon: <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500"><ArrowDownToLine className="w-8 h-8" /></div>, method: 'Bank Transfer' as const },
      'DEPOSIT_ZELLE': { title: 'Zelle Deposit', icon: <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500"><Send className="w-8 h-8" /></div>, method: 'Zelle' as const },
      'DEPOSIT_INTERAC': { title: 'Interac e-Transfer', icon: <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500"><ArrowRightLeft className="w-8 h-8" /></div>, method: 'Interac e-Transfer' as const }
    };
    const currentMethod = methodInfo[view];

    return (
      <div className="p-4 lg:p-6 flex flex-col gap-6 animate-in fade-in duration-300 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => setView('DEPOSIT')} className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 rounded-full transition-colors border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">{currentMethod.title}</h2>
        </div>

        {bankDepositStatus === 'SUCCESS' ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-400">Deposit Request Submitted</h3>
              <p className="text-zinc-400 dark:text-zinc-500 mt-2">Your deposit of ${bankDepositAmount} via {currentMethod.method} is being processed. It will reflect in your balance shortly.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col gap-6 text-zinc-900 dark:text-white">
            <div className="flex items-center justify-center mb-4">
              {currentMethod.icon}
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Deposit Amount (USD)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-zinc-500">$</span>
                  </div>
                  <input 
                    type="number" 
                    value={bankDepositAmount}
                    onChange={(e) => setBankDepositAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-8 pr-4 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans font-black text-white"
                  />
                </div>
              </div>

              {view === 'DEPOSIT_BANK' && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-400">
                  <p className="mb-2 font-bold text-white">Bank Details for Transfer:</p>
                  <p>Bank Name: Chase Bank</p>
                  <p>Account Name: COINVAX US LLC</p>
                  <p>Routing Number: 122000661</p>
                  <p>Account Number: 9876543210</p>
                  <p className="mt-2 text-xs text-zinc-500">Please include your User ID in the transfer memo.</p>
                </div>
              )}
              {view === 'DEPOSIT_ZELLE' && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-400">
                  <p className="mb-2 font-bold text-white">Zelle Details:</p>
                  <p>Email: payments@coinvax.us</p>
                  <p>Name: COINVAX US LLC</p>
                  <p className="mt-2 text-xs text-zinc-500">Please include your User ID in the Zelle memo.</p>
                </div>
              )}
              {view === 'DEPOSIT_INTERAC' && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-400">
                  <p className="mb-2 font-bold text-white">Interac e-Transfer Details:</p>
                  <p>Email: interac@coinvax.ca</p>
                  <p>Name: COINVAX CA</p>
                  <p className="mt-2 text-xs text-zinc-500">Please include your User ID in the message.</p>
                </div>
              )}

              <button 
                onClick={() => handleBankDepositSubmit(currentMethod.method)}
                disabled={!bankDepositAmount || Number(bankDepositAmount) <= 0 || bankDepositStatus === 'PENDING'}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-4 rounded-xl mt-4 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {bankDepositStatus === 'PENDING' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  `I Have Sent the ${currentMethod.method}`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const allocationData = [
    { name: 'Main', value: allocations['Main Account'], color: '#10b981' },
    { name: 'Trading', value: allocations['Trading Account'], color: '#3b82f6' },
    { name: 'Options', value: allocations['Options Account'], color: '#f59e0b' },
    { name: 'P2P', value: allocations['P2P Account'], color: '#8b5cf6' },
  ];

  return (
    <div className="p-4 lg:p-6 flex flex-col gap-6 animate-in fade-in duration-300">
      <h2 className="text-xl font-bold">My Assets</h2>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2 relative overflow-hidden">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl blur-xl"></div>
        <span className="text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 font-medium relative z-10">Total Balance</span>
        <span className="text-4xl font-sans font-black font-bold text-emerald-400 relative z-10">${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        
        <div className="flex gap-3 mt-6 w-full max-w-md relative z-10">
          <button onClick={() => setView('DEPOSIT')} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-2.5 rounded-xl transition-colors">
            Deposit
          </button>
          <button onClick={() => setView('WITHDRAW')} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold py-2.5 rounded-xl transition-colors border border-zinc-700">
            Withdraw
          </button>
          <button onClick={() => setView('TRANSFER')} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold py-2.5 rounded-xl transition-colors border border-zinc-700">
            Transfer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Detailed History Tables */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-emerald-500" />
            Deposit History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-950 text-zinc-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-bold">Method</th>
                  <th className="px-4 py-3 font-bold">Amount</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {transactions.filter(tx => tx.type === 'Deposit').length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No deposits found</td></tr>
                ) : (
                  transactions.filter(tx => tx.type === 'Deposit').map(tx => (
                    <tr key={tx.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-4 font-bold">{tx.asset}</td>
                      <td className="px-4 py-4 font-sans font-black text-emerald-400">${Number(tx.amount).toLocaleString()}</td>
                      <td className="px-4 py-4">
                        <span className={cn("text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider", 
                          tx.status === 'Completed' ? "bg-emerald-500/10 text-emerald-500" : 
                          tx.status === 'Denied' ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                        )}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-zinc-500">{format(new Date(tx.date), 'MMM dd, HH:mm')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <ArrowUpFromLine className="w-5 h-5 text-rose-500" />
            Withdrawal History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-950 text-zinc-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-bold">Method</th>
                  <th className="px-4 py-3 font-bold">Amount</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {transactions.filter(tx => tx.type === 'Withdraw').length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No withdrawals found</td></tr>
                ) : (
                  transactions.filter(tx => tx.type === 'Withdraw').map(tx => (
                    <tr key={tx.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-4 font-bold">{tx.details || 'Bank Transfer'}</td>
                      <td className="px-4 py-4 font-sans font-black text-rose-400">-${Number(tx.amount).toLocaleString()}</td>
                      <td className="px-4 py-4">
                        <span className={cn("text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider", 
                          tx.status === 'Completed' ? "bg-emerald-500/10 text-emerald-500" : 
                          tx.status === 'Denied' || tx.status === 'CANCELED' || tx.status === 'DISAPPROVED' ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                        )}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-zinc-500">{format(new Date(tx.date), 'MMM dd, HH:mm')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-blue-500" />
            Transfer History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-950 text-zinc-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-bold">From Account</th>
                  <th className="px-4 py-3 font-bold">To Account</th>
                  <th className="px-4 py-3 font-bold">Amount</th>
                  <th className="px-4 py-3 font-bold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {transactions.filter(tx => tx.type === 'Transfer').length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No transfers found</td></tr>
                ) : (
                  transactions.filter(tx => tx.type === 'Transfer').map(tx => {
                    const [from, to] = (tx.details || 'Account → Account').split(' → ');
                    return (
                      <tr key={tx.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-4 font-bold">{from}</td>
                        <td className="px-4 py-4 font-bold">{to}</td>
                        <td className="px-4 py-4 font-sans font-black text-blue-400">${Number(tx.amount).toLocaleString()}</td>
                        <td className="px-4 py-4 text-zinc-500">{format(new Date(tx.date), 'MMM dd, HH:mm')}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
