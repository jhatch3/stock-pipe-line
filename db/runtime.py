from functools import lru_cache
from db.commander import Commander

@lru_cache(maxsize=1)
def get_commander() -> Commander:
    return Commander()