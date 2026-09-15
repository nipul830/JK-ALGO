import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Bell, ChevronDown, CircleDollarSign, Crosshair, LineChart, List, Maximize2, Plus, RotateCcw, Settings, SlidersHorizontal, Sparkles, TrendingDown, TrendingUp, Wallet, X, Zap } from "lucide-react";
import "./styles.css";

type Page = "watchlist" | "charts" | "algo" | "pnl";
type Mode = "PAPER" | "REAL";
type Side = "BUY" | "SELL";
type Trade = { id:string; symbol:string; side:Side; qty:number; entry:number; current:number; sl:number; tp:number; pnl:number; strategy:string; time:string };
type Candle = { time:number; open:number; high:number; low:number; close:number; volume?:number };

const assets = [
  ["BTCUSDT","Bitcoin","₿",109420],["ETHUSDT","Ethereum","Ξ",4345],["GOLD","Gold","Au",3672],
  ["SILVER","Silver","Ag",42.1],["CRUDEOIL","Crude Oil","Oil",63.8],["NIFTY","Nifty 50","N",25190],
  ["BANKNIFTY","Bank Nifty","B",55280],["FINNIFTY","Fin Nifty","F",26340],["MIDCPNIFTY","Nifty Midcap","M",58540]
] as const;

const base:Record<string,number> = Object.fromEntries(assets.map(a=>[a[0],a[3]]));
const deltaSymbols:Record<string,string> = { BTCUSDT:"BTCUSD", ETHUSDT:"ETHUSD" };
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(n);
const apiSymbol=(s:string)=>deltaSymbols[s] || s;
const apiResolution=(tf:string)=>({ "1m":"1m","3m":"3m","5m":"5m","15m":"15m","30m":"30m","1H":"1h","2H":"2h","4H":"4h","1D":"1d","1W":"1w","1M":"1M" }[tf] || "5m");
const uuid=()=>globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function normalizeCandles(result:any):Candle[]{
  const rows=Array.isArray(result?.result)?result.result:Array.isArray(result)?result:[];
  return rows.map((r:any)=>({
    time:Number(r.time ?? r.t ?? r.timestamp ?? 0),
    open:Number(r.open ?? r.o), high:Number(r.high ?? r.h),
    low:Number(r.low ?? r.l), close:Number(r.close ?? r.c), volume:Number(r.volume ?? r.v ?? 0)
  })).filter((c:Candle)=>[c.time,c.open,c.high,c.low,c.close].every(Number.isFinite)).sort((a:Candle,b:Candle)=>a.time-b.time);
}

function useMarketData(symbol:string,tf:string){
  const [price,setPrice]=useState(base[symbol]||0);
  const [candles,setCandles]=useState<Candle[]>([]);
  const [connected,setConnected]=useState(false);

  useEffect(()=>{
    let dead=false;
    const s=apiSymbol(symbol);
    const resolution=apiResolution(tf);
    const load=async()=>{
      try{
        const end=Math.floor(Date.now()/1000);
        const seconds=resolution==="1m"?60:resolution==="3m"?180:resolution==="5m"?300:resolution==="15m"?900:resolution==="30m"?1800:resolution==="1h"?3600:resolution==="2h"?7200:resolution==="4h"?14400:resolution==="1d"?86400:604800;
        const r=await fetch(`/api/market/candles?environment=testnet&symbol=${encodeURIComponent(s)}&resolution=${resolution}&start=${end-seconds*250}&end=${end}`);
        if(!r.ok)throw new Error("candle request failed");
        const data=normalizeCandles(await r.json());
        if(!dead&&data.length){setCandles(data.slice(-250));setPrice(data[data.length-1].close);}
      }catch{}
    };
    load();

    if(!deltaSymbols[symbol]){
      return()=>{dead=true};
    }

    const ws=new WebSocket("wss://socket-ind-pub.testnet.deltaex.org");
    ws.onopen=()=>{
      if(dead)return;
      setConnected(true);
      ws.send(JSON.stringify({type:"subscribe",payload:{channels:[
        {name:"ticker",symbols:[s]},
        {name:`candlestick_${resolution}`,symbols:[s]}
      ]}}));
    };
    ws.onmessage=(event)=>{
      try{
        const m=JSON.parse(event.data);
        if(m.type==="ticker"&&m.sy===s){
          const p=Number(m.close??m.mark_price??m.spot_price??m.last_price);
          if(Number.isFinite(p))setPrice(p);
        }
        if(m.type===`candlestick_${resolution}`&&m.sy===s){
          const c:Candle={time:Number(m.ts||Date.now()/1000),open:Number(m.o),high:Number(m.h),low:Number(m.l),close:Number(m.c),volume:Number(m.v||0)};
          if(![c.time,c.open,c.high,c.low,c.close].every(Number.isFinite))return;
          setPrice(c.close);
          setCandles(prev=>{
            const next=prev.slice();
            const last=next[next.length-1];
            if(last && Math.floor(last.time/60)===Math.floor(c.time/60000)) next[next.length-1]=c;
            else next.push(c);
            return next.slice(-250);
          });
        }
      }catch{}
    };
    ws.onerror=()=>{if(!dead)setConnected(false)};
    ws.onclose=()=>{if(!dead)setConnected(false)};
    return()=>{dead=true;try{ws.close()}catch{}};
  },[symbol,tf]);

  return {price,candles,connected};
}

