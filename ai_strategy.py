"""Safe AI strategy contract.

The AI layer should return JSON/rules matching this small schema. It must never
return executable Python/JavaScript or arbitrary shell commands.
"""

ALLOWED_ACTIONS = {"LONG", "SHORT", "CLOSE"}
ALLOWED_INDICATORS = {"EMA", "SMA", "RSI"}

def validate_strategy(strategy: dict) -> dict:
    if not isinstance(strategy, dict):
        raise ValueError("Strategy must be an object")
    if not isinstance(strategy.get("name"), str):
        raise ValueError("Missing strategy name")
    rules = strategy.get("rules")
    if not isinstance(rules, list) or not rules:
        raise ValueError("Strategy needs rules")
    for rule in rules:
        if rule.get("action") not in ALLOWED_ACTIONS:
            raise ValueError("Unsupported action")
        if rule.get("indicator") not in ALLOWED_INDICATORS:
            raise ValueError("Unsupported indicator")
    return strategy
