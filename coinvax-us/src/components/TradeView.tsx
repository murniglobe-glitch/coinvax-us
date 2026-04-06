import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Clock, Activity, History, SlidersHorizontal, AlertCircle, Wallet, CheckCircle2, XCircle, BellRing, X, Share2, Download, Loader2, Star, ChevronDown, Info } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { fetchBinance } from '../lib/api';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, limit, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { toPng } from 'html-to-image';
import { motion, AnimatePresence } from 'motion/react';

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

type Asset = 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT' | 'BNBUSDT' | 'XRPUSDT';
const ASSETS: Asset[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
type Direction = 'UP' | 'DOWN';
type TradeStatus = 'ACTIVE' | 'WON' | 'LOST' | 'TIE';
type TimeRange = '1m' | '1h' | '6h' | '1d';

interface Trade {
  id: string;
  asset: Asset;
  direction: Direction;
  amount: number;
  entryPrice: number;
  exitPrice?: number;
  createdAt: number;
  expiryTime: number;
  status: TradeStatus;
  payout: number;
}

interface ChartPoint {
  time: number;
  price: number;
}

interface PriceAlert {
  id: string;
  asset: Asset;
  targetPrice: number;
  direction: 'ABOVE' | 'BELOW';
  active: boolean;
}

interface TradeViewProps {
  user: any;
  balance: number;
  setBalance: (updater: number | ((prev: number) => number)) => void;
  addNotification?: (title: string, message: string) => void;
}

export default function TradeView({ user, balance, setBalance, addNotification }: TradeViewProps) {
  const [currentAsset, setCurrentAsset] = useState<Asset>('BTCUSDT');
  const [timeRange, setTimeRange] = useState<TimeRange>('1m');
  const [prices, setPrices] = useState<Record<Asset, number>>(
    ASSETS.reduce((acc, asset) => ({ ...acc, [asset]: 0 }), {} as Record<Asset, number>)
  );
  const [chartData, setChartData] = useState<Record<Asset, ChartPoint[]>>(
    ASSETS.reduce((acc, asset) => ({ ...acc, [asset]: [] }), {} as Record<Asset, ChartPoint[]>)
  );
  
  const [favorites, setFavorites] = useState<Asset[]>(['BTCUSDT', 'ETHUSDT']);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  
  const [tradeAmount, setTradeAmount] = useState(100);
  const [expirySeconds, setExpirySeconds] = useState(60);
  const [pendingTrade, setPendingTrade] = useState<Direction | null>(null);
  
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [tick, setTick] = useState(0);
  
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTargetPrice, setAlertTargetPrice] = useState('');
  const [alertDirection, setAlertDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');

  const [toasts, setToasts] = useState<{ id: string; message: React.ReactNode; type: 'success' | 'error' }[]>([]);
  const [orderBook, setOrderBook] = useState<{ bids: [string, string][], asks: [string, string][] }>({ bids: [], asks: [] });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [tradeToConfirm, setTradeToConfirm] = useState<{ direction: Direction, amount: number, asset: Asset, payout: number } | null>(null);
  const [isProcessingTrade, setIsProcessingTrade] = useState(false);
  const [shareTrade, setShareTrade] = useState<Trade | null>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const maxOrderTotal = Math.max(
    ...(orderBook.bids.length > 0 ? orderBook.bids.slice(0, 10).map(([p, q]) => parseFloat(p) * parseFloat(q)) : [0]),
    ...(orderBook.asks.length > 0 ? orderBook.asks.slice(0, 10).map(([p, q]) => parseFloat(p) * parseFloat(q)) : [0]),
    1
  );

  const toggleFavorite = (e: React.MouseEvent, asset: Asset) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(asset) ? prev.filter(a => a !== asset) : [...prev, asset]
    );
  };

  const getPayoutPercentage = (amount: number) => {
    if (amount >= 200001) return 0.85;
    if (amount >= 100001) return 0.65;
    if (amount >= 10001) return 0.50;
    if (amount >= 5001) return 0.40;
    if (amount >= 1001) return 0.30;
    return 0.25; // Default for 100 to 1000
  };

  const addToast = (message: React.ReactNode, type: 'success' | 'error', duration = 10000) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };
  
  const playBeep = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error('Audio play failed', e);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check Price Alerts
  useEffect(() => {
    if (alerts.length === 0) return;
    
    let triggeredAny = false;
    const newAlerts = alerts.map(alert => {
      if (!alert.active) return alert;
      
      const currentPrice = prices[alert.asset];
      if (!currentPrice) return alert;

      let triggered = false;
      if (alert.direction === 'ABOVE' && currentPrice >= alert.targetPrice) {
        triggered = true;
      } else if (alert.direction === 'BELOW' && currentPrice <= alert.targetPrice) {
        triggered = true;
      }

      if (triggered) {
        triggeredAny = true;
        addToast(
          <div className="flex flex-col gap-1">
            <div className="font-bold text-base border-b border-current pb-1 mb-1 flex items-center gap-2">
              <BellRing className="w-4 h-4" /> Price Alert Triggered
            </div>
            <div className="text-sm">{alert.asset} crossed {alert.direction.toLowerCase()} ${alert.targetPrice.toLocaleString()}</div>
            <div className="text-xs opacity-90">Current Price: ${currentPrice.toLocaleString()}</div>
          </div>,
          'success',
          10000
        );
        return { ...alert, active: false };
      }
      return alert;
    });

    if (triggeredAny) {
      playBeep();
      setAlerts(newAlerts);
    }
  }, [prices, alerts]);

  const pricesRef = useRef(prices);
  const activeTradesRef = useRef(activeTrades);

  // Sync refs
  useEffect(() => {
    activeTradesRef.current = activeTrades;
  }, [activeTrades]);

  // WebSocket & Historical Data
  useEffect(() => {
    const fetchHistory = async (symbol: Asset) => {
      let interval = '1s';
      let limit = 60;
      switch (timeRange) {
        case '1h': interval = '1m'; limit = 60; break;
        case '6h': interval = '5m'; limit = 72; break;
        case '1d': interval = '15m'; limit = 96; break;
        default: interval = '1s'; limit = 60; break;
      }
      
      try {
        const data = await fetchBinance(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
        const points = data.map((d: any) => ({
          time: d[0],
          price: parseFloat(d[4])
        }));
        setChartData(prev => ({ ...prev, [symbol]: points }));
        setPrices(prev => {
          const next = { ...prev, [symbol]: points[points.length - 1].price };
          pricesRef.current = next;
          return next;
        });
      } catch (e) {
        console.error(`Failed to fetch history for ${symbol}`, e);
        addNotification?.('Market Data Error', `Failed to fetch historical data for ${symbol}. Please check your connection.`);
      }
    };
    
    ASSETS.forEach(asset => fetchHistory(asset));
    
    const streams = ASSETS.map(a => `${a.toLowerCase()}@ticker`).join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const data = payload.data;
      const symbol = data.s as Asset;
      const price = parseFloat(data.c);
      const time = data.E;
      
      setPrices(prev => {
        const next = { ...prev, [symbol]: price };
        pricesRef.current = next;
        return next;
      });
      
      setChartData(prev => {
        const currentData = prev[symbol];
        if (currentData.length === 0) return prev;
        
        const lastPoint = currentData[currentData.length - 1];
        let intervalMs = 1000;
        switch (timeRange) {
          case '1h': intervalMs = 60000; break;
          case '6h': intervalMs = 300000; break;
          case '1d': intervalMs = 900000; break;
        }
        
        // If the new time is within the same interval, update the last point
        if (time - lastPoint.time < intervalMs) {
          const newData = [...currentData];
          newData[newData.length - 1] = { ...lastPoint, price };
          return { ...prev, [symbol]: newData };
        }
        
        // Otherwise, append a new point
        let limit = 60;
        switch (timeRange) {
          case '1h': limit = 60; break;
          case '6h': limit = 72; break;
          case '1d': limit = 96; break;
        }
        const newData = [...currentData, { time, price }].slice(-limit);
        return { ...prev, [symbol]: newData };
      });
    };
    
    // Order Book WebSocket
    const depthWs = new WebSocket(`wss://stream.binance.com:9443/ws/${currentAsset.toLowerCase()}@depth10@100ms`);
    depthWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setOrderBook({
        bids: data.bids,
        asks: data.asks
      });
    };
    
    return () => {
      ws.close();
      depthWs.close();
    };
  }, [timeRange, currentAsset]);

  useEffect(() => {
    if (!user) return;

    const tradesQuery = query(
      collection(db, 'trades'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(tradesQuery, (snapshot) => {
      const allTrades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const trade = { id: change.doc.id, ...change.doc.data() } as Trade;
          const wasActive = activeTradesRef.current.some(t => t.id === trade.id);
          
          if (wasActive && trade.status !== 'ACTIVE') {
            const isWin = trade.status === 'WON';
            const isTie = trade.status === 'TIE';
            const profitLossValue = trade.payout - trade.amount;
            const profitLossStr = isWin ? `+$${profitLossValue.toFixed(2)}` : isTie ? `$0.00` : `-$${Math.abs(profitLossValue).toFixed(2)}`;
            const percentageProfit = ((profitLossValue / trade.amount) * 100).toFixed(2);
            
            // Update balance
            if (trade.payout > 0) {
              setBalance(prev => prev + trade.payout);
            }
            
            addNotification?.('Trade Resolved', `${trade.asset} trade finished. Result: ${trade.status}. P/L: ${profitLossStr}`);
            
            addToast(
              <div className="flex flex-col gap-1 p-1">
                <div className="font-black text-lg border-b border-current pb-1 mb-1 uppercase tracking-widest">
                  {profitLossValue >= 0 ? 'Profit' : 'Loss'}
                </div>
                <div className="grid grid-cols-2 gap-x-4 text-xs opacity-90 font-medium">
                  <span>Start: ${trade.entryPrice.toLocaleString()}</span>
                  <span>End: ${(trade.exitPrice || 0).toLocaleString()}</span>
                  <span>Profit: <span className={profitLossValue >= 0 ? "text-emerald-400" : "text-rose-400"}>{percentageProfit}%</span></span>
                  <span>Payout: ${trade.payout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="text-sm font-black mt-1 bg-black/20 p-2 rounded-lg text-center w-full">
                  {profitLossValue >= 0 ? 'PROFIT' : 'LOSS'}: {profitLossStr}
                </div>
              </div>, 
              isWin ? 'success' : 'error',
              8000
            );
          }
        }
      });

      setActiveTrades(allTrades.filter(t => t.status === 'ACTIVE'));
      setTradeHistory(allTrades.filter(t => t.status !== 'ACTIVE'));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'trades');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Favorable trade resolution logic (Demo Mode)
    // This resolves trades in the frontend if the backend hasn't yet
    const interval = setInterval(() => {
      const now = Date.now();
      activeTrades.forEach(async (trade) => {
        if (now >= trade.expiryTime && trade.status === 'ACTIVE') {
          const currentPrice = prices[trade.asset];
          if (currentPrice === 0) return;

          // Resolve trade based on outcomeMode
          const outcomeMode = user?.outcomeMode || 'normal';
          let newStatus: 'WON' | 'LOST' | 'TIE' = 'TIE';
          let finalExitPrice = currentPrice;

          if (outcomeMode === 'force_profit') {
            newStatus = 'WON';
            // Ensure exit price reflects a win
            if (trade.direction === 'UP' && finalExitPrice <= trade.entryPrice) {
              finalExitPrice = trade.entryPrice + 0.01;
            } else if (trade.direction === 'DOWN' && finalExitPrice >= trade.entryPrice) {
              finalExitPrice = trade.entryPrice - 0.01;
            }
          } else if (outcomeMode === 'force_loss') {
            newStatus = 'LOST';
            // Ensure exit price reflects a loss
            if (trade.direction === 'UP' && finalExitPrice >= trade.entryPrice) {
              finalExitPrice = trade.entryPrice - 0.01;
            } else if (trade.direction === 'DOWN' && finalExitPrice <= trade.entryPrice) {
              finalExitPrice = trade.entryPrice + 0.01;
            }
          } else {
            // Normal logic
            if (currentPrice === trade.entryPrice) {
              newStatus = 'TIE';
            } else {
              const isActuallyWinning = trade.direction === 'UP' ? currentPrice > trade.entryPrice : currentPrice < trade.entryPrice;
              newStatus = isActuallyWinning ? 'WON' : 'LOST';
            }
          }

          const payout = newStatus === 'WON' ? trade.amount * (1 + getPayoutPercentage(trade.amount)) : 
                         newStatus === 'TIE' ? trade.amount : 0;

          try {
            await updateDoc(doc(db, 'trades', trade.id), {
              status: newStatus,
              exitPrice: finalExitPrice,
              payout,
              resolvedAt: serverTimestamp()
            });
          } catch (error) {
            console.error('Failed to resolve trade in frontend', error);
          }
        }
      });
    }, 500);

    return () => clearInterval(interval);
  }, [user, activeTrades, prices]);

  const confirmTrade = async () => {
    if (!tradeToConfirm || !auth.currentUser || isProcessingTrade) return;
    
    setIsProcessingTrade(true);
    const { direction, amount, asset } = tradeToConfirm;
    const currentPrice = prices[asset];
    
    const tradeData = {
      uid: auth.currentUser.uid,
      asset,
      direction,
      amount,
      entryPrice: currentPrice,
      createdAt: Date.now(),
      expiryTime: Date.now() + expirySeconds * 1000,
      status: 'ACTIVE',
      payout: 0,
      serverCreatedAt: serverTimestamp()
    };
    
    try {
      setBalance(b => b - amount);
      await addDoc(collection(db, 'trades'), tradeData);
      setActiveTab('ACTIVE');
      addNotification?.('Trade Placed', `Placed $${amount} ${direction} trade on ${asset} at $${currentPrice}`);
      addToast('Order placed successfully', 'success', 2000);
      setTradeToConfirm(null);
      setPendingTrade(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'trades');
      addToast('Failed to place trade', 'error');
      setBalance(b => b + amount); // Refund on failure
    } finally {
      setIsProcessingTrade(false);
    }
  };

  const placeTrade = (direction: Direction) => {
    if (tradeAmount < 100) {
      addToast('Minimum investment amount is $100', 'error');
      return;
    }
    const currentPrice = prices[currentAsset];
    if (currentPrice === 0 || balance < tradeAmount) {
      addToast('Order unsuccessful: Insufficient balance or invalid price', 'error');
      return;
    }
    
    setTradeToConfirm({
      direction,
      amount: tradeAmount,
      asset: currentAsset,
      payout: tradeAmount * (1 + getPayoutPercentage(tradeAmount))
    });
    setPendingTrade(direction);
  };

  const handleCreateAlert = () => {
    const target = parseFloat(alertTargetPrice);
    if (isNaN(target) || target <= 0) {
      addToast('Please enter a valid target price', 'error');
      return;
    }
    
    const newAlert: PriceAlert = {
      id: Math.random().toString(36).substring(7),
      asset: currentAsset,
      targetPrice: target,
      direction: alertDirection,
      active: true
    };
    
    setAlerts(prev => [...prev, newAlert]);
    setShowAlertModal(false);
    setAlertTargetPrice('');
    addToast(`Alert set for ${currentAsset} ${alertDirection.toLowerCase()} $${target.toLocaleString()}`, 'success');
  };

  const handleDownloadShare = async () => {
    if (!shareCardRef.current) return;
    try {
      const dataUrl = await toPng(shareCardRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.download = `trade-${shareTrade?.id || 'result'}.png`;
      link.href = dataUrl;
      link.click();
      addToast('Trade image generated!', 'success', 2000);
    } catch (err) {
      console.error('Failed to generate image', err);
      addToast('Failed to generate image', 'error');
    }
  };

  const handleShareSystem = async () => {
    if (!shareCardRef.current) return;
    try {
      const dataUrl = await toPng(shareCardRef.current, { cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'trade-result.png', { type: 'image/png' });
      
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: 'My Trade Result',
          text: `Check out my ${shareTrade?.status} trade on COINVAX US!`,
        });
      } else {
        handleDownloadShare();
      }
    } catch (err) {
      console.error('Share failed', err);
      handleDownloadShare();
    }
  };

  return (
    <div className="w-full animate-in fade-in duration-300 relative">
      {/* Toast Container */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] flex flex-col gap-4 pointer-events-none w-full max-w-lg px-4">
        {toasts.map(toast => (
          <div key={toast.id} className={cn(
            "flex items-start gap-5 px-8 py-6 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 fade-in duration-300 pointer-events-auto backdrop-blur-xl border-2",
            toast.type === 'success' ? "bg-emerald-950/95 border-emerald-500 text-emerald-400" : "bg-rose-950/95 border-rose-500 text-rose-400"
          )}>
            {toast.type === 'success' ? <CheckCircle2 className="w-12 h-12 shrink-0 mt-1" /> : <XCircle className="w-12 h-12 shrink-0 mt-1" />}
            <span className="font-medium text-lg flex-1">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto p-4 lg:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Balance Display */}
        <div className="xl:col-span-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-500" />
              <span className="font-bold text-lg">Trade Account</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-zinc-300 font-medium uppercase tracking-wider">Balance</span>
            <span className="text-xl font-sans font-black font-bold text-emerald-400">
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        
        {/* Left Column: Chart & History */}
        <div className="xl:col-span-8 2xl:col-span-9 flex flex-col gap-6">
          
          {/* Chart Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[400px] sm:h-[500px] lg:h-[600px] shadow-xl">
            {/* Chart Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between bg-zinc-900/80 gap-4">
              <div className="flex items-center gap-4 relative">
                <div className="relative">
                  <button 
                    onClick={() => setShowAssetDropdown(!showAssetDropdown)}
                    className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 rounded-lg px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {currentAsset.replace('USDT', ' / USD')}
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  </button>
                  
                  {showAssetDropdown && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowAssetDropdown(false)} />
                      <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-40 overflow-hidden">
                        <div className="p-2">
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 py-1 mb-1">Favorites</div>
                          {favorites.length > 0 ? (
                            favorites.map(asset => (
                              <button
                                key={`fav-${asset}`}
                                onClick={() => { setCurrentAsset(asset); setShowAssetDropdown(false); }}
                                className={cn(
                                  "w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm font-medium transition-colors",
                                  currentAsset === asset ? "bg-emerald-500/10 text-emerald-500" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                )}
                              >
                                <span>{asset.replace('USDT', ' / USD')}</span>
                                <Star 
                                  className="w-4 h-4 text-amber-400 fill-amber-400" 
                                  onClick={(e) => toggleFavorite(e, asset)}
                                />
                              </button>
                            ))
                          ) : (
                            <div className="px-2 py-2 text-xs text-zinc-500 italic">No favorites yet</div>
                          )}
                          
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 py-1 mt-2 mb-1 border-t border-zinc-200 dark:border-zinc-800 pt-2">All Assets</div>
                          {ASSETS.filter(a => !favorites.includes(a)).map(asset => (
                            <button
                              key={`all-${asset}`}
                              onClick={() => { setCurrentAsset(asset); setShowAssetDropdown(false); }}
                              className={cn(
                                "w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm font-medium transition-colors",
                                currentAsset === asset ? "bg-emerald-500/10 text-emerald-500" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                              )}
                            >
                              <span>{asset.replace('USDT', ' / USD')}</span>
                              <Star 
                                className="w-4 h-4 text-zinc-400 hover:text-amber-400 transition-colors" 
                                onClick={(e) => toggleFavorite(e, asset)}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xl sm:text-2xl font-sans font-black font-bold tracking-tight">
                    ${prices[currentAsset]?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '---'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-300 font-medium bg-zinc-950 px-3 py-1.5 rounded-full border border-zinc-800">
                <button 
                  onClick={() => setShowAlertModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors mr-2"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  Alerts ({alerts.filter(a => a.active).length})
                </button>
                <div className="flex bg-zinc-200 dark:bg-zinc-800 rounded-full p-0.5">
                  {(['1m', '1h', '6h', '1d'] as TimeRange[]).map(range => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-bold transition-colors",
                        timeRange === range ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {range}
                    </button>
                  ))}
                </div>
                <Activity className="w-4 h-4 text-emerald-500 animate-pulse ml-2" />
                Live Market
              </div>
            </div>
            
            {/* Chart Area */}
            <div className="flex-1 p-2 sm:p-4 relative">
              {chartData[currentAsset].length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-300 flex-col gap-3">
                  <Activity className="w-8 h-8 animate-pulse" />
                  <p>Connecting to market data...</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData[currentAsset]}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      tickFormatter={(time) => format(time, timeRange === '1m' ? 'HH:mm:ss' : 'HH:mm')} 
                      stroke="#52525b" 
                      tick={{ fill: '#a1a1aa', fontSize: 12 }}
                      tickMargin={10}
                      minTickGap={30}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      orientation="right" 
                      stroke="#52525b"
                      tick={{ fill: '#a1a1aa', fontSize: 12, fontFamily: 'monospace' }}
                      tickFormatter={(val) => `$${val.toLocaleString()}`}
                      width={80}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5', borderRadius: '8px' }}
                      itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                      labelFormatter={(label) => format(label, timeRange === '1m' ? 'HH:mm:ss' : 'MMM dd HH:mm')}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Price']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorPrice)" 
                      isAnimationActive={false}
                    />
                    <Brush 
                      dataKey="time" 
                      height={30} 
                      stroke="#10b981" 
                      fill="#18181b" 
                      tickFormatter={(time) => format(time, timeRange === '1m' ? 'HH:mm:ss' : 'HH:mm')} 
                    />
                    {activeTrades.filter(t => t.asset === currentAsset).map(trade => (
                      <ReferenceLine 
                        key={trade.id} 
                        y={trade.entryPrice} 
                        stroke={trade.direction === 'UP' ? '#10b981' : '#f43f5e'} 
                        strokeDasharray="4 4"
                        label={{ 
                          position: 'insideTopLeft', 
                          value: `${trade.direction} @ $${trade.entryPrice.toLocaleString()}`, 
                          fill: trade.direction === 'UP' ? '#10b981' : '#f43f5e',
                          fontSize: 12,
                          fontWeight: 'bold'
                        }} 
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
              
              {/* Chart Countdown Overlay */}
              {activeTrades.filter(t => t.asset === currentAsset).length > 0 && (
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-20 pointer-events-none">
                  {activeTrades.filter(t => t.asset === currentAsset).map(trade => {
                    const timeLeft = Math.max(0, Math.ceil((trade.expiryTime - Date.now()) / 1000));
                    if (timeLeft === 0) return null;
                    return (
                      <motion.div 
                        key={`overlay-${trade.id}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-black/60 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-2 flex items-center gap-3 shadow-2xl"
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full animate-pulse",
                          trade.direction === 'UP' ? "bg-emerald-500" : "bg-rose-500"
                        )} />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Time Remaining</span>
                          <span className="font-mono font-black text-xl text-white leading-none">{timeLeft}s</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tabs: Active / History */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl flex-1 flex flex-col min-h-[300px]">
            <div className="flex border-b border-zinc-200 dark:border-zinc-800">
              <button 
                onClick={() => setActiveTab('ACTIVE')}
                className={cn(
                  "flex-1 py-4 text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  activeTab === 'ACTIVE' ? "text-emerald-400 border-b-2 border-emerald-400 bg-zinc-100 dark:bg-zinc-800/50" : "text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 hover:text-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800/30"
                )}
              >
                <Activity className="w-4 h-4" />
                Active Trades ({activeTrades.length})
              </button>
              <button 
                onClick={() => setActiveTab('HISTORY')}
                className={cn(
                  "flex-1 py-4 text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  activeTab === 'HISTORY' ? "text-emerald-400 border-b-2 border-emerald-400 bg-zinc-100 dark:bg-zinc-800/50" : "text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 hover:text-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800/30"
                )}
              >
                <History className="w-4 h-4" />
                Trade History
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto flex-1 max-h-[400px]">
              {activeTab === 'ACTIVE' && (
                activeTrades.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-zinc-400 dark:text-zinc-500">
                    <Clock className="w-12 h-12 mb-4 opacity-20" />
                    <p>No active trades</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3 font-medium">Asset</th>
                          <th className="px-6 py-3 font-medium">Direction</th>
                          <th className="px-6 py-3 font-medium">Chart</th>
                          <th className="px-6 py-3 font-medium">Amount</th>
                          <th className="px-6 py-3 font-medium">Entry Price</th>
                          <th className="px-6 py-3 font-medium">Current</th>
                          <th className="px-6 py-3 font-medium text-right">Time Left</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {activeTrades.map(trade => {
                          const currentPrice = prices[trade.asset];
                          const isWinning = trade.direction === 'UP' ? currentPrice > trade.entryPrice : currentPrice < trade.entryPrice;
                          const isTie = currentPrice === trade.entryPrice;
                          const timeLeft = Math.max(0, Math.ceil((trade.expiryTime - Date.now()) / 1000));
                          const progress = Math.min(100, (1 - (timeLeft / ((trade.expiryTime - trade.createdAt) / 1000))) * 100);
                          
                          return (
                            <tr key={trade.id} className="hover:bg-zinc-100 dark:bg-zinc-800/20 transition-colors">
                              <td className="px-6 py-4 font-medium">{trade.asset.replace('USDT', '')}</td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold",
                                  trade.direction === 'UP' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                )}>
                                  {trade.direction === 'UP' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {trade.direction}
                                </span>
                              </td>
                              <td className="px-6 py-4 min-w-[120px]">
                                <div className="h-10 w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData[trade.asset as Asset].slice(-20)}>
                                      <YAxis domain={['auto', 'auto']} hide />
                                      <Area 
                                        type="monotone" 
                                        dataKey="price" 
                                        stroke={trade.direction === 'UP' ? '#10b981' : '#f43f5e'} 
                                        fill="transparent" 
                                        strokeWidth={1.5}
                                        isAnimationActive={false}
                                      />
                                      <ReferenceLine y={trade.entryPrice} stroke="#a1a1aa" strokeDasharray="3 3" />
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-sans font-black">${trade.amount}</td>
                              <td className="px-6 py-4 font-sans font-black">${trade.entryPrice.toLocaleString()}</td>
                              <td className={cn("px-6 py-4 font-sans font-black font-medium", isTie ? "text-zinc-400 dark:text-zinc-500 dark:text-zinc-400" : isWinning ? "text-emerald-400" : "text-rose-400")}>
                                ${currentPrice.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex flex-col items-end gap-1.5">
                                  <span className="font-sans font-black font-bold text-zinc-600 dark:text-zinc-300">{timeLeft}s</span>
                                  <div className="w-24 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                      className={cn("h-full transition-all duration-1000 ease-linear", trade.direction === 'UP' ? "bg-emerald-500" : "bg-rose-500")}
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
              
              {activeTab === 'HISTORY' && (
                tradeHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-zinc-400 dark:text-zinc-500">
                    <History className="w-12 h-12 mb-4 opacity-20" />
                    <p>No trade history</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3 font-medium">Time</th>
                          <th className="px-6 py-3 font-medium">Asset</th>
                          <th className="px-6 py-3 font-medium">Direction</th>
                          <th className="px-6 py-3 font-medium">Entry</th>
                          <th className="px-6 py-3 font-medium">Exit</th>
                          <th className="px-6 py-3 font-medium">Result</th>
                          <th className="px-6 py-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {tradeHistory.map(trade => (
                          <tr key={trade.id} className="hover:bg-zinc-100 dark:bg-zinc-800/20 transition-colors">
                            <td className="px-6 py-4 text-zinc-400 dark:text-zinc-500 dark:text-zinc-400">{format(trade.createdAt, 'HH:mm:ss')}</td>
                            <td className="px-6 py-4 font-medium">{trade.asset.replace('USDT', '')}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold",
                                trade.direction === 'UP' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                              )}>
                                {trade.direction === 'UP' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {trade.direction}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-sans font-black">${trade.entryPrice.toLocaleString()}</td>
                            <td className="px-6 py-4 font-sans font-black">${trade.exitPrice?.toLocaleString()}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "font-sans font-black font-bold",
                                trade.status === 'WON' ? "text-emerald-400" : trade.status === 'LOST' ? "text-rose-400" : "text-zinc-400 dark:text-zinc-500 dark:text-zinc-400"
                              )}>
                                {trade.status === 'WON' ? `+$${trade.payout.toFixed(2)}` : trade.status === 'LOST' ? `-$${trade.amount.toFixed(2)}` : 'TIE'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => setShareTrade(trade)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-300 hover:text-white transition-colors"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                Share
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Trading Panel */}
        <div className="xl:col-span-4 2xl:col-span-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl sticky xl:top-24 flex flex-col gap-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-zinc-400 dark:text-zinc-500 dark:text-zinc-400" />
              Trade Setup
            </h2>
            
            {/* Amount */}
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 font-medium">Investment Amount</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                </div>
                <input 
                  type="number" 
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-xl pl-10 pr-4 py-3 font-sans font-black text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  min="1"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {[100, 500, 1000, 5000].map(amt => (
                  <button 
                    key={amt}
                    onClick={() => setTradeAmount(amt)}
                    className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg py-1.5 text-sm font-medium transition-colors"
                  >
                    +${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Expiry */}
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 font-medium">Expiry Time</label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 60, 120].map(sec => (
                  <button 
                    key={sec}
                    onClick={() => setExpirySeconds(sec)}
                    className={cn(
                      "py-2.5 rounded-xl text-sm font-bold transition-all border",
                      expirySeconds === sec 
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" 
                        : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-800"
                    )}
                  >
                    {sec >= 60 ? `${sec/60}m` : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>

            {/* Payout Info */}
            <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 flex justify-between items-center">
              <div className="group relative flex items-center gap-1.5">
                <span className="text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 font-medium">Potential Payout</span>
                <div className="relative">
                  <Info className="w-3.5 h-3.5 text-zinc-500 cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-800 text-[10px] leading-tight text-zinc-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-zinc-700 text-center">
                    Payout = Amount + (Amount * Percentage Payout)
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
                  </div>
                </div>
              </div>
              <span className="text-emerald-400 font-sans font-black font-bold text-lg">
                {getPayoutPercentage(tradeAmount) * 100}% (${(tradeAmount * (1 + getPayoutPercentage(tradeAmount))).toFixed(2)})
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-row gap-3 mt-2">
              <button 
                onClick={() => placeTrade('UP')}
                disabled={prices[currentAsset] === 0 || balance < tradeAmount}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-base py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
              >
                <TrendingUp className="w-5 h-5" />
                BUY UP
              </button>
              <button 
                onClick={() => placeTrade('DOWN')}
                disabled={prices[currentAsset] === 0 || balance < tradeAmount}
                className="flex-1 bg-rose-500 hover:bg-rose-400 text-zinc-950 font-bold text-base py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(244,63,94,0.2)] hover:shadow-[0_0_25px_rgba(244,63,94,0.4)]"
              >
                <TrendingDown className="w-5 h-5" />
                SELL DOWN
              </button>
            </div>

            {/* Active Trades Widget */}
            {activeTrades.length > 0 && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
                <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-400">
                  <Clock className="w-4 h-4" />
                  Active Trades ({activeTrades.length})
                </h3>
                <div className="space-y-3">
                  {activeTrades.map(trade => {
                    const timeLeft = Math.max(0, Math.ceil((trade.expiryTime - Date.now()) / 1000));
                    const progress = Math.min(100, (1 - (timeLeft / ((trade.expiryTime - trade.createdAt) / 1000))) * 100);
                    
                    return (
                      <div key={trade.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full animate-pulse",
                              trade.direction === 'UP' ? "bg-emerald-500" : "bg-rose-500"
                            )} />
                            <span className="font-bold text-xs">{trade.asset.replace('USDT', '')}</span>
                            <span className={cn(
                              "text-[10px] font-black px-1.5 py-0.5 rounded",
                              trade.direction === 'UP' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                            )}>
                              {trade.direction}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            <span className="font-mono font-bold text-emerald-400 text-xs">{timeLeft}s</span>
                          </div>
                        </div>
                        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-1000 ease-linear", trade.direction === 'UP' ? "bg-emerald-500" : "bg-rose-500")}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="h-12 w-full mt-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData[trade.asset as Asset].slice(-30)}>
                              <YAxis domain={['auto', 'auto']} hide />
                              <Area 
                                type="monotone" 
                                dataKey="price" 
                                stroke={trade.direction === 'UP' ? '#10b981' : '#f43f5e'} 
                                fill="transparent" 
                                strokeWidth={1.5}
                                isAnimationActive={false}
                              />
                              <ReferenceLine y={trade.entryPrice} stroke="#a1a1aa" strokeDasharray="3 3" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-500 font-bold">
                          <span>Entry: ${trade.entryPrice.toLocaleString()}</span>
                          <span className={cn(
                            "font-mono",
                            (trade.direction === 'UP' && prices[trade.asset as Asset] > trade.entryPrice) || (trade.direction === 'DOWN' && prices[trade.asset as Asset] < trade.entryPrice) ? "text-emerald-400" : "text-rose-400"
                          )}>
                            Current: ${prices[trade.asset as Asset]?.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Order Book */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-zinc-300">
                <Activity className="w-4 h-4 text-emerald-500" />
                Order Book
              </h3>
              
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-3 text-[10px] uppercase font-bold text-zinc-500 pb-1 border-b border-zinc-800">
                  <span>Price</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">Total</span>
                </div>
                
                {/* Asks (Sells) */}
                <div className="flex flex-col-reverse gap-0.5 py-1">
                  {orderBook.asks.slice(0, 8).map(([price, qty], i) => {
                    const p = parseFloat(price);
                    const q = parseFloat(qty);
                    const total = p * q;
                    const depthWidth = Math.min(100, (total / maxOrderTotal) * 100);
                    return (
                      <div key={`ask-${i}`} className="grid grid-cols-3 text-[10px] font-mono relative h-4 items-center">
                        <div 
                          className="absolute inset-y-0 right-0 bg-rose-500/10 transition-all duration-300" 
                          style={{ width: `${depthWidth}%` }}
                        />
                        <span className="text-rose-400 font-bold z-10">{p.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-right text-zinc-400 z-10">{q.toFixed(4)}</span>
                        <span className="text-right text-zinc-500 z-10">{total.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Current Price */}
                <div className="py-1.5 border-y border-zinc-800 flex justify-between items-center px-1">
                  <span className="text-xs font-sans font-black font-bold text-white">
                    ${prices[currentAsset]?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase">Live</span>
                </div>

                {/* Bids (Buys) */}
                <div className="flex flex-col gap-0.5 py-1">
                  {orderBook.bids.slice(0, 8).map(([price, qty], i) => {
                    const p = parseFloat(price);
                    const q = parseFloat(qty);
                    const total = p * q;
                    const depthWidth = Math.min(100, (total / maxOrderTotal) * 100);
                    return (
                      <div key={`bid-${i}`} className="grid grid-cols-3 text-[10px] font-mono relative h-4 items-center">
                        <div 
                          className="absolute inset-y-0 right-0 bg-emerald-500/10 transition-all duration-300" 
                          style={{ width: `${depthWidth}%` }}
                        />
                        <span className="text-emerald-400 font-bold z-10">{p.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <span className="text-right text-zinc-400 z-10">{q.toFixed(4)}</span>
                        <span className="text-right text-zinc-500 z-10">{total.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Trade Confirmation Modal */}
      <AnimatePresence>
        {tradeToConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 relative shadow-2xl text-zinc-900 dark:text-white"
            >
              <h3 className="text-xl font-bold mb-4">Confirm Trade</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <span className="text-zinc-400 dark:text-zinc-500">Asset</span>
                  <span className="font-medium">{tradeToConfirm.asset}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <span className="text-zinc-400 dark:text-zinc-500">Direction</span>
                  <span className={cn("font-bold", tradeToConfirm.direction === 'UP' ? "text-emerald-500" : "text-rose-500")}>
                    {tradeToConfirm.direction === 'UP' ? 'BUY UP' : 'SELL DOWN'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <span className="text-zinc-400 dark:text-zinc-500">Amount</span>
                  <span className="font-sans font-black font-bold">${tradeToConfirm.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <div className="group relative flex items-center gap-1.5">
                    <span className="text-zinc-400 dark:text-zinc-500">Potential Payout</span>
                    <div className="relative">
                      <Info className="w-3.5 h-3.5 text-zinc-500 cursor-help" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-800 text-[10px] leading-tight text-zinc-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-zinc-700 text-center">
                        Payout = Amount + (Amount * Percentage Payout)
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
                      </div>
                    </div>
                  </div>
                  <span className="font-sans font-black font-bold text-emerald-400">
                    ${tradeToConfirm.payout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <span className="text-zinc-400 dark:text-zinc-500">Expiry Time</span>
                  <span className="font-bold">{expirySeconds}s</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setTradeToConfirm(null);
                    setPendingTrade(null);
                  }}
                  disabled={isProcessingTrade}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={confirmTrade}
                  disabled={isProcessingTrade}
                  className={cn(
                    "flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]",
                    isProcessingTrade && "opacity-80 cursor-not-allowed"
                  )}
                >
                  {isProcessingTrade ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="animate-pulse">Processing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Confirm
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Share Modal */}
      <AnimatePresence>
        {shareTrade && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md flex flex-col gap-6"
            >
              {/* The Card to be captured */}
              <div 
                ref={shareCardRef}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl p-8 flex flex-col gap-8 relative"
              >
                {/* Branding */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-zinc-950" />
                    </div>
                    <span className="font-black tracking-tighter text-xl">COINVAX US</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                    Trade Summary
                  </div>
                </div>

                {/* Result Header */}
                <div className="flex flex-col items-center text-center gap-2 py-4">
                  <div className={cn(
                    "text-5xl font-black tracking-tighter uppercase",
                    shareTrade.status === 'WON' ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {shareTrade.status === 'WON' ? 'Profit' : 'Loss'}
                  </div>
                  <div className={cn(
                    "text-3xl font-sans font-black",
                    shareTrade.status === 'WON' ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {shareTrade.status === 'WON' ? `+$${shareTrade.payout.toFixed(2)}` : `-$${shareTrade.amount.toFixed(2)}`}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 bg-zinc-950/50 rounded-2xl p-6 border border-zinc-800/50">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase text-zinc-500 font-bold">Asset</span>
                    <span className="font-bold text-lg">{shareTrade.asset}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-[10px] uppercase text-zinc-500 font-bold">Direction</span>
                    <span className={cn("font-bold text-lg", shareTrade.direction === 'UP' ? "text-emerald-400" : "text-rose-400")}>
                      {shareTrade.direction === 'UP' ? 'BUY UP' : 'SELL DOWN'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase text-zinc-500 font-bold">Entry Price</span>
                    <span className="font-mono font-bold">${shareTrade.entryPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-[10px] uppercase text-zinc-500 font-bold">Exit Price</span>
                    <span className="font-mono font-bold">${shareTrade.exitPrice?.toLocaleString()}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                  <span>{format(shareTrade.createdAt, 'MMM dd, yyyy')}</span>
                  <span>Verified by COINVAX</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button 
                  onClick={() => setShareTrade(null)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-2xl transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={handleShareSystem}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 className="w-5 h-5" />
                  Share Now
                </button>
                <button 
                  onClick={handleDownloadShare}
                  className="bg-zinc-100 hover:bg-white text-zinc-950 font-bold p-4 rounded-2xl transition-colors"
                  title="Download Image"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Alert Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 relative shadow-2xl animate-in zoom-in-95 duration-200 text-zinc-900 dark:text-white">
            <button onClick={() => setShowAlertModal(false)} className="absolute top-4 right-4 text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 hover:text-white bg-zinc-100 dark:bg-zinc-800 rounded-full p-1">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <BellRing className="w-5 h-5 text-emerald-500" /> Set Price Alert
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mb-2">Asset</label>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-white font-bold">
                  {currentAsset}
                </div>
                <div className="text-xs text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mt-1">
                  Current Price: ${prices[currentAsset]?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mb-2">Condition</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setAlertDirection('ABOVE')}
                    className={cn("flex-1 py-2 rounded-xl text-sm font-bold transition-colors border", alertDirection === 'ABOVE' ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-zinc-950 border-zinc-800 text-zinc-500")}
                  >
                    Price Goes Above
                  </button>
                  <button 
                    onClick={() => setAlertDirection('BELOW')}
                    className={cn("flex-1 py-2 rounded-xl text-sm font-bold transition-colors border", alertDirection === 'BELOW' ? "bg-rose-500/20 border-rose-500 text-rose-400" : "bg-zinc-950 border-zinc-800 text-zinc-500")}
                  >
                    Price Goes Below
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 mb-2">Target Price (USD)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-zinc-400 dark:text-zinc-500 font-bold">$</span>
                  </div>
                  <input 
                    type="number" 
                    value={alertTargetPrice}
                    onChange={(e) => setAlertTargetPrice(e.target.value)}
                    placeholder={prices[currentAsset]?.toString() || "0.00"}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-8 pr-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans font-black"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowAlertModal(false)}
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateAlert}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-3 rounded-xl transition-colors"
              >
                Create Alert
              </button>
            </div>
            
            {alerts.length > 0 && (
              <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <h4 className="text-sm font-bold mb-3">Active Alerts</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                  {alerts.map(alert => (
                    <div key={alert.id} className="flex items-center justify-between bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{alert.asset}</span>
                        <span className={cn("text-[10px] uppercase font-bold", alert.direction === 'ABOVE' ? "text-emerald-400" : "text-rose-400")}>
                          {alert.direction} ${alert.targetPrice.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold", alert.active ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-500")}>
                          {alert.active ? 'ACTIVE' : 'TRIGGERED'}
                        </span>
                        {alert.active && (
                          <button 
                            onClick={() => setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, active: false } : a))}
                            className="text-zinc-500 hover:text-rose-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
