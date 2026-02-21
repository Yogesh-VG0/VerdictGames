import httpx
import re

async def search_steam_game(title: str):
    """
    Search Steam Store API by title to find appid.
    Note: Steam doesn't have a perfect title search API for backend usage.
    Often people use the steam store search HTML and scrape the first result,
    or use the raw API endpoint if possible.
    """
    url = f"https://store.steampowered.com/api/storesearch/?term={title}&l=english&cc=US"
    async with httpx.AsyncClient(headers={"User-Agent": "VerdictGames/1.0"}) as client:
        response = await client.get(url)
        if response.status_code == 200:
            data = response.json()
            if data.get("total", 0) > 0:
                # Return the first appid match
                # Add basic fuzzy matching confidence later
                return data["items"][0]
    return None

async def fetch_steam_app_details(appid: str):
    """
    Fetch full steam details using app details API.
    """
    url = f"https://store.steampowered.com/api/appdetails?appids={appid}"
    async with httpx.AsyncClient(headers={"User-Agent": "VerdictGames/1.0"}) as client:
        response = await client.get(url)
        if response.status_code == 200:
            data = response.json()
            if data and data.get(appid, {}).get("success"):
                return data[appid]["data"]
    return None
