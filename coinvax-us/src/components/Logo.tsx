import React from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  iconClassName?: string;
  showText?: boolean;
  textClassName?: string;
  showSubtitle?: boolean;
  horizontal?: boolean;
}

export default function Logo({ className, showText = true, textClassName, showSubtitle = false, horizontal = false }: LogoProps) {
  return (
    <div className={cn(
      "flex items-center gap-4", 
      horizontal ? "flex-row" : "flex-col",
      className
    )}>
      {/* Logo Icon */}
      <div className={cn(
        "bg-[#10C080] rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,192,128,0.3)]",
        horizontal ? "w-10 h-10" : "w-16 h-16"
      )}>
        <TrendingUp className={cn("text-black", horizontal ? "w-6 h-6" : "w-10 h-10")} strokeWidth={3} />
      </div>

      {showText && (
        <div className={cn(
          "flex flex-col gap-1",
          horizontal ? "items-start" : "items-center"
        )}>
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-black tracking-tight text-white uppercase whitespace-nowrap", 
              horizontal ? "text-xl" : "text-4xl",
              textClassName
            )}>
              COINVAX <span className="text-[#10C080]">US</span>
            </span>
          </div>
          {showSubtitle && !horizontal && (
            <span className="text-zinc-400 text-lg font-medium tracking-wide">
              Institutional-Grade Crypto Trading
            </span>
          )}
        </div>
      )}
    </div>
  );
}
