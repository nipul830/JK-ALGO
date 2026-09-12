import json,logging,time
from dataclasses import dataclass
from typing import Callable
import requests,websocket
@dataclass
class Candle:
    timestamp:int; open:float; high:float; low:float; close:float; volume:float=0.0
class DeltaPublicMarket:
    def __init__(self,symbol,timeframe,ws_url,rest_url,on_candle:Callable[[Candle],None]):
        self.symbol,self.timeframe,self.ws_url=symbol,timeframe,ws_url; self.rest_url=rest_url.rstrip("/"); self.on_candle=on_candle; self.log=logging.getLogger("market"); self.stop_flag=False; self.ws=None
    def history(self,limit=200):
        seconds={"1m":60,"3m":180,"5m":300,"15m":900,"30m":1800,"1h":3600,"2h":7200,"4h":14400,"6h":21600,"12h":43200,"1d":86400,"1w":604800}[self.timeframe]
        end=int(time.time()); start=end-seconds*(limit+5)
        r=requests.get(f"{self.rest_url}/v2/history/candles",params={"resolution":self.timeframe,"symbol":self.symbol,"start":start,"end":end},headers={"Accept":"application/json"},timeout=15); r.raise_for_status()
        rows=r.json().get("result",[]); out=[]
        for x in rows[-limit:]: out.append(Candle(int(x.get("time",x.get("timestamp",0))),float(x["open"]),float(x["high"]),float(x["low"]),float(x["close"]),float(x.get("volume",0) or 0)))
        return out
    def _message(self,_ws,raw):
        try:
            m=json.loads(raw)
            if m.get("type")!=f"candlestick_{self.timeframe}": return
            self.on_candle(Candle(int(m["ts"]),float(m["o"]),float(m["h"]),float(m["l"]),float(m["c"]),float(m.get("v",0) or 0)))
        except Exception: self.log.exception("Invalid market message")
    def _open(self,ws):
        self.log.info("Connected to Delta public market websocket")
        ws.send(json.dumps({"type":"subscribe","payload":{"channels":[{"name":f"candlestick_{self.timeframe}","symbols":[self.symbol]}]}}))
    def _error(self,_ws,error): self.log.error("Websocket error: %s",error)
    def _close(self,_ws,status,msg): self.log.warning("Websocket closed: %s %s",status,msg)
    def run_forever(self):
        delay=2
        while not self.stop_flag:
            try:
                self.ws=websocket.WebSocketApp(self.ws_url,on_open=self._open,on_message=self._message,on_error=self._error,on_close=self._close)
                self.ws.run_forever(ping_interval=30,ping_timeout=10)
            except Exception: self.log.exception("Market websocket crashed")
            if not self.stop_flag: time.sleep(delay); delay=min(delay*2,30)
    def stop(self):
        self.stop_flag=True
        if self.ws: self.ws.close()
