import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  ChartCandlestick,
  CircleHelp,
  Clock3,
  Crosshair,
  Code2,
  ExternalLink,
  LayoutDashboard,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  X,
  Trash2,
} from 'lucide-react';

type Side = 'BUY' | 'SELL' | 'WAIT';
type TfRow = { rsi: number; fast: number; slow: number; prevFast: number; prevSlow: number };
type RoadmapState = { sellArmed: boolean; buyArmed: boolean; armedAt?: number; sellLocked?: boolean; buyLocked?: boolean; confirmed?: { side: 'BUY' | 'SELL'; at: string } };
type Pair = {
  symbol: string;
  name: string;
  category: string;
  price: string;
  change: string;
  positive: boolean;
  rsi: number;
  fast: number;
  slow: number;
  timeframe: string;
  updated: string;
  live?: boolean;
  tf?: Record<string, TfRow>;
  liveCross?: 'BUY' | 'SELL';
  liveCrossAt?: number;
};
type Candle = { t: number; h: number; l: number; c: number };
type PlanData = { atr: number; buyCross?: number; sellCross?: number };

const MAX_CRYPTO_PAIRS = 20;

const seedPairs: Pair[] = [
  { symbol: 'BINANCE:BTCUSDT', name: 'Bitcoin', category: 'Crypto', price: '67,482.10', change: '+1.82%', positive: true, rsi: 57.8, fast: 67440, slow: 67390, timeframe: '15m', updated: 'Just now' },
  { symbol: 'BINANCE:ETHUSDT', name: 'Ethereum', category: 'Crypto', price: '2,614.72', change: '+0.94%', positive: true, rsi: 53.2, fast: 2615, slow: 2617, timeframe: '15m', updated: 'Just now' },
  { symbol: 'BINANCE:SOLUSDT', name: 'Solana', category: 'Crypto', price: '148.26', change: '-0.62%', positive: false, rsi: 46.1, fast: 148.2, slow: 148.5, timeframe: '15m', updated: 'Just now' },
  { symbol: 'BINANCE:XRPUSDT', name: 'XRP', category: 'Crypto', price: '0.5842', change: '+2.17%', positive: true, rsi: 61.3, fast: 0.584, slow: 0.581, timeframe: '15m', updated: 'Just now' },
  { symbol: 'BINANCE:BNBUSDT', name: 'BNB', category: 'Crypto', price: '598.40', change: '+0.31%', positive: true, rsi: 50.8, fast: 598.2, slow: 598.1, timeframe: '15m', updated: 'Just now' },
  { symbol: 'BINANCE:DOGEUSDT', name: 'Dogecoin', category: 'Crypto', price: '0.1638', change: '-1.24%', positive: false, rsi: 39.4, fast: 0.163, slow: 0.165, timeframe: '15m', updated: 'Just now' },
  { symbol: 'OANDA:EURUSD', name: 'EUR/USD', category: 'Forex', price: '1.08462', change: '+0.14%', positive: true, rsi: 54.6, fast: 1.0847, slow: 1.0845, timeframe: '15m', updated: 'Just now' },
  { symbol: 'OANDA:GBPUSD', name: 'GBP/USD', category: 'Forex', price: '1.26714', change: '-0.22%', positive: false, rsi: 44.8, fast: 1.267, slow: 1.268, timeframe: '15m', updated: 'Just now' },
  { symbol: 'OANDA:USDJPY', name: 'USD/JPY', category: 'Forex', price: '149.825', change: '+0.08%', positive: true, rsi: 51.6, fast: 149.83, slow: 149.81, timeframe: '15m', updated: 'Just now' },
  { symbol: 'OANDA:XAUUSD', name: 'Gold', category: 'Metals', price: '2,658.40', change: '+0.56%', positive: true, rsi: 58.2, fast: 2658.5, slow: 2657.8, timeframe: '15m', updated: 'Just now' },
  { symbol: 'OANDA:NAS100USD', name: 'Nasdaq 100', category: 'Indices', price: '20,214.8', change: '+0.42%', positive: true, rsi: 49.2, fast: 20214, slow: 20216, timeframe: '15m', updated: 'Just now' },
  { symbol: 'OANDA:US30USD', name: 'Dow Jones', category: 'Indices', price: '42,183.2', change: '-0.17%', positive: false, rsi: 47.5, fast: 42180, slow: 42190, timeframe: '15m', updated: 'Just now' },
];
const tfs = ['1m', '5m', '15m', '30m', '1h', '4h', '1D'];
const tvInterval: Record<string, string> = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1D': 'D' };
const binanceInterval: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h', '4h': '4h', '1D': '1d' };

function getSignal(p: Pair, midline: number): Side {
  if (p.category !== 'Crypto' || !p.live) return 'WAIT';
  return p.fast > p.slow && p.rsi > midline ? 'BUY' : p.fast < p.slow && p.rsi < midline ? 'SELL' : 'WAIT';
}
function calculateEma(values: number[], period: number): number {
  if (!values.length) return 0;
  const alpha = 2 / (period + 1);
  return values.slice(1).reduce((ema, value) => value * alpha + ema * (1 - alpha), values[0]);
}
function calculateRsi(values: number[], period: number): number {
  if (values.length <= period) return 50;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change > 0) gain += change; else loss -= change;
  }
  let avgGain = gain / period, avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}
