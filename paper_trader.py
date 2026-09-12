from dataclasses import dataclass
from typing import Optional

@dataclass
class Position:
    side: str
    entry: float
    quantity: float = 1.0

class PaperTrader:
    def __init__(self, starting_balance: float = 1000.0):
        self.balance = starting_balance
        self.position: Optional[Position] = None
        self.realized_pnl = 0.0

    def on_signal(self, action: str, price: float):
        if action not in ("LONG", "SHORT"):
            return
        if self.position is None:
            self.position = Position(action, price)
            return
        if self.position.side != action:
            self.close(price)
            self.position = Position(action, price)

    def close(self, price: float):
        if not self.position:
            return 0.0
        p = (price - self.position.entry) * self.position.quantity
        if self.position.side == "SHORT":
            p = -p
        self.realized_pnl += p
        self.balance += p
        self.position = None
        return p

    def unrealized_pnl(self, price: float) -> float:
        if not self.position:
            return 0.0
        p = (price - self.position.entry) * self.position.quantity
        return -p if self.position.side == "SHORT" else p
