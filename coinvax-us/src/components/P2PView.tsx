import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, Filter, User, Send, CheckCircle2, XCircle, Users, Loader2, Star, Clock, History } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, auth } from '../firebase';
import { format } from 'date-fns';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  updateDoc, 
  doc, 
  serverTimestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';

interface P2POrder {
  id: string;
  uid: string;
  userName?: string;
  type: 'BUY' | 'SELL';
  asset: string;
  amount: number;
  price: number;
  status: 'OPEN' | 'MATCHED' | 'COMPLETED' | 'CANCELLED';
  matchedWith?: string;
  paymentMethod?: string;
  createdAt: number;
  updatedAt?: number;
  completionRate?: number;
  tradesCount?: number;
  typingStatus?: { [uid: string]: boolean };
}

interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  text: string;
  createdAt: number;
}

const generateP2POrders = () => {
  const assets = ['BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE'];
  const types = ['BUY', 'SELL'];
  const names = ['CryptoKing', 'TraderJoe', 'SatoshiFan', 'DiamondHands', 'MoonWalker', 'WhaleAlert', 'BullRun', 'BearMarket', 'Hodler', 'DayTrader', 'AlphaSeeker', 'CoinMaster', 'BlockBuilder', 'ChainLinker', 'DeFiDegen'];
  const paymentMethods = ['Bank Transfer', 'PayPal', 'Revolut', 'Zelle', 'Wise', 'Cash App'];
  const orders = [];
  for (let i = 1; i <= 150; i++) {
    const asset = assets[Math.floor(Math.random() * assets.length)];
    const type = types[Math.floor(Math.random() * types.length)] as 'BUY' | 'SELL';
    const user = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 1000);
    const rawAmount = Math.random() * (asset === 'USDT' ? 5000 : 5);
    const amount = rawAmount.toFixed(4);
    let priceBase = asset === 'BTC' ? 65000 : asset === 'ETH' ? 3500 : asset === 'USDT' ? 1 : asset === 'SOL' ? 150 : asset === 'BNB' ? 600 : 1;
    const rawPrice = priceBase * (1 + (Math.random() * 0.04 - 0.02));
    const price = rawPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    
    orders.push({
      id: `P2P-${i.toString().padStart(4, '0')}`,
      user,
      type,
      asset,
      amount,
      rawAmount,
      price,
      rawPrice,
      paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      completionRate: Math.floor(Math.random() * 20 + 80),
      trades: Math.floor(Math.random() * 1000 + 50)
    });
  }
  return orders;
};

const ALL_P2P_ORDERS = generateP2POrders();

interface P2PViewProps {
  addNotification?: (title: string, message: string) => void;
}