function calculateRsiSeries(values: number[], period: number): number[] {
  const start = Math.max(period + 1, values.length - 100);
  const series: number[] = [];
  for (let end = start; end <= values.length; end++) {
    series.push(calculateRsi(values.slice(0, end), period));
  }
  return series;
}
function analyze(closes: number[], rsiP: number, fastP: number, slowP: number): TfRow | null {
  if (closes.length < 51) return null;
  const prev = closes.slice(0, -1);
  return {
    rsi: calculateRsi(closes, rsiP),
    fast: calculateEma(closes, fastP),
    slow: calculateEma(closes, slowP),
    prevFast: calculateEma(prev, fastP),
    prevSlow: calculateEma(prev, slowP),
  };
}
function evalRoadmap(p: Pair, midline: number) {
  const rows = tfs.map(label => p.tf?.[label]);
  const ready = rows.every(row => row !== undefined);
  const d1 = p.tf?.['1D'];
  const m15 = p.tf?.['15m'];
  const green = ready && rows.every(row => !!row && row.fast > row.slow && row.rsi > midline);
  const red = ready && rows.every(row => !!row && row.fast < row.slow && row.rsi < midline);
  return {
    ready,
    d1Rsi: d1?.rsi,
    allGreen: green,
    allRed: red,
    sellArm: green && !!d1 && d1.rsi > 70,
    buyArm: red && !!d1 && d1.rsi < 30,
    sellConfirm: !!m15 && m15.prevFast >= m15.prevSlow && m15.fast < m15.slow && m15.rsi < midline,
    buyConfirm: !!m15 && m15.prevFast <= m15.prevSlow && m15.fast > m15.slow && m15.rsi > midline,
  };
}
function calculateAtr(candles: Candle[], period: number): number {
  if (candles.length <= period) return 0;
  const trueRange = (i: number) =>
    Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i - 1].c),
      Math.abs(candles[i].l - candles[i - 1].c)
    );
  let atr = 0;
  for (let i = 1; i <= period; i++) atr += trueRange(i);
  atr /= period;
  for (let i = period + 1; i < candles.length; i++) atr = (atr * (period - 1) + trueRange(i)) / period;
  return atr;
}
function emaSeries(values: number[], period: number): number[] {
  if (!values.length) return [];
  const alpha = 2 / (period + 1);
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) out.push(values[i] * alpha + out[i - 1] * (1 - alpha));
  return out;
}
function findCrossLevels(closes: number[], fastP: number, slowP: number): { buyCross?: number; sellCross?: number } {
  const fast = emaSeries(closes, fastP);
  const slow = emaSeries(closes, slowP);
  let buyCross: number | undefined;
  let sellCross: number | undefined;
  for (let i = closes.length - 1; i >= Math.max(1, slowP) && (buyCross === undefined || sellCross === undefined); i--) {
    if (buyCross === undefined && fast[i - 1] <= slow[i - 1] && fast[i] > slow[i]) buyCross = slow[i];
    if (sellCross === undefined && fast[i - 1] >= slow[i - 1] && fast[i] < slow[i]) sellCross = slow[i];
  }
  return { buyCross, sellCross };
}
function displayMarketPrice(value: number): string {
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : value >= 0.1 ? 5 : 7;
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: digits });
}

