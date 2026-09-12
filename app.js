const $=id=>document.getElementById(id);
const canvas=$("chart"),ctx=canvas.getContext("2d");
const API="https://api.india.delta.exchange",WS="wss://public-socket.india.delta.exchange";
const FAST=9,SLOW=26,SL=.01,TP=.01,RISK=.005,FEE=.0005,HISTORY=200;
let ws=null,reconnectTimer=null,candles=[],current=null,algo=true;
let state=JSON.parse(localStorage.getItem("jk_algo_state")||"null")||{balance:10000,realized:0,position:null,trades:[]};
function save(){localStorage.setItem("jk_algo_state",JSON.stringify(state))}
function fmt(n){return "$"+Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function ema(a,p){if(!a.length)return[];const k=2/(p+1);let v=a[0];return a.map((x,i)=>i?(v=x*k+v*(1-k),v):v)}
function resolution(){return $("timeframe").value}
function normalize(x){return{t:Number(x.time??x.ts),o:+(x.open??x.o),h:+(x.high??x.h),l:+(x.low??x.l),c:+(x.close??x.c),v:+(x.volume??x.v??0)}}
function status(live,text){$("dot").classList.toggle("live",live);$("connection").textContent=text||"Reconnecting…"}
async function loadHistory(){
 const sym=$("symbol").value,res=resolution(),end=Math.floor(Date.now()/1000),secs={1m:60,3m:180,5m:300,15m:900,30m:1800,1h:3600}[res]||300,start=end-secs*HISTORY;
 const r=await fetch(API+"/v2/history/candles?resolution="+encodeURIComponent(res)+"&symbol="+encodeURIComponent(sym)+"&start="+start+"&end="+end,{headers:{Accept:"application/json"}});
 if(!r.ok)throw Error("History HTTP "+r.status);const j=await r.json();
 candles=(j.result||[]).map(normalize).filter(x=>Number.isFinite(x.c)).sort((a,b)=>a.t-b.t).slice(-HISTORY);current=candles.at(-1)||null;
 if(current)$("price").textContent=fmt(current.c);draw();render();
}
function connect(){
 if(ws){try{ws.close()}catch{}}clearTimeout(reconnectTimer);status(false);
 const sym=$("symbol").value,res=resolution();ws=new WebSocket(WS);
 ws.onopen=()=>{status(true,"LIVE MARKET");ws.send(JSON.stringify({type:"subscribe",payload:{channels:[{name:"candlestick_"+res,symbols:[sym]},{name:"ticker",symbols:[sym]}]}}))};
 ws.onmessage=e=>{try{const m=JSON.parse(e.data);
  if(m.type==="ticker"&&m.sy===sym){const p=+(m.p??m.mark_price??m.close);if(p){current={...(current||{}),c:p};$("price").textContent=fmt(p);mark(p);draw()}return}
  if(m.type!=="candlestick_"+res||m.sy!==sym)return;const c=normalize(m),last=candles.at(-1);
  if(last&&last.t===c.t)candles[candles.length-1]=c;else{if(last&&c.t>last.t)closed(last);candles.push(c);candles=candles.slice(-HISTORY)}
  current=c;$("price").textContent=fmt(c.c);mark(c.c);draw();
 }catch(err){console.warn(err)}};
 ws.onerror=()=>status(false,"Market feed error");ws.onclose=()=>{status(false);reconnectTimer=setTimeout(connect,2500)}
}
function closed(c){
 if(!algo||state.position||candles.length<SLOW+2)return;
 const a=candles.slice(0,-1).map(x=>x.c),f=ema(a,FAST),s=ema(a,SLOW),pf=f.at(-2),ps=s.at(-2),nf=f.at(-1),ns=s.at(-1);
 let side=null;if(pf<=ps&&nf>ns)side="BUY";else if(pf>=ps&&nf<ns)side="SELL";$("signal").textContent=side?side+" SIGNAL":"WAIT";if(side)open(side,c.c);
}
function open(side,price){
 const qty=(state.balance*RISK)/(price*SL),fee=qty*price*FEE;if(!Number.isFinite(qty)||fee>=state.balance)return;
 state.balance-=fee;state.position={side,qty,entry:price,sl:side==="BUY"?price*(1-SL):price*(1+SL),tp:side==="BUY"?price*(1+TP):price*(1-TP),entryFee:fee};save();$("signal").textContent=side+" • PAPER";render();
}
function close(price,reason){
 const p=state.position;if(!p)return;const pnl=(price-p.entry)*p.qty*(p.side==="BUY"?1:-1)-price*p.qty*FEE;
 state.balance+=pnl;state.realized+=pnl;state.trades.push({time:new Date().toLocaleString(),side:p.side,qty:p.qty,price,pnl,reason});state.trades=state.trades.slice(-100);state.position=null;save();$("signal").textContent="WAIT";render();
}
function mark(price){
 if(!state.position){$("equity").textContent=fmt(state.balance);return}
 const p=state.position,unreal=(price-p.entry)*p.qty*(p.side==="BUY"?1:-1);$("equity").textContent=fmt(state.balance+unreal);
 const stop=p.side==="BUY"&&price<=p.sl||p.side==="SELL"&&price>=p.sl,target=p.side==="BUY"&&price>=p.tp||p.side==="SELL"&&price<=p.tp;
 if(stop||target)close(price,stop?"STOP":"TARGET");else renderPosition();
}
function renderPosition(){const p=state.position;if(!p)return;$("position").textContent=p.side;$("empty").classList.add("hidden");$("pos").classList.remove("hidden");$("pos").innerHTML=[["Side",p.side],["Qty",p.qty.toFixed(6)],["Entry",fmt(p.entry)],["SL / TP",fmt(p.sl)+" / "+fmt(p.tp)]].map(x=>"<div><span>"+x[0]+"</span><b>"+x[1]+"</b></div>").join("")}
function render(){
 $("balance").textContent=fmt(state.balance);$("pnl").textContent=fmt(state.realized);$("pnl").className=state.realized>=0?"buy":"sell";
 if(state.position)renderPosition();else{$("position").textContent="NONE";$("empty").classList.remove("hidden");$("pos").classList.add("hidden");$("equity").textContent=fmt(state.balance)}
 $("history").innerHTML=state.trades.slice().reverse().map(t=>"<tr><td>"+t.time+"</td><td class='"+t.side.toLowerCase()+"'>"+t.side+"</td><td>"+t.qty.toFixed(6)+"</td><td>"+fmt(t.price)+"</td><td class='"+(t.pnl>=0?"buy":"sell")+"'>"+fmt(t.pnl)+"</td><td>"+t.reason+"</td></tr>").join("");
}
function draw(){
 const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;if(!r.width||!r.height)return;canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);
 const w=r.width,h=r.height;ctx.clearRect(0,0,w,h);if(candles.length<2)return;const pad={l:8,r:8,t:10,b:18},min=Math.min(...candles.map(x=>x.l)),max=Math.max(...candles.map(x=>x.h)),range=max-min||1,pw=w-pad.l-pad.r,ph=h-pad.t-pad.b,step=pw/candles.length,body=Math.max(2,step*.62),x=i=>pad.l+i*step+step/2,y=v=>pad.t+(max-v)/range*ph;
 ctx.strokeStyle="#1b2633";ctx.lineWidth=1;for(let i=0;i<5;i++){let yy=pad.t+i*ph/4;ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke()}
 candles.forEach((c,i)=>{let xx=x(i),up=c.c>=c.o;ctx.strokeStyle=up?"#20d39b":"#ff6573";ctx.beginPath();ctx.moveTo(xx,y(c.h));ctx.lineTo(xx,y(c.l));ctx.stroke();ctx.fillStyle=ctx.strokeStyle;let top=y(Math.max(c.o,c.c)),bh=Math.max(2,Math.abs(y(c.o)-y(c.c)));ctx.fillRect(xx-body/2,top,body,bh)});
 const prices=candles.map(x=>x.c);[[ema(prices,FAST),"#f5a623"],[ema(prices,SLOW),"#4c9cff"]].forEach(([a,col])=>{ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.beginPath();a.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));ctx.stroke()});
}
$("algo").onclick=()=>{algo=!algo;$("algo").textContent=algo?"ALGO ON":"ALGO OFF";$("algo").classList.toggle("off",!algo);save()};
$("symbol").onchange=async()=>{try{await loadHistory();connect()}catch(e){status(false,"History unavailable");console.error(e)}};
$("timeframe").onchange=async()=>{try{await loadHistory();connect()}catch(e){status(false,"History unavailable");console.error(e)}};
$("reset").onclick=()=>{if(confirm("Reset paper account to $10,000 and clear trades?")){state={balance:10000,realized:0,position:null,trades:[]};save();render()}};
window.addEventListener("resize",draw);
(async()=>{render();try{await loadHistory();connect()}catch(e){status(false,"Market data unavailable");console.error(e);setTimeout(connect,3000)}})();