export default function P2PView({ addNotification }: P2PViewProps) {
  const [p2pTab, setP2pTab] = useState<'BUY' | 'SELL'>('BUY');
  const [p2pAmount, setP2pAmount] = useState('');
  const [p2pPrice, setP2pPrice] = useState('');
  const [p2pPaymentMethod, setP2pPaymentMethod] = useState('Bank Transfer');
  const [p2pCurrency, setP2pCurrency] = useState('USDT');
  const [p2pChatOpen, setP2pChatOpen] = useState(false);
  const [p2pChatMessages, setP2pChatMessages] = useState<ChatMessage[]>([]);
  const [p2pChatInput, setP2pChatInput] = useState('');
  const [p2pMatchedUser, setP2pMatchedUser] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedP2POrder, setSelectedP2POrder] = useState<P2POrder | null>(null);
  const [activeOrder, setActiveOrder] = useState<P2POrder | null>(null);
  const [allOrders, setAllOrders] = useState<P2POrder[]>([]);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [p2pChatMessages, peerIsTyping]);

  const [p2pSearch, setP2pSearch] = useState('');
  const [p2pTypeFilter, setP2pTypeFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [p2pAssetFilter, setP2pAssetFilter] = useState('ALL');
  const [p2pPaymentFilter, setP2pPaymentFilter] = useState('ALL');
  const [p2pMinAmount, setP2pMinAmount] = useState('');
  const [p2pMaxAmount, setP2pMaxAmount] = useState('');
  const [p2pStartIndex, setP2pStartIndex] = useState(0);

  // Listen to all open orders
  useEffect(() => {
    const q = query(
      collection(db, 'p2p_orders'),
      where('status', '==', 'OPEN'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as P2POrder));
      // Sort in frontend to avoid needing a composite index
      orders.sort((a, b) => b.createdAt - a.createdAt);
      setAllOrders(orders);
    }, (error) => {
      console.error("Error in P2P orders listener:", error);
      if (error.code === 'failed-precondition') {
        addNotification?.('Index Required', 'Please check the console for the index creation link.');
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to active order and its chat
  useEffect(() => {
    if (!activeOrder) return;

    const orderRef = doc(db, 'p2p_orders', activeOrder.id);
    const unsubscribeOrder = onSnapshot(orderRef, (doc) => {
      if (doc.exists()) {
        const data = { id: doc.id, ...doc.data() } as P2POrder;
        setActiveOrder(data);
        if (data.status === 'MATCHED' && data.matchedWith) {
          setP2pMatchedUser(data.matchedWith);
        }
      } else {
        setActiveOrder(null);
        setP2pChatOpen(false);
      }
    });

    const messagesQuery = query(
      collection(db, 'p2p_chats', activeOrder.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setP2pChatMessages(msgs);
    });

    // Handle typing status listener
    const unsubscribeTyping = onSnapshot(orderRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as P2POrder;
        const peerId = auth.currentUser?.uid === data.uid ? data.matchedWith : data.uid;
        if (peerId && data.typingStatus?.[peerId]) {
          setPeerIsTyping(true);
        } else {
          setPeerIsTyping(false);
        }
      }
    });

    return () => {
      unsubscribeOrder();
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [activeOrder?.id]);

  // Handle typing indicator update
  useEffect(() => {
    if (!activeOrder || !auth.currentUser || !p2pChatOpen) return;

    const updateTypingStatus = async (typing: boolean) => {
      try {
        const orderRef = doc(db, 'p2p_orders', activeOrder.id);
        await updateDoc(orderRef, {
          [`typingStatus.${auth.currentUser?.uid}`]: typing,
          updatedAt: Date.now()
        });
      } catch (error) {
        console.error("Error updating typing status:", error);
      }
    };

    if (isTyping) {
      updateTypingStatus(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        updateTypingStatus(false);
      }, 3000);
    }

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [isTyping, activeOrder?.id, p2pChatOpen]);

  const filteredP2P = allOrders.filter(o => {
    if (p2pTypeFilter !== 'ALL' && o.type !== p2pTypeFilter) return false;
    if (p2pAssetFilter !== 'ALL' && o.asset !== p2pAssetFilter) return false;
    // Note: paymentMethod is not in the Firestore schema yet, but we can add it or ignore for now
    // if (p2pPaymentFilter !== 'ALL' && o.paymentMethod !== p2pPaymentFilter) return false;
    if (p2pSearch && !o.userName?.toLowerCase().includes(p2pSearch.toLowerCase())) return false;
    if (p2pMinAmount && o.amount < Number(p2pMinAmount)) return false;
    if (p2pMaxAmount && o.amount > Number(p2pMaxAmount)) return false;
    return true;
  });

  const displayedP2P = filteredP2P.slice(p2pStartIndex, p2pStartIndex + 10);

  const handleP2pSubmit = async () => {
    if (!auth.currentUser) return;
    if (!p2pAmount || isNaN(Number(p2pAmount)) || Number(p2pAmount) <= 0) return;
    if (!p2pPrice || isNaN(Number(p2pPrice)) || Number(p2pPrice) <= 0) return;
    
    setIsCreatingOrder(true);
    try {
      const orderData = {
        uid: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'User',
        type: p2pTab,
        asset: p2pCurrency,
        amount: Number(p2pAmount),
        price: Number(p2pPrice),
        status: 'OPEN',
        createdAt: Date.now(),
        paymentMethod: p2pPaymentMethod,
        completionRate: Math.floor(Math.random() * 15 + 85), // Mock data
        tradesCount: Math.floor(Math.random() * 500 + 100), // Mock data
        typingStatus: {}
      };

      const docRef = await addDoc(collection(db, 'p2p_orders'), orderData);
      setActiveOrder({ id: docRef.id, ...orderData } as P2POrder);
      setP2pChatOpen(true);
      addNotification?.('P2P Order Created', `Waiting for peer to match ${p2pAmount} ${p2pCurrency}`);
    } catch (error) {
      console.error("Error creating P2P order:", error);
      addNotification?.('Error', 'Failed to create P2P order');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleMatchOrder = async (order: P2POrder) => {
    if (!auth.currentUser) return;
    if (order.uid === auth.currentUser.uid) {
      addNotification?.('Error', 'You cannot match your own order');
      return;
    }

    try {
      await updateDoc(doc(db, 'p2p_orders', order.id), {
        status: 'MATCHED',
        matchedWith: auth.currentUser.uid,
        updatedAt: Date.now()
      });

      setActiveOrder(order);
      setP2pChatOpen(true);
      setSelectedP2POrder(null);
      addNotification?.('P2P Match Found', `Matched with ${order.userName} for ${order.amount} ${order.asset}`);
    } catch (error) {
      console.error("Error matching P2P order:", error);
      addNotification?.('Error', 'Failed to match P2P order');
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'p2p_orders', orderId), {
        status: 'CANCELLED',
        updatedAt: Date.now()
      });
      addNotification?.('Order Cancelled', 'Your P2P order has been cancelled.');
    } catch (error) {
      console.error("Error cancelling P2P order:", error);
      addNotification?.('Error', 'Failed to cancel P2P order');
    }
  };

  const handleCancelP2pOrder = async () => {
    if (!activeOrder || !auth.currentUser) return;
    
    try {
      if (activeOrder.uid === auth.currentUser.uid) {
        await updateDoc(doc(db, 'p2p_orders', activeOrder.id), {
          status: 'CANCELLED',
          updatedAt: Date.now()
        });
      }
      setP2pChatOpen(false);
      setActiveOrder(null);
      setP2pChatMessages([]);
      setP2pMatchedUser(null);
      addNotification?.('Order Cancelled', 'Your P2P order has been cancelled.');
    } catch (error) {
      console.error("Error cancelling P2P order:", error);
    }
  };

  const handleSendP2pMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p2pChatInput.trim() || !activeOrder || !auth.currentUser) return;
    
    try {
      const messageData = {
        orderId: activeOrder.id,
        senderId: auth.currentUser.uid,
        text: p2pChatInput,
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'p2p_chats', activeOrder.id, 'messages'), messageData);
      setP2pChatInput('');
    } catch (error) {
      console.error("Error sending P2P message:", error);
    }
  };

  return (
    <div className="p-4 lg:p-6 flex flex-col gap-6 animate-in fade-in duration-300 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-2">
        <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
          <Users className="w-8 h-8 text-emerald-500" />
          P2P TRADING
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 flex flex-col gap-6">
          {!p2pChatOpen ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
              <div className="flex bg-zinc-950 rounded-xl p-1 mb-6">
                <button 
                  onClick={() => setP2pTab('BUY')}
                  className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all", p2pTab === 'BUY' ? "bg-emerald-500 text-zinc-950" : "text-zinc-500 hover:text-white")}
                >
                  I Want to Buy
                </button>
                <button 
                  onClick={() => setP2pTab('SELL')}
                  className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all", p2pTab === 'SELL' ? "bg-rose-500 text-zinc-950" : "text-zinc-500 hover:text-white")}
                >
                  I Want to Sell
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Asset</label>
                  <select 
                    value={p2pCurrency}
                    onChange={(e) => setP2pCurrency(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 appearance-none font-bold"
                  >
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="USDT">USDT</option>
                    <option value="SOL">SOL</option>
                    <option value="BNB">BNB</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Amount</label>
                  <input 
                    type="number" 
                    value={p2pAmount}
                    onChange={(e) => setP2pAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans font-black"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Price (USD)</label>
                  <input 
                    type="number" 
                    value={p2pPrice}
                    onChange={(e) => setP2pPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans font-black"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Payment Method</label>
                  <select 
                    value={p2pPaymentMethod}
                    onChange={(e) => setP2pPaymentMethod(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 appearance-none font-bold"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="PayPal">PayPal</option>
                    <option value="Revolut">Revolut</option>
                    <option value="Zelle">Zelle</option>
                    <option value="Wise">Wise</option>
                    <option value="Cash App">Cash App</option>
                  </select>
                </div>

                <button 
                  onClick={handleP2pSubmit}
                  disabled={!p2pAmount || Number(p2pAmount) <= 0 || !p2pPrice || Number(p2pPrice) <= 0}
                  className={cn(
                    "w-full font-bold py-4 rounded-xl mt-2 transition-colors flex items-center justify-center gap-2 disabled:opacity-50",
                    p2pTab === 'BUY' ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950" : "bg-rose-500 hover:bg-rose-400 text-zinc-950"
                  )}
                >
                  Create {p2pTab} Offer
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col h-[500px]">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-zinc-400 dark:text-zinc-500 dark:text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="font-bold">{p2pMatchedUser || 'Waiting for Match...'}</h3>
                    <p className="text-xs text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> {p2pMatchedUser ? 'Online' : 'Searching'}
                    </p>
                  </div>
                </div>
                <button onClick={handleCancelP2pOrder} className="text-zinc-500 hover:text-rose-500 transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {p2pChatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <p className="text-sm">Waiting for peer to join...</p>
                  </div>
                )}
                {p2pChatMessages.map((msg, i) => (
                  <div key={i} className={cn("flex flex-col max-w-[80%]", msg.senderId === auth.currentUser?.uid ? "ml-auto items-end" : "mr-auto items-start")}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] text-zinc-500">{msg.senderId === auth.currentUser?.uid ? 'You' : 'Peer'}</span>
                      <span className="text-[10px] text-zinc-600">{format(msg.createdAt, 'HH:mm')}</span>
                    </div>
                    <div className={cn("px-4 py-2 rounded-2xl text-sm", msg.senderId === auth.currentUser?.uid ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-white")}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {peerIsTyping && (
                  <div className="flex items-center gap-2 text-zinc-500 text-xs animate-pulse ml-1">
                    <div className="flex gap-1">
                      <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce"></span>
                      <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                    <span>Peer is typing...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendP2pMessage} className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
                <input 
                  type="text" 
                  value={p2pChatInput}
                  onChange={(e) => {
                    setP2pChatInput(e.target.value);
                    setIsTyping(true);
                  }}
                  placeholder={p2pMatchedUser ? "Type a message..." : "Waiting for peer..."}
                  disabled={!p2pMatchedUser}
                  className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
                />
                <button type="submit" disabled={!p2pMatchedUser} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 p-3 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50">
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2 bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-800 w-full sm:flex-1 sm:min-w-[200px]">
              <Search className="w-4 h-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search user..." 
                value={p2pSearch}
                onChange={(e) => setP2pSearch(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-sm w-full"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-zinc-500 hidden sm:block" />
              <select 
                value={p2pTypeFilter}
                onChange={(e) => setP2pTypeFilter(e.target.value as any)}
                className="flex-1 sm:flex-none py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-colors text-zinc-900 dark:text-white"
              >
                <option value="ALL">All Types</option>
                <option value="BUY">Buy Offers</option>
                <option value="SELL">Sell Offers</option>
              </select>
              <select 
                value={p2pAssetFilter}
                onChange={(e) => setP2pAssetFilter(e.target.value)}
                className="flex-1 sm:flex-none py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-colors text-zinc-900 dark:text-white"
              >
                <option value="ALL">All Assets</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="USDT">USDT</option>
                <option value="SOL">SOL</option>
              </select>
              <select 
                value={p2pPaymentFilter}
                onChange={(e) => setP2pPaymentFilter(e.target.value)}
                className="flex-1 sm:flex-none py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-colors text-zinc-900 dark:text-white"
              >
                <option value="ALL">All Payments</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="PayPal">PayPal</option>
                <option value="Revolut">Revolut</option>
                <option value="Zelle">Zelle</option>
                <option value="Wise">Wise</option>
                <option value="Cash App">Cash App</option>
              </select>
              <div className="flex items-center gap-1 w-full sm:w-auto mt-2 sm:mt-0">
                <input 
                  type="number" 
                  placeholder="Min" 
                  value={p2pMinAmount}
                  onChange={(e) => setP2pMinAmount(e.target.value)}
                  className="flex-1 sm:w-20 py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-colors text-zinc-900 dark:text-white"
                />
                <span className="text-zinc-500">-</span>
                <input 
                  type="number" 
                  placeholder="Max" 
                  value={p2pMaxAmount}
                  onChange={(e) => setP2pMaxAmount(e.target.value)}
                  className="flex-1 sm:w-20 py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-colors text-zinc-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="hidden sm:grid grid-cols-5 gap-4 p-4 border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950">
              <div className="col-span-2">Advertiser</div>
              <div>Price</div>
              <div>Limit/Available</div>
              <div className="text-right">Action</div>
            </div>
            {displayedP2P.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">No orders found matching your criteria.</div>
            ) : (
              displayedP2P.map(order => (
                <div key={order.id} className="flex flex-col sm:grid sm:grid-cols-5 gap-4 p-4 border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors sm:items-center">
                  <div className="sm:col-span-2 flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center font-bold text-zinc-400 shrink-0">
                      {order.userName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="font-bold">{order.userName || 'Unknown User'}</div>
                      <div className="text-xs text-zinc-500 flex items-center gap-2">
                        <span>Verified Merchant</span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">{(order as any).paymentMethod || 'Bank Transfer'}</div>
                    </div>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-xs text-zinc-500 sm:hidden">Price:</span>
                    <div className="font-sans font-black text-lg">${order.price.toLocaleString()}</div>
                  </div>
                  <div className="flex justify-between sm:block">
                    <span className="text-xs text-zinc-500 sm:hidden">Available:</span>
                    <div>
                      <div className="text-sm font-bold">{order.amount} {order.asset}</div>
                      <div className="text-xs text-zinc-500 hidden sm:block">Available</div>
                    </div>
                  </div>
                  <div className="text-right flex items-center justify-end gap-2 mt-2 sm:mt-0">
                    {order.uid === auth.currentUser?.uid && (
                      <button 
                        onClick={() => cancelOrder(order.id)}
                        className="text-xs font-bold px-3 py-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
                      >
                        Cancel
                      </button>
                    )}
                    <button 
                      onClick={() => setSelectedP2POrder(order)}
                      className={cn("text-sm font-bold px-6 py-2 rounded-xl transition-colors w-full sm:w-auto", order.type === 'SELL' ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-zinc-950" : "bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-zinc-950")}
                    >
                      {order.type === 'SELL' ? 'Buy' : 'Sell'} {order.asset}
                    </button>
                  </div>
                </div>
              ))
            )}
            
            <div className="p-4 flex justify-between items-center bg-zinc-950 border-t border-zinc-800">
              <button 
                onClick={() => setP2pStartIndex(Math.max(0, p2pStartIndex - 10))}
                disabled={p2pStartIndex === 0}
                className="px-4 py-2 text-sm font-bold bg-zinc-900 border border-zinc-800 rounded-lg disabled:opacity-50 hover:bg-zinc-800 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-500">
                Showing {p2pStartIndex + 1}-{Math.min(filteredP2P.length, p2pStartIndex + 10)} of {filteredP2P.length}
              </span>
              <button 
                onClick={() => setP2pStartIndex(p2pStartIndex + 10)}
                disabled={p2pStartIndex + 10 >= filteredP2P.length}
                className="px-4 py-2 text-sm font-bold bg-zinc-900 border border-zinc-800 rounded-lg disabled:opacity-50 hover:bg-zinc-800 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* P2P Order Details Modal */}
      {selectedP2POrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
              <h3 className="font-bold text-lg">Order Details</h3>
              <button onClick={() => setSelectedP2POrder(null)} className="text-zinc-500 hover:text-white transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Advertiser Profile Section */}
              <div className="flex items-center gap-4 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-2xl font-black text-emerald-500 border-2 border-emerald-500/20">
                  {selectedP2POrder.userName?.charAt(0) || 'U'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-xl">{selectedP2POrder.userName}</h4>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1 text-zinc-400 text-sm">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-bold text-white">{selectedP2POrder.completionRate || 98}%</span>
                      <span>Completion</span>
                    </div>
                    <div className="flex items-center gap-1 text-zinc-400 text-sm">
                      <History className="w-4 h-4 text-emerald-500" />
                      <span className="font-bold text-white">{selectedP2POrder.tradesCount || 1250}</span>
                      <span>Trades</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Price</span>
                  <div className="font-sans font-black text-emerald-400 text-2xl">${selectedP2POrder.price.toLocaleString()}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Available</span>
                  <div className="font-bold text-xl">{selectedP2POrder.amount} {selectedP2POrder.asset}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Payment Method</span>
                  <span className="font-bold bg-zinc-800 px-3 py-1 rounded-lg text-xs border border-zinc-700">{(selectedP2POrder as any).paymentMethod || 'Bank Transfer'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Avg. Release Time</span>
                  <div className="flex items-center gap-1 font-bold">
                    <Clock className="w-4 h-4 text-zinc-500" />
                    <span>~15 mins</span>
                  </div>
                </div>
              </div>

              {/* Trade History Section */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-3 h-3" />
                  Recent Trade History
                </h5>
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50 text-xs">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", i % 2 === 0 ? "bg-emerald-500" : "bg-rose-500")}></div>
                        <span className="text-zinc-400">{i % 2 === 0 ? 'Buy' : 'Sell'} USDT</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold">$1,250.00</span>
                        <span className="text-zinc-500">{i}h ago</span>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="pt-2">
                <button 
                  onClick={() => handleMatchOrder(selectedP2POrder)}
                  className={cn("w-full font-black py-4 rounded-xl transition-all active:scale-[0.98] shadow-lg", selectedP2POrder.type === 'SELL' ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20" : "bg-rose-500 hover:bg-rose-400 text-zinc-950 shadow-rose-500/20")}
                >
                  Confirm {selectedP2POrder.type === 'SELL' ? 'Buy' : 'Sell'} Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
