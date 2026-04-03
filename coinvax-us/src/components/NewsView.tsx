import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  time: string;
  category: 'Market' | 'Regulation' | 'Technology' | 'Adoption';
  url: string;
  imageUrl: string;
}

const MOCK_NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'Bitcoin Hits New All-Time High as Institutional Adoption Surges',
    summary: 'The leading cryptocurrency has surpassed previous records as major financial institutions continue to integrate digital assets into their portfolios.',
    source: 'CoinDesk',
    time: '2h ago',
    category: 'Market',
    url: 'https://www.coindesk.com',
    imageUrl: 'https://picsum.photos/seed/bitcoin/800/400'
  },
  {
    id: '2',
    title: 'Ethereum Network Upgrade Successfully Implemented',
    summary: 'The latest hard fork brings significant improvements to scalability and reduces transaction costs for users across the ecosystem.',
    source: 'Cointelegraph',
    time: '4h ago',
    category: 'Technology',
    url: 'https://cointelegraph.com',
    imageUrl: 'https://picsum.photos/seed/ethereum/800/400'
  },
  {
    id: '3',
    title: 'Global Regulators Propose Unified Framework for Digital Assets',
    summary: 'A new international working group aims to establish consistent guidelines for cryptocurrency exchanges and service providers worldwide.',
    source: 'Reuters',
    time: '6h ago',
    category: 'Regulation',
    url: 'https://www.reuters.com',
    imageUrl: 'https://picsum.photos/seed/regulation/800/400'
  },
  {
    id: '4',
    title: 'Major Retailer Announces Integration of Crypto Payments',
    summary: 'One of the world\'s largest e-commerce platforms will now allow customers to pay using a variety of popular digital currencies.',
    source: 'Bloomberg',
    time: '8h ago',
    category: 'Adoption',
    url: 'https://www.bloomberg.com',
    imageUrl: 'https://picsum.photos/seed/adoption/800/400'
  },
  {
    id: '5',
    title: 'DeFi Ecosystem Reaches $100 Billion Total Value Locked',
    summary: 'Decentralized finance continues its rapid growth as more users seek alternative financial services outside traditional banking.',
    source: 'The Block',
    time: '12h ago',
    category: 'Market',
    url: 'https://www.theblock.co',
    imageUrl: 'https://picsum.photos/seed/defi/800/400'
  }
];

export default function NewsView() {
  const [filter, setFilter] = useState<string>('All');
  const categories = ['All', 'Market', 'Regulation', 'Technology', 'Adoption'];

  const filteredNews = filter === 'All' 
    ? MOCK_NEWS 
    : MOCK_NEWS.filter(item => item.category === filter);

  return (
    <div className="p-4 lg:p-6 flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-emerald-500" />
            Crypto News Feed
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Stay updated with the latest global cryptocurrency trends and news.</p>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                filter === cat 
                  ? "bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20" 
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredNews.map((item, index) => (
          <div 
            key={item.id}
            className={cn(
              "group bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all duration-300 flex flex-col",
              index === 0 && filter === 'All' ? "lg:col-span-2 lg:flex-row" : ""
            )}
          >
            <div className={cn(
              "relative overflow-hidden",
              index === 0 && filter === 'All' ? "lg:w-1/2 aspect-video lg:aspect-auto" : "aspect-video"
            )}>
              <img 
                src={item.imageUrl} 
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1 bg-emerald-500 text-zinc-950 text-xs font-bold rounded-full uppercase tracking-wider">
                  {item.category}
                </span>
              </div>
            </div>

            <div className="p-6 flex flex-col flex-1">
              <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
                <span className="font-bold text-emerald-500/80 uppercase tracking-widest">{item.source}</span>
                <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.time}
                </div>
              </div>

              <h3 className={cn(
                "font-bold text-white group-hover:text-emerald-400 transition-colors mb-3",
                index === 0 && filter === 'All' ? "text-2xl lg:text-3xl" : "text-xl"
              )}>
                {item.title}
              </h3>

              <p className="text-zinc-400 text-sm leading-relaxed mb-6 line-clamp-3">
                {item.summary}
              </p>

              <div className="mt-auto flex items-center justify-between">
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-400 text-sm font-bold hover:text-emerald-300 transition-colors group/link"
                >
                  Read Full Article
                  <ExternalLink className="w-4 h-4 transition-transform group-hover/link:translate-x-1 group-hover/link:-translate-y-1" />
                </a>
                
                <button className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:bg-emerald-500 hover:text-zinc-950 transition-all">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-xl">
            <TrendingUp className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-white font-bold">Market Sentiment Analysis</h4>
            <p className="text-zinc-400 text-sm">Real-time analysis of global crypto news sentiment.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="text-center">
            <div className="text-2xl font-sans font-black text-emerald-500">72%</div>            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Bullish</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-sans font-black text-zinc-400">28%</div>            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Bearish</div>
          </div>
          <button className="px-6 py-2.5 bg-emerald-500 text-zinc-950 font-bold rounded-xl hover:bg-emerald-400 transition-colors">
            View Report
          </button>
        </div>
      </div>
    </div>
  );
}
