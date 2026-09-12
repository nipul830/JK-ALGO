// Delta public market feed. No API key is needed for public market data.
export function connectDelta(symbol, onPrice, onCandle) {
  const ws = new WebSocket("wss://public-socket.india.delta.exchange");
  ws.onopen = () => ws.send(JSON.stringify({type:"subscribe",payload:{channels:[
    {name:"ticker",symbols:[symbol]},
    {name:"candlestick_1m",symbols:[symbol]}
  ]}}));
  ws.onmessage = e => {
    try {
      const m=JSON.parse(e.data);
      if(m.type==="ticker" && m.sy===symbol && m.p!=null) onPrice(Number(m.p));
      if(m.type==="candlestick_1m" && m.sy===symbol && m.c!=null) onCandle(m);
    } catch {}
  };
  ws.onclose = () => setTimeout(()=>connectDelta(symbol,onPrice,onCandle),3000);
  return ws;
}