function App() {
  const [pairs, setPairs] = useState(seedPairs);
  const [selected, setSelected] = useState(seedPairs[0].symbol);
  const [timeframe, setTimeframe] = useState('15m');
  const [filter, setFilter] = useState('Crypto');
  const [query, setQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showWebsiteSettings, setShowWebsiteSettings] = useState(false);
  const [feedStatus, setFeedStatus] = useState<'connecting' | 'live' | 'reconnecting' | 'error'>('connecting');
  const [chartTheme, setChartTheme] = useState<'dark' | 'light'>('dark');
  const [chartTimezone, setChartTimezone] = useState('Etc/UTC');
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [fastLen, setFastLen] = useState(20);
  const [slowLen, setSlowLen] = useState(50);
  const [midline, setMidline] = useState(50);
  const [atrMult, setAtrMult] = useState(1.5);
  const [tp1, setTp1] = useState(1);
  const [tp2, setTp2] = useState(2);
  const [tp3, setTp3] = useState(3);
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [momentumSeries, setMomentumSeries] = useState<Record<string, number[]>>({});
  const [plans, setPlans] = useState<Record<string, PlanData>>({});
  const [showCryptoGridNote, setShowCryptoGridNote] = useState(false);
  const [showFeedStatusNote, setShowFeedStatusNote] = useState(false);
  const [liveTopGainers, setLiveTopGainers] = useState<any[]>([]);
  const [liveTopLosers, setLiveTopLosers] = useState<any[]>([]);
  const [scanSource, setScanSource] = useState<'manual' | 'gainers' | 'losers' | 'both'>('manual');

  const closesRef = useRef<Record<string, number[]>>({}); 
  const lastCloseRef = useRef<Record<string, number>>({}); 
  const candlesRef = useRef<Record<string, Candle[]>>({}); 
  const pendingRef = useRef<Set<string>>(new Set()); 
  const cfg = useRef({ rsiPeriod, fastLen, slowLen });
  cfg.current = { rsiPeriod, fastLen, slowLen };

  const active = pairs.find(p => p.symbol === selected) ?? pairs[0];
  const activeMomentum = momentumSeries[active.symbol.split(':')[1]] ?? [];
  const momentumPoints = activeMomentum.map((value, index) => {
    const x = activeMomentum.length > 1 ? (index / (activeMomentum.length - 1)) * 1000 : 1000;
    return x.toFixed(1) + ',' + (180 - value * 1.8).toFixed(1);
  }).join(' ');
  const activeRsi = activeMomentum.length ? activeMomentum[activeMomentum.length - 1] : active.rsi;
  const activeZone = activeRsi > midline ? 'BUY ZONE' : 'SELL ZONE';
  const metricPairs = pairs.filter(p => p.category === 'Crypto');
  const cryptoKey = metricPairs.map(p => p.symbol.split(':')[1]).join(',');

  const recompute = useCallback((symbol: string, crossAt?: number) => {
    const { rsiPeriod: rp, fastLen: fl, slowLen: sl } = cfg.current;
    const tf: Record<string, TfRow> = {};
    tfs.forEach(label => {
      const row = analyze(closesRef.current[symbol + '|' + label] ?? [], rp, fl, sl);
      if (row) tf[label] = row;
    });
    const r15 = tf['15m'];
    const closes15 = closesRef.current[symbol + '|15m'] ?? [];
    if (closes15.length >= 51) {
      setMomentumSeries(previous => ({ ...previous, [symbol]: calculateRsiSeries(closes15, rp) }));
    }
    const candles = candlesRef.current[symbol];
    if (candles && candles.length >= 60) {
      const crosses = findCrossLevels(candles.map(c => c.c), fl, sl);
      setPlans(previous => ({ ...previous, ['BINANCE:' + symbol]: { atr: calculateAtr(candles, 14), ...crosses } }));
    }
    const cross: 'BUY' | 'SELL' | undefined = crossAt !== undefined && r15
      ? r15.prevFast <= r15.prevSlow && r15.fast > r15.slow ? 'BUY' : r15.prevFast >= r15.prevSlow && r15.fast < r15.slow ? 'SELL' : undefined
      : undefined;
    setPairs(previous => previous.map(p => {
      if (p.symbol !== 'BINANCE:' + symbol) return p;
      return {
        ...p,
        tf,
        live: tfs.every(label => tf[label] !== undefined),
        ...(r15 ? { rsi: r15.rsi, fast: r15.fast, slow: r15.slow, timeframe: '15m', updated: 'Binance · candles' } : {}),
        ...(cross ? { liveCross: cross, liveCrossAt: crossAt } : {}),
      };
    }));
  }, []);

  // Top gainers & losers stream
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let disposed = false;
    let dirty = false;
    const tickerMap = new Map<string, any>();
    
    const publishTimer = window.setInterval(() => {
      if (!dirty) return;
      dirty = false;
      const liquid = Array.from(tickerMap.values()).filter(t => parseFloat(t.q) > 1000000);
      
      setLiveTopGainers(
        liquid.filter(t => parseFloat(t.P) > 0)
          .sort((a, b) => parseFloat(b.P) - parseFloat(a.P))
          .slice(0, 10)
      );
      
      setLiveTopLosers(
        liquid.filter(t => parseFloat(t.P) < 0)
          .sort((a, b) => parseFloat(a.P) - parseFloat(b.P))
          .slice(0, 10)
      );
    }, 1000);

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket('wss://data-stream.binance.vision/stream?streams=!ticker@arr');
      socket.onmessage = event => {
        try {
          const packet = JSON.parse(String(event.data));
          if (Array.isArray(packet.data)) {
            packet.data.forEach((ticker: any) => {
              if (ticker.s.endsWith('USDT')) tickerMap.set(ticker.s, ticker);
            });
            dirty = true;
          }
        } catch (error) {
          console.warn('Could not parse Top Gainers/Losers stream', error);
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        reconnectTimer = window.setTimeout(connect, 5000);
      };
    };
    connect();
    return () => {
      disposed = true;
      window.clearInterval(publishTimer);
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (socket) { socket.onclose = null; socket.close(); }
    };
  }, []);

  // Main scanner engine
  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    const symbols = cryptoKey.split(',').filter(Boolean);

    symbols.forEach(symbol => recompute(symbol));

    const fetchOne = async (symbol: string, label: string) => {
      const key = symbol + '|' + label;
      if (pendingRef.current.has(key)) return;
      pendingRef.current.add(key);
      try {
        const limit = label === '15m' ? 300 : 200;
        const response = await fetch('https://data-api.binance.vision/api/v3/klines?symbol=' + symbol + '&interval=' + binanceInterval[label] + '&limit=' + limit);
        if (!response.ok) throw new Error('Binance candles HTTP ' + response.status);
        const rows: unknown[][] = await response.json();
        const closed = rows.filter(row => Number(row[6]) < Date.now());
        closesRef.current[key] = closed.map(row => Number(row[4])).filter(Number.isFinite);
        lastCloseRef.current[key] = Number(closed[closed.length - 1]?.[6] ?? 0);
        if (label === '15m') {
          candlesRef.current[symbol] = closed
            .map(row => ({ t: Number(row[0]), h: Number(row[2]), l: Number(row[3]), c: Number(row[4]) }))
            .filter(c => Number.isFinite(c.h) && Number.isFinite(c.l) && Number.isFinite(c.c));
        }
        recompute(symbol);
      } catch (error) {
        console.warn('Binance ' + label + ' history unavailable for ' + symbol, error);
      } finally {
        pendingRef.current.delete(key);
      }
    };
    
    const loadMissing = async () => {
      const jobs = symbols.flatMap(symbol => tfs.map(label => ({ symbol, label })))
        .filter(({ symbol, label }) => closesRef.current[symbol + '|' + label] === undefined);
      for (let i = 0; i < jobs.length; i += 10) {
        if (disposed) return;
        await Promise.all(jobs.slice(i, i + 10).map(job => fetchOne(job.symbol, job.label)));
      }
    };

    const connect = () => {
      if (disposed || !symbols.length) return;
      setFeedStatus('connecting');
      const streams = symbols.flatMap(symbol => {
        const lower = symbol.toLowerCase();
        return [lower + '@ticker', ...tfs.map(label => lower + '@kline_' + binanceInterval[label])];
      }).join('/');
      try {
        socket = new WebSocket('wss://data-stream.binance.vision/stream?streams=' + streams);
      } catch (error) {
        setFeedStatus('error');
        reconnectTimer = window.setTimeout(connect, 5000);
        return;
      }
      socket.onopen = () => { if (!disposed) setFeedStatus('live'); };
      socket.onmessage = event => {
        try {
          const packet = JSON.parse(String(event.data));
          const data = packet.data ?? packet;
          if (data.e === '24hrTicker' && data.s) {
            const price = Number(data.c);
            const percent = Number(data.P);
            setPairs(previous => previous.map(p => p.symbol === 'BINANCE:' + data.s
              ? { ...p, price: displayMarketPrice(price), change: (percent >= 0 ? '+' : '') + percent.toFixed(2) + '%', positive: percent >= 0 }
              : p));
            return;
          }
          if (data.e === 'kline' && data.k && data.k.x) {
            const label = tfs.find(l => binanceInterval[l] === data.k.i);
            if (!label) return;
            const key = data.s + '|' + label;
            const closes = closesRef.current[key];
            if (!closes || lastCloseRef.current[key] === data.k.T) return;
            lastCloseRef.current[key] = data.k.T;
            closes.push(Number(data.k.c));
            if (closes.length > 300) closes.splice(0, closes.length - 300);
            if (label === '15m') {
              const list = candlesRef.current[data.s];
              if (list && (!list.length || list[list.length - 1].t < Number(data.k.t))) {
                list.push({ t: Number(data.k.t), h: Number(data.k.h), l: Number(data.k.l), c: Number(data.k.c) });
                if (list.length > 400) list.splice(0, list.length - 400);
              }
            }
            recompute(data.s, label === '15m' ? Number(data.k.T) : undefined);
          }
        } catch (error) {
          console.warn('Could not parse Binance market-data update', error);
        }
      };
      socket.onerror = () => { if (!disposed) setFeedStatus('reconnecting'); };
      socket.onclose = () => {
        if (disposed) return;
        setFeedStatus('reconnecting');
        reconnectTimer = window.setTimeout(connect, 5000);
      };
    };

    void loadMissing();
    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (socket) { socket.onclose = null; socket.close(); }
    };
  }, [cryptoKey, refreshKey, recompute]);

  useEffect(() => {
    cryptoKey.split(',').filter(Boolean).forEach(symbol => recompute(symbol));
  }, [rsiPeriod, fastLen, slowLen, cryptoKey, recompute]);

  const [roadmap, setRoadmap] = useState<Record<string, RoadmapState>>(() => {
    try {
      const raw = localStorage.getItem('bpqt-roadmap-v1');
      if (!raw) return {};
      const saved = JSON.parse(raw);
      return saved && Date.now() - Number(saved.savedAt) < 86400000 && saved.data ? saved.data : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    setRoadmap(previous => {
      const next = { ...previous };
      let changed = false;
      pairs.filter(p => p.category === 'Crypto').forEach(p => {
        const e = evalRoadmap(p, midline);
        if (!e.ready) return;
        const before: RoadmapState = next[p.symbol] ?? { sellArmed: false, buyArmed: false };
        const s: RoadmapState = { ...before };
        const stamp = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        if (e.sellArm && !s.sellArmed && !s.sellLocked) {
          s.sellArmed = true;
          s.buyArmed = false;
          s.armedAt = Date.now();
          s.confirmed = undefined;
        }
        if (e.d1Rsi !== undefined && e.d1Rsi <= 70) s.sellLocked = false;
        if (e.buyArm && !s.buyArmed && !s.buyLocked) {
          s.buyArmed = true;
          s.sellArmed = false;
          s.armedAt = Date.now();
          s.confirmed = undefined;
        }
        if (e.d1Rsi !== undefined && e.d1Rsi >= 30) s.buyLocked = false;
        const freshCross = p.liveCrossAt !== undefined && s.armedAt !== undefined && p.liveCrossAt > s.armedAt;
        if (s.sellArmed && e.sellConfirm && p.liveCross === 'SELL' && freshCross) {
          s.sellArmed = false;
          s.armedAt = undefined;
          s.confirmed = { side: 'SELL', at: stamp };
          s.sellLocked = true;
        }
        if (s.buyArmed && e.buyConfirm && p.liveCross === 'BUY' && freshCross) {
          s.buyArmed = false;
          s.armedAt = undefined;
          s.confirmed = { side: 'BUY', at: stamp };
          s.buyLocked = true;
        }
        if (s.sellArmed !== before.sellArmed || s.buyArmed !== before.buyArmed || s.armedAt !== before.armedAt || s.sellLocked !== before.sellLocked || s.buyLocked !== before.buyLocked || s.confirmed?.side !== before.confirmed?.side || s.confirmed?.at !== before.confirmed?.at) {
          next[p.symbol] = s;
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }, [pairs, midline]);
  useEffect(() => {
    try {
      localStorage.setItem('bpqt-roadmap-v1', JSON.stringify({ savedAt: Date.now(), data: roadmap }));
    } catch {}
  }, [roadmap]);

  const shortName = (p: Pair) => p.symbol.split(':')[1].replace('USDT', '');
  const getPairSignal = (p: Pair): Side => p.category === 'Crypto' ? roadmap[p.symbol]?.confirmed?.side ?? 'WAIT' : 'WAIT';
  const rmRows = metricPairs.map(p => ({ p, e: evalRoadmap(p, midline), s: roadmap[p.symbol] }));
  const rmReady = rmRows.filter(r => r.e.ready).length;
  const rmNames = (rows: typeof rmRows) => rows.map(r => shortName(r.p)).join(', ');
  const sellArmedRows = rmRows.filter(r => r.s?.sellArmed);
  const buyArmedRows = rmRows.filter(r => r.s?.buyArmed);
  const sellDoneRows = rmRows.filter(r => r.s?.confirmed?.side === 'SELL');
  const buyDoneRows = rmRows.filter(r => r.s?.confirmed?.side === 'BUY');
  const sellStep1 = rmReady === 0 ? ['wait', 'LOADING FEED'] : sellArmedRows.length ? ['ok', 'ARMED · ' + rmNames(sellArmedRows)] : ['wait', 'NOT ARMED'];
  const buyStep1 = rmReady === 0 ? ['wait', 'LOADING FEED'] : buyArmedRows.length ? ['ok', 'ARMED · ' + rmNames(buyArmedRows)] : ['wait', 'NOT ARMED'];
  const sellStep2 = sellDoneRows.length ? ['ok', 'CONFIRMED · ' + rmNames(sellDoneRows)] : sellArmedRows.length ? ['wait', 'WAITING FOR 15m CROSS'] : ['wait', 'WAITING FOR SETUP'];
  const buyStep2 = buyDoneRows.length ? ['ok', 'CONFIRMED · ' + rmNames(buyDoneRows)] : buyArmedRows.length ? ['wait', 'WAITING FOR 15m CROSS'] : ['wait', 'WAITING FOR SETUP'];

  const visiblePairs = useMemo(
    () => pairs.filter(p => (filter === 'All markets' || p.category === filter) && (p.name.toLowerCase().includes(query.toLowerCase()) || p.symbol.toLowerCase().includes(query.toLowerCase()))),
    [pairs, filter, query]
  );
  const signalCounts = useMemo(
    () => metricPairs.reduce((a, p) => { a[getSignal(p, midline)]++; return a; }, { BUY: 0, SELL: 0, WAIT: 0 }),
    [pairs, midline]
  );

  useEffect(() => {
    const old = document.getElementById('tv-widget-script');
    if (old) old.remove();
    const container = document.getElementById('tv-chart');
    if (!container) return;
    container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'tradingview-widget-container';
    root.style.height = '100%';
    root.style.width = '100%';
    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = 'calc(100% - 32px)';
    widget.style.width = '100%';
    root.appendChild(widget);
    const credit = document.createElement('div');
    credit.className = 'tv-credit';
    credit.innerHTML = '<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">Chart by TradingView</a>';
    root.appendChild(credit);
    const script = document.createElement('script');
    script.id = 'tv-widget-script';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: selected,
      interval: tvInterval[timeframe],
      timezone: chartTimezone,
      theme: chartTheme,
      style: '1',
      locale: 'en',
      allow_symbol_change: true,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      withdateranges: true,
      details: false,
      hotlist: false,
      hide_side_toolbar: false,
      studies: [],
      save_image: false,
      backgroundColor: '#0a1322',
      gridColor: 'rgba(148,163,184,0.07)',
      watchlist: [],
      compareSymbols: [],
    });
    root.appendChild(script);
    container.appendChild(root);
    return () => {
      container.innerHTML = '';
    };
  }, [selected, timeframe, chartTheme, chartTimezone]);

  const selectPair = (symbol: string) => {
    setSelected(symbol);
    setNotice('Chart changed to ' + symbol.replace(':', ' · '));
  };

  const addToScanner = (symbol: string) => {
    const fullSymbol = 'BINANCE:' + symbol;
    if (pairs.find(p => p.symbol === fullSymbol)) {
      setNotice(symbol + ' is already in your scanner.');
      return;
    }
    if (metricPairs.length >= MAX_CRYPTO_PAIRS) {
      setNotice('Scanner is limited to ' + MAX_CRYPTO_PAIRS + ' crypto pairs.');
      return;
    }
    const newPair: Pair = {
      symbol: fullSymbol,
      name: symbol.replace('USDT', ''),
      category: 'Crypto',
      price: '0.00',
      change: '0.00%',
      positive: true,
      rsi: 50,
      fast: 1,
      slow: 1,
      timeframe: '15m',
      updated: 'Loading...',
      live: false,
    };
    setPairs(prev => [...prev, newPair]);
    setNotice(symbol + ' added to scanner. Loading data...');
  };

  const removeFromScanner = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pairs.length === 1) {
      setNotice('Cannot remove the last pair.');
      return;
    }
    setPairs(prev => prev.filter(p => p.symbol !== symbol));
    if (selected === symbol) {
      setSelected(pairs.filter(p => p.symbol !== symbol)[0].symbol);
    }
  };

  const makePair = (s: string): Pair => ({
    symbol: 'BINANCE:' + s, name: s.replace('USDT', ''), category: 'Crypto',
    price: '0.00', change: '0.00%', positive: true, rsi: 50, fast: 1, slow: 1,
    timeframe: '15m', updated: 'Loading...', live: false,
  });

  const applyWatchlist = (source: 'gainers' | 'losers' | 'both') => {
    const g = liveTopGainers.map(t => t.s as string);
    const l = liveTopLosers.map(t => t.s as string);
    const symbols = source === 'gainers' ? g : source === 'losers' ? l : [...g, ...l];
    
    if (!symbols.length) {
      setNotice('Live gainers/losers have not loaded yet. Try again in a few seconds.');
      return;
    }
    
    const unique = Array.from(new Set(symbols)).slice(0, MAX_CRYPTO_PAIRS);
    setScanSource(source);
    
    setPairs(prev => {
      const existing = new Map(prev.map(p => [p.symbol, p]));
      const crypto = unique.map(s => existing.get('BINANCE:' + s) ?? makePair(s));
      return [...crypto, ...prev.filter(p => p.category !== 'Crypto')];
    });
    
    setSelected('BINANCE:' + unique[0]);
    setNotice('Scanner now watching ' + unique.length + ' ' + source + '. Loading candles...');
  };

  const renderMovers = (rows: any[], kind: 'gainers' | 'losers') => (
    <section className="panel" style={{ marginBottom: '24px' }}>
      <div className="section-header signal-header">
        <div>
          <div className="section-title">Live Top {kind === 'gainers' ? 'Gainers' : 'Losers'} (USDT)</div>
          <p>Real-time updates from Binance · 24h change · Filtered by &gt; $1M Volume</p>
        </div>
        <button className="primary-btn" onClick={() => applyWatchlist(kind)}>
          <ChartCandlestick size={15} /> Scan these {rows.length || 10}
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>#</th><th>SYMBOL</th><th>PRICE</th><th>24H CHANGE</th><th>24H VOLUME</th><th>ACTION</th></tr>
          </thead>
          <tbody>
            {rows.map((t, index) => {
              const pct = parseFloat(t.P);
              return (
                <tr key={t.s}>
                  <td>{index + 1}</td>
                  <td>
                    <div className="instrument-cell">
                      <span className="coin-icon">{t.s.replace('USDT', '').slice(0, 1)}</span>
                      <span><strong>{t.s.replace('USDT', '')}</strong><small>/USDT</small></span>
                    </div>
                  </td>
                  <td className="price-cell">{parseFloat(t.c).toLocaleString('en-US', { maximumFractionDigits: 6 })}</td>
                  <td><span className={pct >= 0 ? 'positive' : 'negative'}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span></td>
                  <td>${(parseFloat(t.q) / 1000000).toFixed(2)}M</td>
                  <td style={{ display: 'flex', gap: '8px' }}>
                    <button className="chart-link" title="Load in chart" onClick={() => { setSelected('BINANCE:' + t.s); setNotice('Loaded ' + t.s + ' into chart'); }}>
                      <Crosshair size={15} />
                    </button>
                    <button className="chart-link" style={{ color: '#78e0aa' }} title="Add to Signal Scanner" onClick={() => addToScanner(t.s)}>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', lineHeight: '15px' }}>+</span>
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Connecting to Binance live stream...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const getTradeSide = (p: Pair): Side => {
    const confirmed = getPairSignal(p);
    return confirmed !== 'WAIT' ? confirmed : getSignal(p, midline);
  };
  const getLevels = (p: Pair) => {
    const price = Number(p.price.replace(/,/g, ''));
    const plan = plans[p.symbol];
    const side = getTradeSide(p);
    const atr = plan?.atr ?? 0;
    const cross = side === 'BUY' ? plan?.buyCross : side === 'SELL' ? plan?.sellCross : undefined;
    let risk = atr * atrMult;
    let basis = 'atr';
    if (cross !== undefined && atr > 0) {
      const crossRisk = side === 'BUY' ? price - (cross - atr * atrMult) : cross + atr * atrMult - price;
      if (crossRisk > 0) {
        risk = crossRisk;
        basis = 'cross';
      }
    }
    risk = Math.max(risk, 0.0000001);
    const entry = price;
    const stop = side === 'BUY' ? entry - risk : entry + risk;
    const target = (r: number) => side === 'BUY' ? entry + risk * r : entry - risk * r;
    return {
      entry,
      stop,
      tp1: target(tp1),
      tp2: target(tp2),
      tp3: target(tp3),
      basis,
      atr,
      hasSignal: side !== 'WAIT',
      source: getPairSignal(p) !== 'WAIT' ? 'roadmap' : 'grid',
    };
  };
  const formatPrice = (n: number) => displayMarketPrice(n);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={22} />
          </div>
          <div>
            <strong>BitPulse</strong>
            <span>QUANTITATIVE TRADES</span>
          </div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          <button className="nav-item active">
            <LayoutDashboard size={18} /> Overview
          </button>
          <button
            className="nav-item"
            onClick={() => document.getElementById('signal-grid')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <ChartCandlestick size={18} /> Signal scanner{' '}
            <span className="nav-count">{pairs.length}</span>
          </button>
          <button className="nav-item" onClick={() => setShowSettings(true)}>
            <SlidersHorizontal size={18} /> Strategy settings
          </button>
        </nav>
        <div className="side-divider" />
        <div className="workspace-label">MARKET WATCH</div>
        <div className="watch-group">
          CRYPTO <span>{metricPairs.length.toString().padStart(2, '0')}</span>
        </div>
        {metricPairs.slice(0, 10).map(p => (
          <div key={p.symbol} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <button
              className={'watch-row ' + (selected === p.symbol ? 'chosen' : '')}
              onClick={() => selectPair(p.symbol)}
              style={{ flexGrow: 1 }}
            >
              <span className="coin-icon">
                {p.name === 'Bitcoin' ? '₿' : p.name === 'Ethereum' ? '◆' : p.name.slice(0, 1)}
              </span>
              <span className="watch-name">
                {p.name}
                <small>{p.symbol.split(':')[1]}</small>
              </span>
              <span className={p.positive ? 'positive' : 'negative'}>{p.change}</span>
            </button>
            <button 
              onClick={(e) => removeFromScanner(p.symbol, e)} 
              style={{ background: 'none', border: 'none', color: '#ff7887', cursor: 'pointer', padding: '8px', opacity: 0.6 }}
              title="Remove from scanner"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div className="side-divider" />
        <div className="sidebar-bottom">
          <div className={'status-dot ' + (feedStatus === 'live' ? 'feed-live-dot' : '')} /> <span>{feedStatus === 'live' ? 'Binance feed connected' : feedStatus === 'reconnecting' ? 'Reconnecting Binance' : feedStatus === 'error' ? 'Binance feed unavailable' : 'Connecting Binance feed'}</span>
          <span className="live-tag">{feedStatus === 'live' ? 'LIVE' : '...'}</span>
        </div>
        <div className="sidebar-foot">
          BPQT TERMINAL <span>v1.0.0</span>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>Market overview</strong>
          </div>
          <div className="top-actions">
            <span className="market-open">
              <i /> Market session
            </span>
            <button className="icon-btn website-settings-btn" aria-label="Website settings" title="Website settings" onClick={() => setShowWebsiteSettings(true)}><Settings2 size={18} /></button>
            <button className="icon-btn" aria-label="Notifications" onClick={() => setNotice('No new notifications.')}>
              <Bell size={18} />
            </button>
            <button className="profile" onClick={() => setNotice('BPQT terminal · Local demo workspace')}>
              BP<span>QT</span>
            </button>
          </div>
        </header>
        <section className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="pulse-dot" /> INTELLIGENCE TERMINAL{' '}
              <span className="version">BETA</span>
            </div>
            <h1>Market overview</h1>
            <p>Track momentum. Read the structure. Trade with a plan.</p>
          </div>
          <div className="heading-buttons">
            <button className="secondary-btn" onClick={() => setShowSettings(true)}>
              <Settings2 size={16} /> Configure strategy
            </button>
            <button className="primary-btn" onClick={() => { setNotice('Reloading candles...'); setRefreshKey(k => k + 1); }}>
              <Activity size={16} /> Refresh scanner
            </button>
          </div>
        </section>
        {!showFeedStatusNote && <button className="help-toggle standalone-help" aria-label="Show Binance feed notes" title="Binance feed notes" aria-expanded={false} onClick={() => setShowFeedStatusNote(true)}>?</button>}
        <div className={'demo-warning' + (showFeedStatusNote ? '' : ' info-hidden')}>
          <CircleHelp size={16} />
          <div className="demo-warning-content">
            <strong>{feedStatus === 'live' ? 'Binance spot feed connected · crypto signals use live candles' : 'Connecting to Binance public market data…'}</strong>
            {showFeedStatusNote && <span>Crypto pairs update from Binance public price streams. RSI({rsiPeriod}), EMA {fastLen} and EMA {slowLen} are calculated from completed 15-minute candles. Forex, gold and indices are static sample rows with no live feed and are excluded from BUY/SELL/WAIT totals.</span>}
          </div>
          <button className="help-toggle" aria-label="Toggle Binance feed details" aria-expanded={showFeedStatusNote} onClick={() => setShowFeedStatusNote(value => !value)}>?</button>
        </div>
        <section className="metric-grid">
          <div className="metric-card">
            <div className="metric-top">
              <span>Markets scanned</span>
              <div className="metric-icon blue">
                <ChartCandlestick size={18} />
              </div>
            </div>
            <div className="metric-value">
              {metricPairs.length}
              <span className="metric-unit"> crypto</span>
            </div>
            <div className="metric-note">
              <span className={feedStatus === 'live' ? 'note-neutral' : 'red-text'}>{feedStatus === 'live' ? 'Binance feed' : 'Feed ' + feedStatus}</span> · 15m candles
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-top">
              <span>Buy setups</span>
              <div className="metric-icon green">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="metric-value green-text">{signalCounts.BUY.toString().padStart(2, '0')}</div>
            <div className="metric-note">
              <span className="signal-dot buy-dot" /> S1 above S2 · RSI above {midline}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-top">
              <span>Sell setups</span>
              <div className="metric-icon red">
                <TrendingDown size={18} />
              </div>
            </div>
            <div className="metric-value red-text">{signalCounts.SELL.toString().padStart(2, '0')}</div>
            <div className="metric-note">
              <span className="signal-dot sell-dot" /> S1 below S2 · RSI below {midline}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-top">
              <span>Waiting for confirmation</span>
              <div className="metric-icon amber">
                <Clock3 size={18} />
              </div>
            </div>
            <div className="metric-value">{signalCounts.WAIT.toString().padStart(2, '0')}</div>
            <div className="metric-note">
              <span className="note-neutral">Mixed conditions</span> · no signal
            </div>
          </div>
        </section>
        
        {renderMovers(liveTopGainers, 'gainers')}
        {renderMovers(liveTopLosers, 'losers')}

        <section className="signal-layout" id="signal-grid">
          <div className="panel signal-panel">
            <div className="section-header signal-header">
              <div>
                <div className="section-title">Multi-market signal grid</div>
                <p>Live Binance spot prices · RSI and EMA from closed 15m candles · feed: {feedStatus}</p>
              </div>
              <button className="small-icon-btn" onClick={() => setShowSettings(true)} aria-label="Signal settings">
                <SlidersHorizontal size={16} />
              </button>
            </div>
            
            <div className="filters" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '12px', opacity: 0.7 }}>SCANNER WATCHLIST</span>
              <div className="tf-switch">
                <button className={scanSource === 'gainers' ? 'selected' : ''} onClick={() => applyWatchlist('gainers')}>Top Gainers</button>
                <button className={scanSource === 'losers' ? 'selected' : ''} onClick={() => applyWatchlist('losers')}>Top Losers</button>
                <button className={scanSource === 'both' ? 'selected' : ''} onClick={() => applyWatchlist('both')}>Both</button>
              </div>
              {scanSource === 'manual' && <small>Using default pairs</small>}
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>INSTRUMENT</th>
                    <th>PRICE*</th>
                    <th>RSI ({rsiPeriod})</th>
                    <th>S1 / S2</th>
                    <th>SIGNAL</th>
                    <th>MTF MA / RSI</th>
                    <th>ROADMAP</th>
                    <th>CHART</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePairs.map(p => {
                    const s = getPairSignal(p);
                    const isCrypto = p.category === 'Crypto';
                    return (
                      <tr key={p.symbol} className={selected === p.symbol ? 'selected-row' : ''}>
                        <td>
                          <button className="instrument-cell" onClick={() => selectPair(p.symbol)}>
                            <span className="coin-icon">
                              {p.name === 'Bitcoin' ? '₿' : p.name === 'Ethereum' ? '◆' : p.name.slice(0, 1)}
                            </span>
                            <span>
                              <strong>{p.name}</strong>
                              <small>{p.symbol.split(':')[1]}</small>
                            </span>
                          </button>
                        </td>
                        <td className="price-cell">
                          {p.price}
                          {isCrypto
                            ? <small className={p.positive ? 'positive' : 'negative'}>{p.change}</small>
                            : <small>sample · not live</small>}
                        </td>
                        <td>
                          <span className={'rsi-pill ' + (p.rsi > 70 ? 'overbought' : p.rsi < 30 ? 'oversold' : '')}>
                            {isCrypto && !p.tf?.['15m'] ? '…' : p.rsi.toFixed(1)}
                          </span>
                        </td>
                        <td>
                          <span className={'ma-state ' + (!isCrypto || !p.tf?.['15m'] ? '' : p.fast > p.slow ? 'bull-state' : p.fast < p.slow ? 'bear-state' : '')}>
                            {!isCrypto ? 'NO FEED' : !p.tf?.['15m'] ? '…' : p.fast > p.slow ? 'S1 > S2' : p.fast < p.slow ? 'S1 < S2' : 'Equal'}
                          </span>
                        </td>
                        <td>
                          <span className={'signal-badge ' + (!isCrypto || !p.live ? 'wait' : getSignal(p, midline).toLowerCase())} title="S1 EMA vs S2 EMA with RSI above or below the midline, from completed 15m Binance candles">
                            <i />
                            {!isCrypto ? 'NO FEED' : p.live ? getSignal(p, midline) : 'LOADING'}
                          </span>
                        </td>
                        <td>
                          <div className="mtf-strip" title="Each timeframe badge combines EMA20/EMA50 direction and RSI relative to 50">
                            {tfs.map(label => {
                              const r = p.tf?.[label];
                              const side = !r ? 'WAIT' : r.fast > r.slow && r.rsi > midline ? 'BUY' : r.fast < r.slow && r.rsi < midline ? 'SELL' : 'MIX';
                              return <span key={label} className={'mtf-pill ' + side.toLowerCase()}>{label} {side === 'WAIT' ? '…' : side}</span>;
                            })}
                            <small>D1 RSI {p.tf?.['1D'] ? p.tf['1D'].rsi.toFixed(1) : '…'}</small>
                          </div>
                        </td>
                        <td>
                          <span className={'signal-badge ' + (!isCrypto ? 'wait' : s.toLowerCase())} title={!isCrypto ? 'No Binance feed for this market' : p.live ? (roadmap[p.symbol]?.confirmed ? 'Confirmed by the strict BPQT roadmap' : 'Waiting for all roadmap conditions') : 'Waiting for all seven Binance timeframes'}>
                            <i />
                            {!isCrypto ? 'NO FEED' : p.live ? s : 'LOADING'}
                          </span>
                          <small className="roadmap-row-status">{roadmap[p.symbol]?.confirmed ? roadmap[p.symbol]?.confirmed?.side + ' confirmed · ' + roadmap[p.symbol]?.confirmed?.at : roadmap[p.symbol]?.sellArmed ? 'SELL armed · waiting for fresh 15m cross' : roadmap[p.symbol]?.buyArmed ? 'BUY armed · waiting for fresh 15m cross' : p.live ? 'No complete setup' : isCrypto ? 'Loading 7 timeframes' : ''}</small>
                        </td>
                        <td>
                          <button className="chart-link" onClick={() => selectPair(p.symbol)}>
                            <Crosshair size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visiblePairs.length === 0 && (
                <div className="empty-state">No instruments match your search.</div>
              )}
            </div>
            <div className="table-footer">
              <span>Showing {visiblePairs.length} of {pairs.length} instruments</span>
              <span>Binance live: {metricPairs.length} crypto</span>
            </div>
          </div>
          <div className="right-stack">
            <div className="panel detail-panel">
              <div className="section-header">
                <div className="section-title">Signal details</div>
                <span className="mini-tag">{timeframe}</span>
              </div>
              <div className="detail-symbol">
                <div className="coin-icon large">
                  {active.name === 'Bitcoin' ? '₿' : active.name.slice(0, 1)}
                </div>
                <div>
                  <strong>{active.name}</strong>
                  <span>{active.symbol}</span>
                </div>
              </div>
              <div className="detail-price">
                {active.price}
                <span className={active.positive ? 'positive' : 'negative'}>{active.change}</span>
              </div>
              <div className={'detail-signal ' + getSignal(active, midline).toLowerCase()}>
                <span className="signal-dot" />
                {getSignal(active, midline)} SIGNAL{' '}
                <small>
                  {getSignal(active, midline) === 'WAIT' ? 'Conditions not aligned' : 'MA + RSI conditions aligned'}
                </small>
              </div>
              <div className="condition-list">
                <div>
                  <span>S1 / S2 alignment</span>
                  <strong className={active.fast > active.slow ? 'positive' : active.fast < active.slow ? 'negative' : ''}>
                    {active.fast > active.slow ? 'Bullish' : active.fast < active.slow ? 'Bearish' : 'Neutral'}
                  </strong>
                </div>
                <div>
                  <span>RSI ({rsiPeriod})</span>
                  <strong>
                    {active.rsi.toFixed(1)}{' '}
                    <small>{active.rsi > midline ? 'above' : active.rsi < midline ? 'below' : 'at'} {midline}</small>
                  </strong>
                </div>
                <div>
                  <span>Signal timeframe</span>
                  <strong>15m</strong>
                </div>
                <div>
                  <span>Signal status</span>
                  <strong>{getSignal(active, midline) === 'WAIT' ? 'Waiting' : 'Conditions met'}</strong>
                </div>
              </div>
              <div className="levels-title">
                Trade plan · 15m <span>ATR(14) × {atrMult}</span>
              </div>
              {(() => {
                const lv = getLevels(active);
                if (!lv.hasSignal) return <p className="risk-note">No active BUY or SELL signal for {active.name}. Levels appear when the S1/S2 signal or a roadmap entry is active.</p>;
                if (!lv.atr) return <p className="risk-note">Loading ATR from Binance…</p>;
                return (
                  <>
                    <p className="risk-note">
                      {lv.source === 'roadmap' ? 'Source: BPQT roadmap entry (both steps confirmed).' : 'Source: basic S1/S2 + RSI signal. Not confirmed by the roadmap.'}
                    </p>
                    <div className="levels-grid">
                      <div>
                        <span>STOP BASIS</span>
                        <strong>{lv.basis === 'cross' ? 'Cross ± ATR' : 'ATR only'}</strong>
                      </div>
                      <div>
                        <span>ENTRY</span>
                        <strong>{formatPrice(lv.entry)}</strong>
                      </div>
                      <div>
                        <span>STOP LOSS</span>
                        <strong className="red-text">{formatPrice(lv.stop)}</strong>
                      </div>
                      <div>
                        <span>TP1 · {tp1}R</span>
                        <strong className="green-text">{formatPrice(lv.tp1)}</strong>
                      </div>
                      <div>
                        <span>TP2 · {tp2}R</span>
                        <strong className="green-text">{formatPrice(lv.tp2)}</strong>
                      </div>
                      <div>
                        <span>TP3 · {tp3}R</span>
                        <strong className="green-text">{formatPrice(lv.tp3)}</strong>
                      </div>
                    </div>
                  </>
                );
              })()}
              <p className="risk-note">
                <ShieldCheck size={14} /> Live Binance 15m data. Stop = S1/S2 crossover level ± ATR buffer (ATR only if no usable crossover).
                TP = risk × R multiple. Verify price, spread and risk before trading. Not financial advice.
              </p>
            </div>
            <div className="panel rules-panel">
              <div className="section-title">
                Signal rules{' '}
                <span className="rules-icon">
                  <CircleHelp size={15} />
                </span>
              </div>
              <div className="rule-row">
                <span className="rule-number">01</span>
                <div>
                  <strong>Trend filter</strong>
                  <p>S1 fast MA compared with S2 slow MA</p>
                </div>
              </div>
              <div className="rule-row">
                <span className="rule-number">02</span>
                <div>
                  <strong>Momentum check</strong>
                  <p>RSI above/below the {midline} midline</p>
                </div>
              </div>
              <div className="rule-row">
                <span className="rule-number">03</span>
                <div>
                  <strong>Risk framework</strong>
                  <p>ATR stop distance with {tp1}R / {tp2}R / {tp3}R targets</p>
                </div>
              </div>
              <button className="text-action" onClick={() => setShowSettings(true)}>
                Adjust strategy parameters <span>→</span>
              </button>
            </div>
          </div>
        </section>
        <footer className="footer">
          <span>
            © 2026 BitPulse Quantitative Trades <span className="footer-sep">·</span> Built for disciplined market analysis
          </span>
          <span>
            <span className="footer-dot" /> Live Binance data <span className="footer-sep">·</span> Not financial advice
          </span>
        </footer>
        {notice && (
          <div className="toast">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        )}
        {showWebsiteSettings && (
          <div className="modal-backdrop" onClick={() => setShowWebsiteSettings(false)}>
            <div className="settings-modal website-settings-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header"><div><span className="eyebrow">BPQT PREFERENCES</span><h2>Website settings</h2></div><button className="icon-btn" onClick={() => setShowWebsiteSettings(false)} aria-label="Close website settings"><X size={18} /></button></div>
              <p className="modal-copy">Personalize the embedded TradingView chart. These controls change this website's chart display only; they do not edit your Pine scripts or TradingView account.</p>
              <div className="settings-grid website-preferences-grid">
                <label>Chart appearance<select value={chartTheme} onChange={e => setChartTheme(e.target.value as 'dark' | 'light')}><option value="dark">Dark</option><option value="light">Light</option></select></label>
                <label>Chart timezone<select value={chartTimezone} onChange={e => setChartTimezone(e.target.value)}><option value="Etc/UTC">UTC</option><option value="Africa/Kampala">East Africa · Kampala</option><option value="America/New_York">New York</option><option value="Europe/London">London</option><option value="Asia/Tokyo">Tokyo</option></select></label>
                <label>Default chart timeframe<select value={timeframe} onChange={e => setTimeframe(e.target.value)}>{tfs.map(tf => <option key={tf} value={tf}>{tf}</option>)}</select></label>
              </div>
              <div className="settings-note"><CircleHelp size={15} /> Pine Editor is part of TradingView's full charting workspace and cannot be embedded inside a third-party website. Use the Open Pine Editor button, sign in if prompted, then open the Pine Editor panel below the chart.</div>
              <div className="modal-actions"><button className="secondary-btn" onClick={() => { setChartTheme('dark'); setChartTimezone('Etc/UTC'); setTimeframe('15m'); }}>Reset preferences</button><button className="primary-btn" onClick={() => { setShowWebsiteSettings(false); setNotice('Website chart preferences applied.'); }}>Done</button></div>
            </div>
          </div>
        )}
        {showSettings && (
          <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
            <div className="settings-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="eyebrow">BPQT CONFIGURATION</span>
                  <h2>Strategy settings</h2>
                </div>
                <button className="icon-btn" onClick={() => setShowSettings(false)} aria-label="Close strategy settings">
                  <X size={18} />
                </button>
              </div>
              <p className="modal-copy">
                Adjust the signal model. Changes recalculate the crypto grid, roadmap and trade plan from the stored candles.
              </p>
              <div className="settings-grid">
                <label>
                  Fast MA (S1)
                  <input type="number" min="1" value={fastLen} onChange={e => setFastLen(Math.max(1, Number(e.target.value) || 1))} />
                </label>
                <label>
                  Slow MA (S2)
                  <input type="number" min="2" value={slowLen} onChange={e => setSlowLen(Math.max(2, Number(e.target.value) || 2))} />
                </label>
                <label>
                  RSI period
                  <input type="number" min="2" value={rsiPeriod} onChange={e => setRsiPeriod(Math.max(2, Number(e.target.value) || 2))} />
                </label>
                <label>
                  RSI midline
                  <input type="number" min="1" max="99" value={midline} onChange={e => setMidline(Math.min(99, Math.max(1, Number(e.target.value) || 50)))} />
                </label>
                <label>
                  ATR multiplier
                  <input type="number" min="0.1" step="0.1" value={atrMult} onChange={e => setAtrMult(Math.max(0.1, Number(e.target.value) || 0.1))} />
                </label>
                <label>
                  TP1 risk multiple
                  <input type="number" min="0.1" step="0.1" value={tp1} onChange={e => setTp1(Math.max(0.1, Number(e.target.value) || 0.1))} />
                </label>
                <label>
                  TP2 risk multiple
                  <input type="number" min="0.1" step="0.1" value={tp2} onChange={e => setTp2(Math.max(0.1, Number(e.target.value) || 0.1))} />
                </label>
                <label>
                  TP3 risk multiple
                  <input type="number" min="0.1" step="0.1" value={tp3} onChange={e => setTp3(Math.max(0.1, Number(e.target.value) || 0.1))} />
                </label>
              </div>
              <div className="settings-note">
                <CircleHelp size={15} /> RSI and MA values are calculated from Binance OHLCV candles. Forex, metals and indices are static samples.
              </div>
              <div className="modal-actions">
                <button
                  className="secondary-btn"
                  onClick={() => {
                    setFastLen(20);
                    setSlowLen(50);
                    setRsiPeriod(14);
                    setMidline(50);
                    setAtrMult(1.5);
                    setTp1(1);
                    setTp2(2);
                    setTp3(3);
                  }}
                >
                  Reset defaults
                </button>
                <button
                  className="primary-btn"
                  onClick={() => {
                    setShowSettings(false);
                    setNotice('Strategy settings applied.');
                  }}
                >
                  Apply settings
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
export default App;