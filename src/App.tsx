import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  ChartCandlestick,
  ChevronDown,
  CircleHelp,
  Clock3,
  Crosshair,
  Code2,
  ExternalLink,
  LayoutDashboard,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
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
const seedPairs: Pair[] = [
  {
    symbol: 'BINANCE:BTCUSDT',
    name: 'Bitcoin',
    category: 'Crypto',
    price: '67,482.10',
    change: '+1.82%',
    positive: true,
    rsi: 57.8,
    fast: 67440,
    slow: 67390,
    timeframe: '15m',
    updated: 'Just now',
  },
  {
    symbol: 'BINANCE:ETHUSDT',
    name: 'Ethereum',
    category: 'Crypto',
    price: '2,614.72',
    change: '+0.94%',
    positive: true,
    rsi: 53.2,
    fast: 2615,
    slow: 2617,
    timeframe: '15m',
    updated: 'Just now',
  },
  {
    symbol: 'BINANCE:SOLUSDT',
    name: 'Solana',
    category: 'Crypto',
    price: '148.26',
    change: '-0.62%',
    positive: false,
    rsi: 46.1,
    fast: 148.2,
    slow: 148.5,
    timeframe: '15m',
    updated: 'Just now',
  },
  {
    symbol: 'BINANCE:XRPUSDT',
    name: 'XRP',
    category: 'Crypto',
    price: '0.5842',
    change: '+2.17%',
    positive: true,
    rsi: 61.3,
    fast: 0.584,
    slow: 0.581,
    timeframe: '15m',
    updated: 'Just now',
  },
  {
    symbol: 'BINANCE:BNBUSDT',
    name: 'BNB',
    category: 'Crypto',
    price: '598.40',
    change: '+0.31%',
    positive: true,
    rsi: 50.8,
    fast: 598.2,
    slow: 598.1,
    timeframe: '15m',
    updated: 'Just now',
  },
  {
    symbol: 'BINANCE:DOGEUSDT',
    name: 'Dogecoin',
    category: 'Crypto',
    price: '0.1638',
    change: '-1.24%',
    positive: false,
    rsi: 39.4,
    fast: 0.163,
    slow: 0.165,
    timeframe: '15m',
    updated: 'Just now',
  },
  {
    symbol: 'OANDA:EURUSD',
    name: 'EUR/USD',
    category: 'Forex',
    price: '1.08462',
    change: '+0.14%',
    positive: true,
    rsi: 54.6,
    fast: 1.0847,
    slow: 1.0845,
    timeframe: '15m',
    updated: 'Just now',
  },
  {
    symbol: 'OANDA:GBPUSD',
    name: 'GBP/USD',
    category: 'Forex',
    price: '1.26714',
    change: '-0.22%',
    positive: false,
    rsi: 44.8,
    fast: 1.267,
    slow: 1.268,
    timeframe: '15m',
    updated: 'Just now',
  },
  {
    symbol: 'OANDA:USDJPY',
    name: 'USD/JPY',
    category: 'Forex',
    price: '149.825',
    change: '+0.08%',
    positive: true,
    rsi: 51.6,
    fast: 149.83,
    slow: 149.81,
    timeframe: '15m',
    updated: 'Just now',
  },
  {
    symbol: 'OANDA:XAUUSD',
    name: 'Gold',
    category: 'Metals',
    price: '2,658.40',
    change: '+0.56%',
    positive: true,
    rsi: 58.2,
    fast: 2658.5,
    slow: 2657.8,
    timeframe: '15m',
    updated: 'Just now',
  },
  {
    symbol: 'OANDA:NAS100USD',
    name: 'Nasdaq 100',
    category: 'Indices',
    price: '20,214.8',
    change: '+0.42%',
    positive: true,
    rsi: 49.2,
    fast: 20214,
    slow: 20216,
    timeframe: '15m',
    updated: 'Just now',
  },
  {
    symbol: 'OANDA:US30USD',
    name: 'Dow Jones',
    category: 'Indices',
    price: '42,183.2',
    change: '-0.17%',
    positive: false,
    rsi: 47.5,
    fast: 42180,
    slow: 42190,
    timeframe: '15m',
    updated: 'Just now',
  },
];
const tfs = ['1m', '5m', '15m', '30m', '1h', '4h', '1D'];
const tvInterval: Record<string, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '240',
  '1D': 'D',
};
function getSignal(p: Pair, midline: number): Side {
  if (p.category !== 'Crypto' || !p.live) return 'WAIT';
  return p.fast > p.slow && p.rsi > midline
    ? 'BUY'
    : p.fast < p.slow && p.rsi < midline
      ? 'SELL'
      : 'WAIT';
}
function calculateEma(values: number[], period: number): number {
  if (!values.length) return 0;
  const alpha = 2 / (period + 1);
  return values.slice(1).reduce((ema, value) => value * alpha + ema * (1 - alpha), values[0]);
}
function calculateRsi(values: number[], period: number): number {
  if (values.length <= period) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change > 0) gain += change;
    else loss -= change;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
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
const binanceInterval: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1D': '1d',
};
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
    // Step 1: D1 extreme and all seven timeframe MA/RSI rows must align.
    sellArm: green && !!d1 && d1.rsi > 70,
    buyArm: red && !!d1 && d1.rsi < 30,
    sellConfirm: !!m15 && m15.prevFast >= m15.prevSlow && m15.fast < m15.slow && m15.rsi < midline,
    buyConfirm: !!m15 && m15.prevFast <= m15.prevSlow && m15.fast > m15.slow && m15.rsi > midline,
  };
}
type Candle = { t: number; h: number; l: number; c: number };
type PlanData = { atr: number; buyCross?: number; sellCross?: number };
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
  const [showCryptoGridNote, setShowCryptoGridNote] = useState(false);
  const [showFeedStatusNote, setShowFeedStatusNote] = useState(false);
  const active = pairs.find(p => p.symbol === selected) ?? pairs[0];
  const activeMomentum = momentumSeries[active.symbol.split(':')[1]] ?? [];
  const momentumPoints = activeMomentum.map((value, index) => {
    const x = activeMomentum.length > 1 ? (index / (activeMomentum.length - 1)) * 1000 : 1000;
    return x.toFixed(1) + ',' + (180 - value * 1.8).toFixed(1);
  }).join(' ');
  const activeRsi = activeMomentum.length ? activeMomentum[activeMomentum.length - 1] : active.rsi;
  const activeZone = activeRsi > midline ? 'BUY ZONE' : 'SELL ZONE';
  const metricPairs = pairs.filter(p => p.category === 'Crypto');
  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    const cryptoPairs = seedPairs.filter(p => p.category === 'Crypto');
    const candleHistory: Record<string, number[]> = {};
    const updateCrypto = (symbol: string, update: Partial<Pair>) => {
      if (disposed) return;
      setPairs(previous => previous.map(pair => pair.symbol === 'BINANCE:' + symbol ? { ...pair, ...update } : pair));
    };
    const loadHistory = async () => {
      await Promise.all(cryptoPairs.map(async pair => {
        const symbol = pair.symbol.split(':')[1];
        try {
          const response = await fetch('https://data-api.binance.vision/api/v3/klines?symbol=' + symbol + '&interval=15m&limit=150');
          if (!response.ok) throw new Error('Binance candles HTTP ' + response.status);
          const rows: unknown[][] = await response.json();
          const closes = rows.filter(row => Number(row[6]) < Date.now()).map(row => Number(row[4])).filter(Number.isFinite);
          if (closes.length < 51) throw new Error('Not enough closed candles for ' + symbol);
          candleHistory[symbol] = closes;
          setMomentumSeries(previous => ({ ...previous, [symbol]: calculateRsiSeries(closes, rsiPeriod) }));
          updateCrypto(symbol, { price: displayMarketPrice(closes[closes.length - 1]), rsi: calculateRsi(closes, rsiPeriod), fast: calculateEma(closes, fastLen), slow: calculateEma(closes, slowLen), timeframe: '15m', updated: 'Binance · live candles', live: true });
        } catch (error) {
          console.warn('Binance history unavailable for ' + symbol, error);
        }
      }));
    };
    const connect = () => {
      if (disposed) return;
      setFeedStatus('connecting');
      const streams = cryptoPairs.flatMap(pair => {
        const symbol = pair.symbol.split(':')[1].toLowerCase();
        return [symbol + '@ticker', symbol + '@kline_15m'];
      }).join('/');
      try {
        socket = new WebSocket('wss://data-stream.binance.vision/stream?streams=' + streams);
      } catch (error) {
        console.warn('Could not open Binance market-data socket', error);
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
            updateCrypto(data.s, { price: displayMarketPrice(price), change: (percent >= 0 ? '+' : '') + percent.toFixed(2) + '%', positive: percent >= 0, updated: 'Binance · live' });
          }
          if (data.e === 'kline' && data.s && data.k && data.k.x) {
            const symbol = data.s;
            const closes = candleHistory[symbol] ?? [];
            const close = Number(data.k.c);
            if (Number.isFinite(close) && closes[closes.length - 1] !== close) closes.push(close);
            if (closes.length > 200) closes.splice(0, closes.length - 200);
            candleHistory[symbol] = closes;
            if (closes.length >= 51) {
              setMomentumSeries(previous => ({ ...previous, [symbol]: calculateRsiSeries(closes, rsiPeriod) }));
              updateCrypto(symbol, { rsi: calculateRsi(closes, rsiPeriod), fast: calculateEma(closes, fastLen), slow: calculateEma(closes, slowLen), timeframe: '15m', updated: 'Binance · candle closed', live: true });
            }
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
    void loadHistory();
    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (socket) { socket.onclose = null; socket.close(); }
    };
  }, [rsiPeriod, fastLen, slowLen, refreshKey]);
  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    const history: Record<string, number[]> = {};
    const lastCloseTime: Record<string, number> = {};
    const symbols = seedPairs.filter(p => p.category === 'Crypto').map(p => p.symbol.split(':')[1]);
    const apply = (symbol: string, label: string, liveClose = false) => {
      if (disposed) return;
      const key = symbol + '|' + label;
      const row = analyze(history[key] ?? [], rsiPeriod, fastLen, slowLen);
      if (!row) return;
      const cross: 'BUY' | 'SELL' | undefined = liveClose && label === '15m'
        ? row.prevFast <= row.prevSlow && row.fast > row.slow
          ? 'BUY'
          : row.prevFast >= row.prevSlow && row.fast < row.slow
            ? 'SELL'
            : undefined
        : undefined;
      setPairs(previous => previous.map(p => {
        if (p.symbol !== 'BINANCE:' + symbol) return p;
        const tf = { ...(p.tf ?? {}), [label]: row };
        const ready = tfs.every(tfLabel => tf[tfLabel] !== undefined);
        return {
          ...p,
          tf,
          live: ready,
          ...(label === '15m' ? { rsi: row.rsi, fast: row.fast, slow: row.slow } : {}),
          ...(cross ? { liveCross: cross, liveCrossAt: lastCloseTime[key] } : {})
        };
      }));
    };
    const load = async () => {
      await Promise.all(symbols.flatMap(symbol => tfs.map(async label => {
        const key = symbol + '|' + label;
        try {
          const response = await fetch('https://data-api.binance.vision/api/v3/klines?symbol=' + symbol + '&interval=' + binanceInterval[label] + '&limit=200');
          if (!response.ok) throw new Error('Binance candles HTTP ' + response.status);
          const rows: unknown[][] = await response.json();
          const closed = rows.filter(row => Number(row[6]) < Date.now());
          history[key] = closed.map(row => Number(row[4])).filter(Number.isFinite);
          lastCloseTime[key] = Number(closed[closed.length - 1]?.[6] ?? 0);
          apply(symbol, label, false);
        } catch (error) {
          console.warn('Binance ' + label + ' history unavailable for ' + symbol, error);
        }
      })));
    };
    const connect = () => {
      if (disposed) return;
      const streams = symbols.flatMap(s => tfs.map(label => s.toLowerCase() + '@kline_' + binanceInterval[label])).join('/');
      try {
        socket = new WebSocket('wss://data-stream.binance.vision/stream?streams=' + streams);
      } catch (error) {
        console.warn('Could not open multi-timeframe socket', error);
        reconnectTimer = window.setTimeout(connect, 5000);
        return;
      }
      socket.onmessage = event => {
        try {
          const packet = JSON.parse(String(event.data));
          const data = packet.data ?? packet;
          if (data.e !== 'kline' || !data.k || !data.k.x) return;
          const label = tfs.find(l => binanceInterval[l] === data.k.i);
          if (!label) return;
          const key = data.s + '|' + label;
          if (!history[key] || lastCloseTime[key] === data.k.T) return;
          lastCloseTime[key] = data.k.T;
          history[key].push(Number(data.k.c));
          if (history[key].length > 300) history[key].splice(0, history[key].length - 300);
          apply(data.s, label, true);
        } catch (error) {
          console.warn('Could not parse multi-timeframe update', error);
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        reconnectTimer = window.setTimeout(connect, 5000);
      };
    };
    void load();
    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (socket) { socket.onclose = null; socket.close(); }
    };
  }, [rsiPeriod, fastLen, slowLen, refreshKey]);
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
        if (e.d1Rsi !== undefined && e.d1Rsi <= 70) {
          // Release the one-shot lock for a future SELL setup, but preserve an already-armed setup in memory.
          s.sellLocked = false;
        }
        if (e.buyArm && !s.buyArmed && !s.buyLocked) {
          s.buyArmed = true;
          s.sellArmed = false;
          s.armedAt = Date.now();
          s.confirmed = undefined;
        }
        if (e.d1Rsi !== undefined && e.d1Rsi >= 30) {
          // Release the one-shot lock for a future BUY setup, but preserve an already-armed setup in memory.
          s.buyLocked = false;
        }
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
    } catch {
      /* storage unavailable */
    }
  }, [roadmap]);
  const [plans, setPlans] = useState<Record<string, PlanData>>({});
  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    const symbols = seedPairs.filter(p => p.category === 'Crypto').map(p => p.symbol.split(':')[1]);
    const store: Record<string, Candle[]> = {};
    const publish = (symbol: string) => {
      const candles = store[symbol];
      if (disposed || !candles || candles.length < 60) return;
      const crosses = findCrossLevels(candles.map(c => c.c), fastLen, slowLen);
      const plan: PlanData = { atr: calculateAtr(candles, 14), ...crosses };
      setPlans(previous => ({ ...previous, ['BINANCE:' + symbol]: plan }));
    };
    const load = async () => {
      await Promise.all(symbols.map(async symbol => {
        try {
          const response = await fetch('https://data-api.binance.vision/api/v3/klines?symbol=' + symbol + '&interval=15m&limit=300');
          if (!response.ok) throw new Error('Binance candles HTTP ' + response.status);
          const rows: unknown[][] = await response.json();
          store[symbol] = rows
            .filter(row => Number(row[6]) < Date.now())
            .map(row => ({ t: Number(row[0]), h: Number(row[2]), l: Number(row[3]), c: Number(row[4]) }))
            .filter(c => Number.isFinite(c.h) && Number.isFinite(c.l) && Number.isFinite(c.c));
          publish(symbol);
        } catch (error) {
          console.warn('Trade-plan candles unavailable for ' + symbol, error);
        }
      }));
    };
    const connect = () => {
      if (disposed) return;
      const streams = symbols.map(s => s.toLowerCase() + '@kline_15m').join('/');
      try {
        socket = new WebSocket('wss://data-stream.binance.vision/stream?streams=' + streams);
      } catch (error) {
        console.warn('Could not open trade-plan socket', error);
        reconnectTimer = window.setTimeout(connect, 5000);
        return;
      }
      socket.onmessage = event => {
        try {
          const packet = JSON.parse(String(event.data));
          const data = packet.data ?? packet;
          if (data.e !== 'kline' || !data.k || !data.k.x) return;
          const list = store[data.s];
          if (!list) return;
          const candle: Candle = { t: Number(data.k.t), h: Number(data.k.h), l: Number(data.k.l), c: Number(data.k.c) };
          if (list.length && list[list.length - 1].t >= candle.t) return;
          list.push(candle);
          if (list.length > 400) list.splice(0, list.length - 400);
          publish(data.s);
        } catch (error) {
          console.warn('Could not parse trade-plan update', error);
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        reconnectTimer = window.setTimeout(connect, 5000);
      };
    };
    void load();
    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [fastLen, slowLen, refreshKey]);
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
    () =>
      pairs.filter(
        p =>
          (filter === 'All markets' || p.category === filter) &&
          (p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.symbol.toLowerCase().includes(query.toLowerCase()))
      ),
    [pairs, filter, query, midline]
  );
  const signalCounts = useMemo(
    () =>
      metricPairs.reduce(
        (a, p) => {
          a[getSignal(p, midline)]++;
          return a;
        },
        { BUY: 0, SELL: 0, WAIT: 0 }
      ),
    [metricPairs, midline]
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
    credit.innerHTML =
      '<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">Chart by TradingView</a>';
    root.appendChild(credit);
    const script = document.createElement('script');
    script.id = 'tv-widget-script';
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
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
  const getTradeSide = (p: Pair): Side => {
    const confirmed = getPairSignal(p);
    return confirmed !== 'WAIT' ? confirmed : getSignal(p, midline);
  };
  const getLevels = (p: Pair) => {
    const price = Number(p.price.replaceAll(',', ''));
    const plan = plans[p.symbol];
    const sideNow = getTradeSide(p);
    const atr = plan?.atr ?? 0;
    const cross = sideNow === 'BUY' ? plan?.buyCross : sideNow === 'SELL' ? plan?.sellCross : undefined;
    let risk = atr * atrMult;
    let basis = 'atr';
    if (cross !== undefined && atr > 0) {
      const crossRisk = sideNow === 'BUY' ? price - (cross - atr * atrMult) : cross + atr * atrMult - price;
      if (crossRisk > 0) {
        risk = crossRisk;
        basis = 'cross';
      }
    }
    risk = Math.max(risk, 0.0000001);
    const side = getTradeSide(p);
    const entry = price;
    const stop =
      side === 'BUY' ? entry - risk : entry + risk;
    const target = (r: number) =>
      side === 'BUY' ? entry + risk * r : entry - risk * r;
    return {
      entry,
      stop,
      tp1: target(tp1),
      basis,
      atr,
      hasSignal: side !== 'WAIT',
      tp2: target(tp2),
      tp3: target(tp3),
    };
  };
  const formatPrice = (n: number) =>
    n.toLocaleString('en-US', {
      maximumFractionDigits:
        active.category === 'Forex' && active.name.includes('JPY')
          ? 3
          : active.price.includes('.') && active.price.split('.')[1]?.length > 3
            ? 5
            : 2,
    });
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
            onClick={() =>
              document
                .getElementById('signal-grid')
                ?.scrollIntoView({ behavior: 'smooth' })
            }
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
          CRYPTO <span>06</span>
        </div>
        {pairs
          .filter(p => p.category === 'Crypto')
          .slice(0, 6)
          .map(p => (
            <button
              key={p.symbol}
              className={'watch-row ' + (selected === p.symbol ? 'chosen' : '')}
              onClick={() => selectPair(p.symbol)}
            >
              <span className="coin-icon">
                {p.name === 'Bitcoin'
                  ? '₿'
                  : p.name === 'Ethereum'
                    ? '◆'
                    : p.name.slice(0, 1)}
              </span>
              <span className="watch-name">
                {p.name}
                <small>{p.symbol.split(':')[1]}</small>
              </span>
              <span className={p.positive ? 'positive' : 'negative'}>
                {p.change}
              </span>
            </button>
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
            <button
              className="icon-btn"
              aria-label="Notifications"
              onClick={() => setNotice('No new notifications.')}
            >
              <Bell size={18} />
            </button>
            <button
              className="profile"
              onClick={() => setNotice('BPQT terminal · Local demo workspace')}
            >
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
            <button
              className="secondary-btn"
              onClick={() => setShowSettings(true)}
            >
              <Settings2 size={16} /> Configure strategy
            </button>
            <button
              className="primary-btn"
              onClick={() => {
                setNotice(
                  'Reloading 15m candles from Binance…'
                );
                setRefreshKey(k => k + 1);
              }}
            >
              <Activity size={16} /> Refresh scanner
            </button>
          </div>
        </section>
        {!showFeedStatusNote && <button className="help-toggle standalone-help" aria-label="Show Binance feed notes" title="Binance feed notes" aria-expanded={false} onClick={() => setShowFeedStatusNote(true)}>?</button>}
        <div className={'demo-warning' + (showFeedStatusNote ? '' : ' info-hidden')}>
          <CircleHelp size={16} />
          <div className="demo-warning-content">
            <strong>{feedStatus === 'live' ? 'Binance spot feed connected · crypto signals use live candles' : 'Connecting to Binance public market data…'}</strong>
            {showFeedStatusNote && <span>Bitcoin, Ethereum, Solana, XRP, BNB and Dogecoin update from Binance public price streams. RSI(14), EMA {fastLen} and EMA {slowLen} are calculated from completed 15-minute candles. Forex, gold and indices remain unconnected and are excluded from BUY/SELL/WAIT totals.</span>}
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
            <div className="metric-value green-text">
              {signalCounts.BUY.toString().padStart(2, '0')}
            </div>
            <div className="metric-note">
              <span className="signal-dot buy-dot" /> S1 above S2 · RSI above{' '}
              {midline}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-top">
              <span>Sell setups</span>
              <div className="metric-icon red">
                <TrendingDown size={18} />
              </div>
            </div>
            <div className="metric-value red-text">
              {signalCounts.SELL.toString().padStart(2, '0')}
            </div>
            <div className="metric-note">
              <span className="signal-dot sell-dot" /> S1 below S2 · RSI below{' '}
              {midline}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-top">
              <span>Waiting for confirmation</span>
              <div className="metric-icon amber">
                <Clock3 size={18} />
              </div>
            </div>
            <div className="metric-value">
              {signalCounts.WAIT.toString().padStart(2, '0')}
            </div>
            <div className="metric-note">
              <span className="note-neutral">Mixed conditions</span> · no signal
            </div>
          </div>
        </section>
        <section className="chart-section panel">
          <div className="section-header chart-header">
            <div>
              <div className="section-title">
                Market chart{' '}
                <span className="live-label">
                  <i /> TRADINGVIEW
                </span>
              </div>
              <div className="chart-instrument">
                <span className="coin-icon large">
                  {active.name === 'Bitcoin' ? '₿' : active.name.slice(0, 1)}
                </span>
                <div>
                  <strong>{active.name}</strong>
                  <span>{active.symbol.replace(':', ' · ')}</span>
                </div>
                <strong className="chart-price">{active.price}</strong>
                <span className={active.positive ? 'positive' : 'negative'}>
                  {active.change}
                </span>
              </div>
            </div>
            <div className="chart-actions">
              <div className="tf-switch">
                {tfs.map(tf => (
                  <button key={tf} className={timeframe === tf ? 'selected' : ''} onClick={() => setTimeframe(tf)}>{tf}</button>
                ))}
              </div>
              <a className="primary-btn tv-editor-link" href="https://www.tradingview.com/chart/" target="_blank" rel="noopener noreferrer"><Code2 size={15} /> Open Pine Editor <ExternalLink size={13} /></a>
            </div>
          </div>
          <div id="tv-chart" className="tv-chart">
            <div className="chart-loading">Loading TradingView chart…</div>
          </div>
        </section>
        <section className="panel momentum-panel">
          <div className="section-header signal-header">
            <div>
              <div className="section-title">BitPulse Momentum Zone Tracker</div>
              <p>Live Binance RSI line · selected market · completed 15-minute candles</p>
            </div>
            <a className="secondary-btn pine-shortcut" href="https://www.tradingview.com/chart/" target="_blank" rel="noopener noreferrer"><Code2 size={15} /> Add in Pine Editor <ExternalLink size={13} /></a>
          </div>
          <div className="momentum-body">
            <div className={'momentum-chart ' + (activeRsi > midline ? 'momentum-buy' : 'momentum-sell')}>
              <div className="momentum-zone upper"><span>BUY ZONE · RSI ABOVE {midline}</span></div>
              <div className="momentum-zone lower"><span>SELL ZONE · RSI BELOW {midline}</span></div>
              <div className="momentum-line line-70"></div>
              <div className="momentum-line line-50"></div>
              <div className="momentum-line line-30"></div>
              {activeMomentum.length > 1 ? <svg className="momentum-svg" viewBox="0 0 1000 180" preserveAspectRatio="none" role="img" aria-label={'Live RSI line chart for ' + active.name}>
                <polyline points={momentumPoints} fill="none" stroke={activeRsi > midline ? '#78e0aa' : '#ff7887'} strokeWidth="3" vectorEffect="non-scaling-stroke" />
                <circle cx="1000" cy={180 - activeRsi * 1.8} r="5" fill={activeRsi > midline ? '#78e0aa' : '#ff7887'} stroke="#07111e" strokeWidth="2" />
              </svg> : <div className="momentum-loading">Waiting for live Binance RSI candles…</div>}
              <div className={'momentum-current-label ' + (activeRsi > midline ? 'buy' : 'sell')} style={{ top: Math.max(8, Math.min(188, 220 - activeRsi * 2.2 - 14)) + 'px' }}>{activeZone} · RSI {activeRsi.toFixed(1)}</div>
              <div className="momentum-axis"><span>100</span><span>70</span><span>50</span><span>30</span><span>0</span></div>
            </div>
            <div className="momentum-legend">
              <span><i className="legend-green"></i> RSI above {midline} · BUY ZONE</span>
              <span><i className="legend-red"></i> RSI below {midline} · SELL ZONE</span>
              <span>Market: {active.name} · 15m · RSI({rsiPeriod})</span>
            </div>
            <p className="integration-note">This is a live RSI line calculated from Binance completed 15-minute candles for the selected crypto market. It is separate from the embedded TradingView chart; add the Pine indicator in TradingView if you want it inside that chart.</p>
          </div>
        </section>
        <section className="panel roadmap-panel" id="signals">
          <div className="section-header signal-header">
            <div>
              <div className="section-title">BPQT Reversal Roadmap</div>
              <p>Step 1: D1 RSI above 70 plus all seven MA/RSI rows green arms SELL; D1 RSI below 30 plus all seven rows red arms BUY. The setup is remembered. Step 2: wait for a fresh completed 15m EMA20/50 flip and RSI confirmation.</p>
            </div>
            <span className="mini-tag">3R TARGET</span>
          </div>
          <div className="roadmap-grid">
            <article className="roadmap-card sell-roadmap">
              <div className="roadmap-title"><span className="roadmap-icon">↓</span><div><strong>SELL ENTRY SETUP</strong><small>Daily overbought → 15m confirmation</small></div></div>
              <div className="roadmap-step"><span>STEP 1</span><div><strong>All 7 timeframes GREEN + D1 RSI(14) above 70 — ARM SELL</strong><p>When D1 RSI first rises above 70, store the SELL setup in memory. It stays ARMED even if D1 RSI later drops back below 70; do not cancel it while waiting for the 15m flip.</p></div><b className={'state-' + sellStep1[0]}>{sellStep1[1]}</b></div>
              <div className="roadmap-step"><span>STEP 2</span><div><strong>Wait for the 15m SELL flip</strong><p>Only after Step 1 is armed, confirm on a newly completed 15m candle where EMA 20 crosses below EMA 50 and 15m RSI(14) is below 50.</p></div><b className={'state-' + sellStep2[0]}>{sellStep2[1]}</b></div>
              <div className="roadmap-result"><strong>SELL ENTRY</strong><span>Only after both conditions are verified</span></div>
            </article>
            <article className="roadmap-card buy-roadmap">
              <div className="roadmap-title"><span className="roadmap-icon">↑</span><div><strong>BUY ENTRY SETUP</strong><small>Daily oversold → 15m confirmation</small></div></div>
              <div className="roadmap-step"><span>STEP 1</span><div><strong>All 7 timeframes RED + D1 RSI(14) below 30 — ARM BUY</strong><p>When D1 RSI first falls below 30, store the BUY setup in memory. It stays ARMED even if D1 RSI later rises back above 30; do not cancel it while waiting for the 15m flip.</p></div><b className={'state-' + buyStep1[0]}>{buyStep1[1]}</b></div>
              <div className="roadmap-step"><span>STEP 2</span><div><strong>Wait for the 15m BUY flip</strong><p>Only after Step 1 is armed, confirm on a newly completed 15m candle where EMA 20 crosses above EMA 50 and 15m RSI(14) is above 50.</p></div><b className={'state-' + buyStep2[0]}>{buyStep2[1]}</b></div>
              <div className="roadmap-result"><strong>BUY ENTRY</strong><span>Only after both conditions are verified</span></div>
            </article>
          </div>
          <div className="roadmap-table-wrap">
            <table className="roadmap-table">
              <thead>
                <tr>
                  <th>PAIR</th>
                  <th>D1 RSI</th>
                  {tfs.map(label => <th key={label}>{label}</th>)}
                  <th>SELL SETUP</th>
                  <th>BUY SETUP</th>
                  <th>ENTRY</th>
                </tr>
              </thead>
              <tbody>
                {rmRows.map(({ p, e, s }) => (
                  <tr key={p.symbol}>
                    <td>{shortName(p)}</td>
                    <td>{e.d1Rsi !== undefined ? e.d1Rsi.toFixed(1) : '…'}</td>
                    {tfs.map(label => {
                      const r = p.tf?.[label];
                      const cls = !r ? '' : r.fast > r.slow && r.rsi > midline ? 'tf-green' : r.fast < r.slow && r.rsi < midline ? 'tf-red' : 'tf-mixed';
                      return (
                        <td key={label}>
                          <span className={'tf-dot ' + cls} title={r ? 'RSI ' + r.rsi.toFixed(1) + ' · S1 ' + (r.fast > r.slow ? '>' : '<') + ' S2' : 'loading'} />
                        </td>
                      );
                    })}
                    <td className={s?.sellArmed ? 'rm-armed' : ''}>{s?.sellArmed ? 'ARMED' : '—'}</td>
                    <td className={s?.buyArmed ? 'rm-armed' : ''}>{s?.buyArmed ? 'ARMED' : '—'}</td>
                    <td className={s?.confirmed ? (s.confirmed.side === 'BUY' ? 'rm-buy' : 'rm-sell') : ''}>{s?.confirmed ? s.confirmed.side + ' · ' + s.confirmed.at : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="risk-framework">
            <div><strong>Stop loss</strong><span>Use the existing 15m S1/S2 crossover signal level. Existing chart levels are left unchanged.</span></div>
            <div><strong>Take profit</strong><span>TP = 3 × entry-to-stop risk (3:1 reward-to-risk).</span></div>
            <div><strong>RSI validation</strong><span>BUY requires 15m RSI &gt; 50 · SELL requires 15m RSI &lt; 50.</span></div>
          </div>
          {!showCryptoGridNote && <button className="help-toggle standalone-help roadmap-help" aria-label="Show crypto grid feed notes" title="Crypto grid feed notes" aria-expanded={false} onClick={() => setShowCryptoGridNote(true)}>?</button>}
          <div className={'feed-warning' + (showCryptoGridNote ? '' : ' info-hidden')}>
            <div className="feed-warning-heading"><CircleHelp size={16}/><strong>Crypto grid feed: Binance public data connected separately from TradingView.</strong><button className="help-toggle" aria-label="Toggle crypto grid feed details" aria-expanded={showCryptoGridNote} onClick={() => setShowCryptoGridNote(value => !value)}>?</button></div>
            {showCryptoGridNote && <p>The signal grid calculates RSI and EMA from completed 15-minute Binance candles for the six crypto pairs. The reversal roadmap reads 1m, 5m, 15m, 30m, 1h, 4h and 1D candles from Binance. Step 1 arms only when D1 RSI is above 70 and all seven MA/RSI rows are green for SELL, or D1 RSI is below 30 and all seven rows are red for BUY. Once armed, the setup stays remembered in this browser even if D1 RSI or timeframe alignment changes, until a fresh completed 15m EMA20/EMA50 cross with the correct RSI confirms it. Crosses that complete while the page is closed are not detected. Forex, metals and indices still need their own data provider.</p>}
          </div>
        </section>
        <section className="signal-layout" id="signal-grid">
          <div className="panel signal-panel">
            <div className="section-header signal-header">
              <div>
                <div className="section-title">Multi-market signal grid</div>
                <p>Live Binance spot prices · RSI and EMA from closed 15m candles · feed: {feedStatus}</p>
              </div>
              <button
                className="small-icon-btn"
                onClick={() => setShowSettings(true)}
                aria-label="Signal settings"
              >
                <SlidersHorizontal size={16} />
              </button>
            </div>
            <div className="filters">
              <div className="search-box">
                <Search size={15} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search instrument..."
                />
              </div>
              <select value={filter} onChange={e => setFilter(e.target.value)}>
                <option>All markets</option>
                <option>Crypto</option>
                <option>Forex</option>
                <option>Metals</option>
                <option>Indices</option>
              </select>
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
                    return (
                      <tr
                        key={p.symbol}
                        className={selected === p.symbol ? 'selected-row' : ''}
                      >
                        <td>
                          <button
                            className="instrument-cell"
                            onClick={() => selectPair(p.symbol)}
                          >
                            <span className="coin-icon">
                              {p.name === 'Bitcoin'
                                ? '₿'
                                : p.name === 'Ethereum'
                                  ? '◆'
                                  : p.name.slice(0, 1)}
                            </span>
                            <span>
                              <strong>{p.name}</strong>
                              <small>{p.symbol.split(':')[1]}</small>
                            </span>
                          </button>
                        </td>
                        <td className="price-cell">
                          {p.price}
                          <small
                            className={p.positive ? 'positive' : 'negative'}
                          >
                            {p.change}
                          </small>
                        </td>
                        <td>
                          <span
                            className={
                              'rsi-pill ' +
                              (p.rsi > 70
                                ? 'overbought'
                                : p.rsi < 30
                                  ? 'oversold'
                                  : '')
                            }
                          >
                            {p.rsi.toFixed(1)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              'ma-state ' +
                              (p.fast > p.slow
                                ? 'bull-state'
                                : p.fast < p.slow
                                  ? 'bear-state'
                                  : '')
                            }
                          >
                            {p.fast > p.slow
                              ? 'S1 > S2'
                              : p.fast < p.slow
                                ? 'S1 < S2'
                                : 'Equal'}
                          </span>
                        </td>
                        <td>
                          <span className={'signal-badge ' + (p.category !== 'Crypto' || !p.live ? 'wait' : getSignal(p, midline).toLowerCase())} title="S1 EMA vs S2 EMA with RSI above or below the midline, from completed 15m Binance candles">
                            <i />
                            {p.category !== 'Crypto' ? 'NO FEED' : p.live ? getSignal(p, midline) : 'LOADING'}
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
                          <span className={'signal-badge ' + (p.category !== 'Crypto' ? 'wait' : s.toLowerCase())} title={p.category !== 'Crypto' ? 'No Binance feed for this market' : p.live ? (roadmap[p.symbol]?.confirmed ? 'Confirmed by the strict BPQT roadmap' : 'Waiting for all roadmap conditions') : 'Waiting for all seven Binance timeframes'}>
                            <i />
                            {p.category !== 'Crypto' ? 'NO FEED' : p.live ? s : 'LOADING'}
                          </span>
                          <small className="roadmap-row-status">{roadmap[p.symbol]?.confirmed ? roadmap[p.symbol]?.confirmed?.side + ' confirmed · ' + roadmap[p.symbol]?.confirmed?.at : roadmap[p.symbol]?.sellArmed ? 'SELL armed · waiting for fresh 15m cross' : roadmap[p.symbol]?.buyArmed ? 'BUY armed · waiting for fresh 15m cross' : p.live ? 'No complete setup' : 'Loading 7 timeframes'}</small>
                        </td>
                        <td>
                          <button
                            className="chart-link"
                            onClick={() => selectPair(p.symbol)}
                          >
                            <Crosshair size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visiblePairs.length === 0 && (
                <div className="empty-state">
                  No instruments match your search.
                </div>
              )}
            </div>
            <div className="table-footer">
              <span>Showing {visiblePairs.length} of {pairs.length} instruments</span>
              <span>Binance live: 6 crypto · no feed: forex/metals/indices</span>
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
                <span className={active.positive ? 'positive' : 'negative'}>
                  {active.change}
                </span>
              </div>
              <div
                className={
                  'detail-signal ' + getPairSignal(active).toLowerCase()
                }
              >
                <span className="signal-dot" />
                {getSignal(active, midline)} SIGNAL{' '}
                <small>
                  {getSignal(active, midline) === 'WAIT'
                    ? 'Conditions not aligned'
                    : 'MA + RSI conditions aligned'}
                </small>
              </div>
              <div className="condition-list">
                <div>
                  <span>S1 / S2 alignment</span>
                  <strong
                    className={
                      active.fast > active.slow
                        ? 'positive'
                        : active.fast < active.slow
                          ? 'negative'
                          : ''
                    }
                  >
                    {active.fast > active.slow
                      ? 'Bullish'
                      : active.fast < active.slow
                        ? 'Bearish'
                        : 'Neutral'}
                  </strong>
                </div>
                <div>
                  <span>RSI ({rsiPeriod})</span>
                  <strong>
                    {active.rsi.toFixed(1)}{' '}
                    <small>
                      {active.rsi > midline
                        ? 'above'
                        : active.rsi < midline
                          ? 'below'
                          : 'at'}{' '}
                      {midline}
                    </small>
                  </strong>
                </div>
                <div>
                  <span>Signal timeframe</span>
                  <strong>{timeframe}</strong>
                </div>
                <div>
                  <span>Signal status</span>
                  <strong>
                    {getSignal(active, midline) === 'WAIT'
                      ? 'Waiting'
                      : 'Conditions met'}
                  </strong>
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
                      <strong className="red-text">
                        {formatPrice(lv.stop)}
                      </strong>
                    </div>
                    <div>
                      <span>TP1 · {tp1}R</span>
                      <strong className="green-text">
                        {formatPrice(lv.tp1)}
                      </strong>
                    </div>
                    <div>
                      <span>TP2 · {tp2}R</span>
                      <strong className="green-text">
                        {formatPrice(lv.tp2)}
                      </strong>
                    </div>
                    <div>
                      <span>TP3 · {tp3}R</span>
                      <strong className="green-text">
                        {formatPrice(lv.tp3)}
                      </strong>
                    </div>
                  </div>
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
                  <p>
                    ATR stop distance with {tp1}R / {tp2}R / {tp3}R targets
                  </p>
                </div>
              </div>
              <button
                className="text-action"
                onClick={() => setShowSettings(true)}
              >
                Adjust strategy parameters <span>→</span>
              </button>
            </div>
          </div>
        </section>
        <footer className="footer">
          <span>
            © 2026 BitPulse Quantitative Trades{' '}
            <span className="footer-sep">·</span> Built for disciplined market
            analysis
          </span>
          <span>
            <span className="footer-dot" /> Live Binance data{' '}
            <span className="footer-sep">·</span> Not financial advice
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
          <div
            className="modal-backdrop"
            onClick={() => setShowSettings(false)}
          >
            <div className="settings-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="eyebrow">BPQT CONFIGURATION</span>
                  <h2>Strategy settings</h2>
                </div>
                <button
                  className="icon-btn"
                  onClick={() => setShowSettings(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <p className="modal-copy">
                Adjust the displayed signal model. Changes apply to the demo
                grid only; this does not alter the supplied Pine Script on
                TradingView.
              </p>
              <div className="settings-grid">
                <label>
                  Fast MA (S1)
                  <input
                    type="number"
                    min="1"
                    value={fastLen}
                    onChange={e =>
                      setFastLen(Math.max(1, Number(e.target.value)))
                    }
                  />
                </label>
                <label>
                  Slow MA (S2)
                  <input
                    type="number"
                    min="2"
                    value={slowLen}
                    onChange={e =>
                      setSlowLen(Math.max(2, Number(e.target.value)))
                    }
                  />
                </label>
                <label>
                  RSI period
                  <input
                    type="number"
                    min="2"
                    value={rsiPeriod}
                    onChange={e =>
                      setRsiPeriod(Math.max(2, Number(e.target.value)))
                    }
                  />
                </label>
                <label>
                  RSI midline
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={midline}
                    onChange={e =>
                      setMidline(
                        Math.min(99, Math.max(1, Number(e.target.value)))
                      )
                    }
                  />
                </label>
                <label>
                  ATR multiplier
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={atrMult}
                    onChange={e =>
                      setAtrMult(Math.max(0.1, Number(e.target.value)))
                    }
                  />
                </label>
                <label>
                  TP1 risk multiple
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={tp1}
                    onChange={e =>
                      setTp1(Math.max(0.1, Number(e.target.value)))
                    }
                  />
                </label>
                <label>
                  TP2 risk multiple
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={tp2}
                    onChange={e =>
                      setTp2(Math.max(0.1, Number(e.target.value)))
                    }
                  />
                </label>
                <label>
                  TP3 risk multiple
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={tp3}
                    onChange={e =>
                      setTp3(Math.max(0.1, Number(e.target.value)))
                    }
                  />
                </label>
              </div>
              <div className="settings-note">
                <CircleHelp size={15} /> MA lengths are configuration
                placeholders in this demo. Live RSI and MA values need to be
                calculated from an actual OHLCV feed.
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
                    setNotice('Demo strategy parameters updated.');
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
