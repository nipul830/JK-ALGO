import json,os,threading,uuid
from dataclasses import dataclass,asdict
@dataclass
class Position:
    side:str; quantity:float; entry_price:float; stop_loss:float; take_profit:float
class PaperBroker:
    def __init__(self,starting_balance,fee_rate,state_file):
        self.fee_rate=fee_rate; self.state_file=state_file; self.lock=threading.Lock(); self.balance=starting_balance; self.position=None; self.realized_pnl=0.0; self.trades=[]; self._load()
    def _load(self):
        if not os.path.exists(self.state_file): return
        try:
            with open(self.state_file,encoding="utf-8") as f: s=json.load(f)
            self.balance=float(s.get("balance",self.balance)); p=s.get("position"); self.position=Position(**p) if p else None; self.realized_pnl=float(s.get("realized_pnl",0)); self.trades=s.get("trades",[])
        except (OSError,ValueError,TypeError): pass
    def _save(self):
        tmp=self.state_file+".tmp"; s={"balance":self.balance,"position":asdict(self.position) if self.position else None,"realized_pnl":self.realized_pnl,"trades":self.trades[-500:]}
        with open(tmp,"w",encoding="utf-8") as f: json.dump(s,f,indent=2)
        os.replace(tmp,self.state_file)
    def mark_to_market(self,price):
        if not self.position:return 0.0
        return (1 if self.position.side=="buy" else -1)*(price-self.position.entry_price)*self.position.quantity
    def equity(self,price): return self.balance+self.mark_to_market(price)
    def open(self,side,quantity,price,stop_loss,take_profit):
        with self.lock:
            if self.position or quantity<=0 or price<=0:return None
            fee=quantity*price*self.fee_rate
            if fee>self.balance:return None
            self.balance-=fee; self.position=Position(side,quantity,price,stop_loss,take_profit)
            t={"id":str(uuid.uuid4()),"action":"open","side":side,"quantity":quantity,"price":price,"fee":fee}; self.trades.append(t); self._save(); return t
    def close(self,price,reason="signal"):
        with self.lock:
            if not self.position or price<=0:return None
            p=self.position; pnl=(price-p.entry_price)*p.quantity*(1 if p.side=="buy" else -1); fee=price*p.quantity*self.fee_rate
            self.balance+=pnl-fee; self.realized_pnl+=pnl-fee; self.position=None
            t={"id":str(uuid.uuid4()),"action":"close","side":p.side,"quantity":p.quantity,"price":price,"pnl":pnl-fee,"reason":reason,"fee":fee}; self.trades.append(t); self._save(); return t
    def check_exits(self,price):
        if not self.position:return None
        p=self.position
        if p.side=="buy" and price<=p.stop_loss:return self.close(price,"stop_loss")
        if p.side=="buy" and price>=p.take_profit:return self.close(price,"take_profit")
        if p.side=="sell" and price>=p.stop_loss:return self.close(price,"stop_loss")
        if p.side=="sell" and price<=p.take_profit:return self.close(price,"take_profit")
        return None
