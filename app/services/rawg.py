import os
import httpx
from urllib.parse import urlencode

RAWG_API_KEY = os.getenv("RAWG_API_KEY", "")
BASE_URL = "https://api.rawg.io/api"

async def fetch_trending_games(page: int = 1, page_size: int = 20):
    """
    Fetch trending or popular games from RAWG API.
    """
    if not RAWG_API_KEY:
        print("RAWG API Key missing")
        return []
        
    query = {
        "key": RAWG_API_KEY,
        "page": page,
        "page_size": page_size,
        "ordering": "-added"
    }
    url = f"{BASE_URL}/games?{urlencode(query)}"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json().get("results", [])

async def fetch_game_details(rawg_id: int):
    """
    Fetch comprehensive metadata for a specific RAWG game ID.
    """
    if not RAWG_API_KEY:
        return None
        
    url = f"{BASE_URL}/games/{rawg_id}?key={RAWG_API_KEY}"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        if response.status_code == 200:
            return response.json()
        return None
