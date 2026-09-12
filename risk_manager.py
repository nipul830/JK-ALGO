class RiskManager:
    def __init__(self,capital,risk_per_trade,stop_loss_pct,take_profit_pct,max_position_pct=1.0):
        self.capital=capital; self.risk_per_trade=risk_per_trade; self.stop_loss_pct=stop_loss_pct; self.take_profit_pct=take_profit_pct; self.max_position_pct=max_position_pct
    def quantity(self,entry):
        if entry<=0:return 0.0
        by_risk=(self.capital*self.risk_per_trade)/(entry*self.stop_loss_pct) if self.stop_loss_pct else 0.0
        by_notional=(self.capital*self.max_position_pct)/entry
        return max(0.0,min(by_risk,by_notional))
    def levels(self,entry,side):
        if side=="buy": return entry*(1-self.stop_loss_pct),entry*(1+self.take_profit_pct)
        return entry*(1+self.stop_loss_pct),entry*(1-self.take_profit_pct)