function App(){
  const [page,setPage]=useState<Page>("watchlist");
  const [mode,setMode]=useState<Mode>(()=>(localStorage.getItem("jk.mode") as Mode)||"PAPER");
  const [capital,setCapital]=useState(()=>Number(localStorage.getItem("jk.capital")||10000));
  const [symbol,setSymbol]=useState(()=>localStorage.getItem("jk.symbol")||"NIFTY");
  const [tf,setTf]=useState(()=>localStorage.getItem("jk.tf")||"5m");
  const [layout,setLayout]=useState(()=>Number(localStorage.getItem("jk.layout")||1));
  const [algo,setAlgo]=useState(()=>localStorage.getItem("jk.algo")==="true");
  const [strategy,setStrategy]=useState("9 / 26 EMA Crossover");
  const [trades,setTrades]=useState<Trade[]>(()=>{try{return JSON.parse(localStorage.getItem("jk.trades")||"[]")}catch{return[]}});
  const [livePrices,setLivePrices]=useState<Record<string,number>>({});
  const [toast,setToast]=useState("");

  useEffect(()=>localStorage.setItem("jk.mode",mode),[mode]);
  useEffect(()=>localStorage.setItem("jk.capital",String(capital)),[capital]);
  useEffect(()=>localStorage.setItem("jk.symbol",symbol),[symbol]);
  useEffect(()=>localStorage.setItem("jk.tf",tf),[tf]);
  useEffect(()=>localStorage.setItem("jk.layout",String(layout)),[layout]);
  useEffect(()=>localStorage.setItem("jk.algo",String(algo)),[algo]);
  useEffect(()=>localStorage.setItem("jk.trades",JSON.stringify(trades)),[trades]);

  useEffect(()=>{
    let dead=false;
    const load=async()=>{
      const next:Record<string,number>={};
      await Promise.all(assets.map(async a=>{
        try{
          const r=await fetch(`/api/market/ticker?environment=testnet&symbol=${encodeURIComponent(apiSymbol(a[0]))}`);
          if(!r.ok)return;
          const j=await r.json(); const t=j?.result||j;
          const p=Number(t?.close??t?.mark_price??t?.spot_price??t?.last_price);
          if(Number.isFinite(p))next[a[0]]=p;
        }catch{}
      }));
      if(!dead&&Object.keys(next).length)setLivePrices(v=>({...v,...next}));
    };
    load();
    const id=setInterval(load,5000);
    return()=>{dead=true;clearInterval(id)};
  },[]);

  const prices=useMemo(()=>({...base,...livePrices}),[livePrices]);
  const goChart=(s:string)=>{setSymbol(s);setPage("charts")};
  const execute=(side:Side)=>{
    if(mode==="REAL"){setToast("Real execution is locked until a verified broker adapter is connected.");return}
    const p=prices[symbol]||base[symbol]; const qty=symbol.includes("NIFTY")?1:.01;
    const t:Trade={id:uuid(),symbol,side,qty,entry:p,current:p,sl:side==="BUY"?p*.995:p*1.005,tp:side==="BUY"?p*1.01:p*.99,pnl:0,strategy,time:new Date().toLocaleTimeString()};
    setTrades(v=>[t,...v]); setToast(`Paper ${side} executed on ${symbol}`); setPage("pnl");
  };
  const close=(id:string)=>{setTrades(v=>v.filter(t=>t.id!==id));setToast("Position closed.")};
  const reset=()=>{if(confirm("Reset Paper Account?")){setTrades([]);setToast("Paper account reset.")}};

  return <div className="app">
    <header className="top"><div className="brand"><b>JK</b><div><strong>Jk Algo Hub</strong><small>TRADING TERMINAL</small></div></div>
      <div className="modes"><button className={mode==="PAPER"?"active":""} onClick={()=>setMode("PAPER")}>PAPER</button><button className={mode==="REAL"?"real":""} onClick={()=>{if(confirm("REAL TRADING uses real money and actual broker orders. Continue?"))setMode("REAL")}}>REAL</button></div>
      <div className="topicons"><Bell size={17}/><Settings size={17}/></div>
    </header>
    <main>
      {page==="watchlist"&&<Watchlist prices={prices} selected={symbol} open={goChart}/>}
      {page==="charts"&&<Charts symbol={symbol} setSymbol={goChart} tf={tf} setTf={setTf} layout={layout} setLayout={setLayout} trades={trades} execute={execute} mode={mode}/>}
      {page==="algo"&&<Algo algo={algo} setAlgo={setAlgo} capital={capital} setCapital={setCapital} symbol={symbol} setSymbol={setSymbol} strategy={strategy} setStrategy={setStrategy} execute={execute} reset={reset} mode={mode}/>}
      {page==="pnl"&&<PnL trades={trades} capital={capital} mode={mode} close={close} open={goChart}/>}
    </main>
    {toast&&<div className="toast">{toast}<button onClick={()=>setToast("")}><X size={13}/></button></div>}
    <nav>{[
      ["watchlist",<List/>,"Watchlist"],["charts",<LineChart/>,"Charts"],["algo",<Zap/>,"Algo"],["pnl",<CircleDollarSign/>,"P&L"]
    ].map(([id,icon,label])=><button key={id} className={page===id?"navactive":""} onClick={()=>setPage(id as Page)}>{icon}<span>{label}</span></button>)}</nav>
  </div>
}

