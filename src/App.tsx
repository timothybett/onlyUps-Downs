import React, { useState } from 'react';
import { useDerivData } from './hooks/useDerivData';
import { Activity, Zap, TrendingUp, TrendingDown, Info, Settings, ShieldAlert, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SYMBOLS = [
  { id: 'R_10', name: 'Volatility 10' },
  { id: 'R_25', name: 'Volatility 25' },
  { id: 'R_50', name: 'Volatility 50' },
  { id: 'R_75', name: 'Volatility 75' },
  { id: 'R_100', name: 'Volatility 100' },
];

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('R_100');
  const [appId, setAppId] = useState(((import.meta as any).env.VITE_DERIV_APP_ID as string) || '1089');
  const [token, setToken] = useState(((import.meta as any).env.VITE_DERIV_API_TOKEN as string) || '');
  const [showSettings, setShowSettings] = useState(false);

  const { currentPrice, ticks, indicators, fvgs, signal, connected, atr, weights } = useDerivData(selectedSymbol, appId, token);

  const chartData = ticks.map((t, i) => ({ index: i, price: t.quote }));

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E4E4E7] font-mono selection:bg-orange-500/30">
      {/* Top Navigation / Header */}
      <header className="border-b border-[#1F1F23] bg-[#0A0A0B]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center shadow-[0_0_15px_rgba(234,88,12,0.4)]">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tighter uppercase text-white">DERIV VOLATILITY ENGINE</h1>
              <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                <span>v2.0.4-STABLE</span>
                <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", connected ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500")}></span>
                <span className="uppercase">{connected ? 'Live Data Feed' : 'Disconnected'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <select 
               value={selectedSymbol}
               onChange={(e) => setSelectedSymbol(e.target.value)}
               className="bg-[#151518] border border-[#27272A] text-xs px-3 py-1.5 rounded outline-none focus:border-orange-500 transition-colors cursor-pointer"
             >
               {SYMBOLS.map(s => <option key={s.id} value={s.id}>{s.name} Index</option>)}
             </select>
             <button 
               onClick={() => setShowSettings(!showSettings)}
               className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400"
             >
               <Settings className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
        {/* Settings Modal (Overlay) */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#151518] border border-[#27272A] p-6 rounded-xl space-y-4 shadow-2xl relative z-40"
            >
               <h3 className="text-xs font-bold uppercase text-orange-500 tracking-widest">System Configuration</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 uppercase">Deriv App ID</label>
                    <input 
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      placeholder="1089"
                      className="w-full bg-[#0A0A0B] border border-[#27272A] px-3 py-2 text-xs rounded outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 uppercase">API Token (Optional)</label>
                    <input 
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Enter token for trading"
                      className="w-full bg-[#0A0A0B] border border-[#27272A] px-3 py-2 text-xs rounded outline-none focus:border-orange-500"
                    />
                  </div>
               </div>
               <p className="text-[10px] text-zinc-600 italic flex items-center gap-1">
                 <Info className="w-3 h-3" /> Default App ID 1089 can be used for demonstration.
               </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            label="Live Price" 
            value={currentPrice.toFixed(2)} 
            trend={ticks.length > 1 ? currentPrice > ticks[ticks.length-2].quote ? 'up' : 'down' : undefined}
            color="orange"
          />
          <StatCard 
            label="RSI (14)" 
            value={indicators?.rsi.toFixed(2) || '---'} 
            status={indicators?.rsi && (indicators.rsi > 70 ? 'Overbought' : indicators.rsi < 30 ? 'Oversold' : 'Neutral')}
            color="blue"
          />
          <StatCard 
            label="ATR (Volatility)" 
            value={atr.toFixed(4)} 
            status="Adaptive Metric"
            color="purple"
          />
          <StatCard 
            label="EMA Alignment" 
            value={indicators?.ema.ema8 > indicators?.ema.ema21 ? 'BULLISH' : 'BEARISH'} 
            status="Trend Context"
            color={indicators?.ema.ema8 > indicators?.ema.ema21 ? 'green' : 'red'}
          />
        </div>

        {/* Main Content Area: Charts and Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <div className="lg:col-span-2 space-y-6">
             <div className="bg-[#151518] border border-[#27272A] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#27272A] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Tick Stream Activity</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">REAL-TIME MILLISECOND FEED</span>
                </div>
                <div className="h-[300px] w-full p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EA580C" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#EA580C" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis hide dataKey="index" />
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#151518', border: '1px solid #27272A', fontSize: '10px' }}
                        itemStyle={{ color: '#EA580C' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#EA580C" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorPrice)" 
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
             </div>

             {/* Order Flow Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#151518] border border-[#27272A] p-4 rounded-xl">
                   <h4 className="text-[10px] font-bold uppercase text-zinc-500 mb-3 tracking-[0.2em]">Tick Micro-Flow</h4>
                   <div className="flex gap-1 h-12 items-end">
                      {ticks.slice(-20).map((t, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "flex-1 rounded-sm transition-all duration-300",
                            t.direction === 1 ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500 shadow-[0_0_8px_#ef4444]"
                          )}
                          style={{ height: `${Math.random() * 50 + 50}%` }}
                        />
                      ))}
                   </div>
                   <div className="mt-3 flex justify-between items-center text-[10px]">
                      <span className="text-zinc-600 uppercase">Recent Ticks History</span>
                      <span className="text-zinc-400">NINTENDO-LIKE PRECISION</span>
                   </div>
                </div>

                <div className="bg-[#151518] border border-[#27272A] p-4 rounded-xl">
                   <h4 className="text-[10px] font-bold uppercase text-zinc-500 mb-3 tracking-[0.2em]">Market Structure</h4>
                   <div className="space-y-2">
                      <div className="flex justify-between items-center bg-[#0A0A0B] p-2 rounded border border-[#1F1F23]">
                         <span className="text-[10px] text-zinc-400">15M FVGs</span>
                         <span className="text-[10px] font-bold text-white uppercase">{fvgs['15m']?.length || 0} Detected</span>
                      </div>
                      <div className="flex justify-between items-center bg-[#0A0A0B] p-2 rounded border border-[#1F1F23]">
                         <span className="text-[10px] text-zinc-400">MACD Histogram</span>
                         <span className={cn("text-[10px] font-bold uppercase", indicators?.macd.histogram > 0 ? "text-green-500" : "text-red-500")}>
                           {indicators?.macd.histogram.toFixed(4) || '---'}
                         </span>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* Signal / Decision Box */}
          <div className="space-y-6">
             <div className="bg-[#151518] border border-orange-500/50 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(234,88,12,0.1)]">
                <div className="bg-orange-600/10 p-4 border-b border-orange-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-orange-500" />
                    <span className="text-xs font-black uppercase tracking-[0.2em]">Prediction Engine</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(i => <div key={i} className="w-1 h-3 bg-orange-500/20" />)}
                  </div>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="text-center space-y-2">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Active Signal Generation</span>
                    <AnimatePresence mode="wait">
                      {signal ? (
                        <motion.div 
                          key={signal.direction}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={cn(
                            "text-5xl font-black py-4 rounded-lg tracking-tighter",
                            signal.direction === 'UP' ? "text-green-500" : signal.direction === 'DOWN' ? "text-red-500" : "text-zinc-600"
                          )}
                        >
                          {signal.direction}
                        </motion.div>
                      ) : (
                        <div className="text-5xl font-black py-4 text-zinc-700 animate-pulse">WAIT</div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-zinc-500">
                      <span>Signal Confidence</span>
                      <span>{signal?.score.toFixed(1) || '0.0'}/10.0</span>
                    </div>
                    <div className="w-full h-1 bg-[#27272A] rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${(signal?.score || 0) * 10}%` }}
                         className={cn("h-full transition-all duration-500", (signal?.score || 0) >= 6 ? "bg-orange-500" : "bg-zinc-600")}
                       />
                    </div>
                  </div>

                  {signal && signal.reasons.length > 0 && (
                    <div className="space-y-1">
                      {signal.reasons.map((r, i) => (
                        <div key={i} className="text-[9px] text-zinc-400 flex items-center gap-1">
                           <div className="w-1 h-1 bg-orange-500 rounded-full" />
                           {r}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <DecisionMetric label="TF FVG" active={Object.values(fvgs).some((l: any) => l.length > 0)} />
                    <DecisionMetric label="OFI > 3:1" active={Math.abs(ticks.reduce((a, b) => a + b.direction, 0)) >= 3} />
                    <DecisionMetric label="RSI DIVERGE" active={indicators ? (indicators.rsi > 70 || indicators.rsi < 30) : false} />
                    <DecisionMetric label="MACD ALIGN" active={indicators ? indicators.macd.histogram !== 0 : false} />
                  </div>

                  <div className="pt-4 border-t border-[#27272A]">
                    <button className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-[0.3em] rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_20px_rgba(234,88,12,0.2)]">
                      Manual Execution
                    </button>
                    <p className="text-[9px] text-zinc-500 text-center mt-3 uppercase tracking-tighter italic">
                      SYSTEM AUTHORIZED FOR MULTI-TICK CONSECUTIVE PREDICTION
                    </p>
                  </div>
                </div>
             </div>

             <div className="bg-[#151518] border border-[#27272A] p-4 rounded-xl">
               <div className="flex items-center gap-2 mb-4">
                 <ShieldAlert className="w-4 h-4 text-orange-500" />
                 <h4 className="text-[10px] font-bold uppercase tracking-widest">Adaptive Weights</h4>
               </div>
               <div className="space-y-3">
                 {weights && Object.entries(weights).map(([k, v]) => (
                   <div key={k} className="space-y-1">
                     <div className="flex justify-between text-[9px] uppercase font-bold text-zinc-500">
                       <span>{k} influence</span>
                       <span className="text-zinc-400">{(v as number).toFixed(2)}</span>
                     </div>
                     <div className="w-full h-1 bg-[#27272A] rounded-full overflow-hidden">
                       <div className="h-full bg-orange-500/40" style={{ width: `${((v as number) / 3) * 100}%` }} />
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="border-t border-[#1F1F23] mt-12 py-8 bg-[#0A0A0B]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-zinc-600 uppercase tracking-widest">
           <div className="flex gap-6">
             <span>Market: Deriv Volatility 100</span>
             <span>Protocol: WebSocket Binary V3</span>
           </div>
           <div>
             SYSTEM OPERATIONAL // {new Date().toLocaleTimeString()} UTC
           </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value, trend, status, color }: { label: string, value: string, trend?: 'up' | 'down', status?: string | false, color: string }) {
  const colorMap: Record<string, string> = {
    orange: 'text-orange-500 bg-orange-500/5 border-orange-500/20',
    blue: 'text-blue-500 bg-blue-500/5 border-blue-500/20',
    purple: 'text-purple-500 bg-purple-500/5 border-purple-500/20',
    green: 'text-green-500 bg-green-500/5 border-green-500/20',
    red: 'text-red-500 bg-red-500/5 border-red-500/20',
  };

  return (
    <div className={cn("bg-[#151518] border p-4 rounded-xl transition-all hover:bg-[#1A1A1D]", colorMap[color] || 'border-[#27272A]')}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider font-mono">{label}</span>
        {trend && (
           trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-white tabular-nums">{value}</span>
        {status && <span className="text-[10px] opacity-70 italic font-mono">{status}</span>}
      </div>
    </div>
  );
}

function DecisionMetric({ label, active }: { label: string, active: boolean }) {
  return (
    <div className={cn(
      "px-3 py-2 rounded border text-[10px] font-bold uppercase tracking-tighter flex items-center justify-between",
      active ? "border-orange-500/40 bg-orange-500/5 text-orange-400" : "border-[#27272A] bg-[#0A0A0B] text-zinc-600"
    )}>
      <span>{label}</span>
      <div className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-orange-500 shadow-[0_0_5px_#f97316]" : "bg-zinc-800")} />
    </div>
  );
}