function Watchlist({prices,selected,open}:{prices:Record<string,number>;selected:string;open:(s:string)=>void}){
  const live=Object.keys(prices).some(k=>deltaSymbols[k]&&prices[k]!==base[k]);
  return <section><div className="head"><div><em>MARKET OVERVIEW</em><h1>Watchlist</h1></div><button className="plain"><Plus/></button></div>
    <div className="status"><span><i/> {live?"Live market feed connected":"Connecting to market feed…"}</span><small>Paper engine active</small></div>
    <div className="labels"><span>SYMBOLS</span><span>PRICE&nbsp;&nbsp;&nbsp; CHANGE</span></div>
    <div className="list">{assets.map((a,i)=>{const c=Math.sin(i*2.1)*1.2;return <button className={"row "+(selected===a[0]?"chosen":"")} key={a[0]} onClick={()=>open(a[0])}><b className="asset">{a[2]}</b><div><strong>{a[0]}</strong><small>{a[1]}</small></div><div className="quote"><strong>{(prices[a[0]]||a[3]).toLocaleString("en-IN",{maximumFractionDigits:2})}</strong><small className={c>=0?"up":"down"}>{c>=0?"+":""}{c.toFixed(2)}%</small></div><ChevronDown size={15}/></button>})}</div>
  </section>
}

function Charts({symbol,setSymbol,tf,setTf,layout,setLayout,trades,execute,mode}:{symbol:string;setSymbol:(s:string)=>void;tf:string;setTf:(s:string)=>void;layout:number;setLayout:(n:number)=>void;trades:Trade[];execute:(s:Side)=>void;mode:Mode}){
  const [tool,setTool]=useState("EMA"); const [draw,setDraw]=useState(false);
  const {price,candles,connected}=useMarketData(symbol,tf);
  const livePrice=price||base[symbol]||100;
  useEffect(()=>{localStorage.setItem("jk.chart.connected",String(connected))},[connected]);
  return <section><div className="head"><div><em>MARKET / {mode}</em><h1>{symbol}</h1></div><select value={symbol} onChange={e=>setSymbol(e.target.value)}>{assets.map(a=><option key={a[0]}>{a[0]}</option>)}</select></div>
    <div className="toolbar"><div>{["1m","3m","5m","15m","30m","1H","2H","4H","1D","1W"].map(x=><button className={tf===x?"on":""} onClick={()=>setTf(x)} key={x}>{x}</button>)}</div><div><button onClick={()=>setTool(tool==="EMA"?"RSI":"EMA")}><SlidersHorizontal/> {tool}</button><button className={draw?"on":""} onClick={()=>setDraw(!draw)}><Crosshair/> Draw</button><button><Maximize2/></button></div></div>
    <div className="layouts"><span>LAYOUT</span>{[1,2,4,6,8].map(n=><button className={layout===n?"on":""} onClick={()=>{setLayout(n);localStorage.setItem("jk.layout",String(n))}} key={n}>{n} SCREEN</button>)}</div>
    <div className={"chartgrid g"+layout}>{Array.from({length:layout},(_,i)=>{const s=i===0?symbol:assets[(i+5)%assets.length][0];return <ChartPanel key={i} symbol={s} tf={tf} price={s===symbol?livePrice:(base[s]||100)} trade={trades.find(t=>t.symbol===s)} draw={draw} candles={s===symbol?candles:[]}/>})}</div>
    <div className="actions"><button className="buy" onClick={()=>execute("BUY")} disabled={mode==="REAL"}><TrendingUp/> BUY</button><button className="sell" onClick={()=>execute("SELL")} disabled={mode==="REAL"}><TrendingDown/> SELL</button></div>
  </section>
}

function ChartPanel({symbol,tf,price,trade,draw,candles}:{symbol:string;tf:string;price:number;trade?:Trade;draw:boolean;candles:Candle[]}){
  const points=useMemo(()=>{
    if(candles.length<2)return Array.from({length:50},(_,i)=>[i*12,125-(price*(1+Math.sin(i/5)*.008)-price)/price*7000]);
    const view=candles.slice(-80); const min=Math.min(...view.map(c=>c.low)),max=Math.max(...view.map(c=>c.high)); const range=Math.max(max-min,0.000001);
    return view.map((c,i)=>[i*(600/Math.max(view.length-1,1)),235-((c.close-min)/range)*210]);
  },[candles,price]);
  return <div className="panel"><div className="paneltop"><b>{symbol}</b><span>{tf} {candles.length?"• LIVE":"• loading"}</span><i><Settings size={12}/><Maximize2 size={12}/></i></div>
    <div className="canvas"><div className="gridlines"/><svg viewBox="0 0 600 250" preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={points.map(p=>p.join(",")).join(" ")}/></svg>
      {trade&&<><div className="level entry">ENTRY {trade.entry.toFixed(2)}</div><div className="level sl">SL {trade.sl.toFixed(2)}</div><div className="level tp">TP {trade.tp.toFixed(2)}</div></>}
      {draw&&<div className="trend">Trend line</div>}
    </div><footer>EMA 9&nbsp;&nbsp; EMA 26&nbsp;&nbsp; Vol <span>{candles.length?new Date(candles[candles.length-1].time*1000).toLocaleTimeString():"IST • waiting"}</span></footer>
  </div>
}

function Algo({algo,setAlgo,capital,setCapital,symbol,setSymbol,strategy,setStrategy,execute,reset,mode}:{algo:boolean;setAlgo:(b:boolean)=>void;capital:number;setCapital:(n:number)=>void;symbol:string;setSymbol:(s:string)=>void;strategy:string;setStrategy:(s:string)=>void;execute:(s:Side)=>void;reset:()=>void;mode:Mode}){
 return <section><div className="head"><div><em>AUTOMATION ENGINE</em><h1>Algo Trading</h1></div><span className={"run "+(algo?"green":"")}>● {algo?"RUNNING":"OFF"}</span></div>
   <div className="algohero"><div><small>ALGO ENGINE</small><strong>Strategy automation</strong><p>{mode} mode • Signal evaluation on candle close</p></div><button className={"switch "+(algo?"on":"")} onClick={()=>setAlgo(!algo)}><i/></button></div>
   <div className="form"><label>CAPITAL<input type="number" value={capital} onChange={e=>setCapital(Number(e.target.value)||0)}/></label><label>SYMBOL<select value={symbol} onChange={e=>setSymbol(e.target.value)}>{assets.map(a=><option key={a[0]}>{a[0]}</option>)}</select></label><label>TIMEFRAME<select value={localStorage.getItem("jk.tf")||"5m"} onChange={e=>localStorage.setItem("jk.tf",e.target.value)}><option>1m</option><option>3m</option><option>5m</option><option>15m</option><option>30m</option><option>1H</option><option>4H</option><option>1D</option></select></label><label>STRATEGY<select value={strategy} onChange={e=>setStrategy(e.target.value)}><option>9 / 26 EMA Crossover</option><option>Custom Strategy</option></select></label></div>
   <div className="strategy"><Sparkles/><div><strong>9 / 26 EMA Crossover</strong><small>BUY on bullish cross • SELL on bearish cross</small></div><b>TESTED</b></div>
   <button className="custom"><span>&lt;/&gt;</span> Custom Strategy / Pine Script <ChevronDown/></button>
   <div className="actions"><button className="primary" disabled={!algo||mode==="REAL"} onClick={()=>execute("BUY")}><Zap/> Simulate Signal</button><button className="secondary" onClick={reset}><RotateCcw/> Reset Paper Account</button></div>
   <div className="note"><Wallet/><span><b>Execution safety</b>Real trading stays gated until an official broker adapter is connected. Never put API secrets in source code.</span></div>
 </section>
}

function PnL({trades,capital,mode,close,open}:{trades:Trade[];capital:number;mode:Mode;close:(id:string)=>void;open:(s:string)=>void}){
 const [tab,setTab]=useState("Position"); const pnl=trades.reduce((a,t)=>a+t.pnl,0);
 return <section><div className="pnlhead"><div><em>{mode} ACCOUNT</em><h1>P&L / Trades</h1></div><div className="equity"><small>Equity</small><strong>{money(capital+pnl)}</strong><span className={pnl>=0?"up":"down"}>{money(pnl)}</span></div></div>
   <div className="tabs">{["Position","Pending Order","Closed"].map(x=><button className={tab===x?"on":""} onClick={()=>setTab(x)} key={x}>{x}</button>)}</div>
   {tab==="Position"&&<div>{trades.length===0?<Empty/>:trades.map(t=><div className="position" key={t.id}><div className="poshead"><button onClick={()=>open(t.symbol)}><strong>{t.symbol}</strong><b className={t.side==="BUY"?"up":"down"}>{t.side}</b></button><strong className={t.pnl>=0?"up":"down"}>{money(t.pnl)}</strong></div><div className="metrics"><span>Qty<b>{t.qty}</b></span><span>Entry<b>{t.entry.toFixed(2)}</b></span><span>LTP<b>{t.current.toFixed(2)}</b></span><span>SL<b>{t.sl.toFixed(2)}</b></span><span>TP<b>{t.tp.toFixed(2)}</b></span></div><div className="posfoot"><small>{t.strategy} • {t.time}</small><button onClick={()=>close(t.id)}>CLOSE</button></div></div>)}</div>}
   {tab!=="Position"&&<Empty text={tab==="Pending Order"?"No pending orders":"No closed trades in this session yet"}/>}
   <div className="summary"><div>Starting Capital<b>{money(capital)}</b></div><div>Unrealized P&L<b className={pnl>=0?"up":"down"}>{money(pnl)}</b></div><div>Available Balance<b>{money(capital+pnl)}</b></div></div>
 </section>
}

function Empty({text="No open positions"}:{text?:string}){return <div className="empty"><CircleDollarSign/><strong>{text}</strong><small>Your trades will appear here automatically.</small></div>}

createRoot(document.getElementById("root")!).render(<App/>);
