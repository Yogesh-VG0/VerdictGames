import httpx
from bs4 import BeautifulSoup

def _get_headers():
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    }

async def fetch_playstore_metadata(package_id: str):
    """
    Scrape Google Play Store using BeautifulSoup.
    Warning: This is subject to rate limiting by Google. Only scrape in background jobs with delays.
    Use rotating proxies for production if necessary.
    """
    url = f"https://play.google.com/store/apps/details?id={package_id}&hl=en&gl=US"
    
    async with httpx.AsyncClient(headers=_get_headers(), follow_redirects=True) as client:
        try:
            response = await client.get(url, timeout=10.0)
            if response.status_code != 200:
                return None
                
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Extract title (this can change depending on Google's layout)
            title_elem = soup.find("h1", {"itemprop": "name"})
            title = title_elem.text if title_elem else None
            
            # Extract Developer
            dev_elem = soup.find("div", text="Developer")
            developer = dev_elem.find_next("span").text if dev_elem else None
            
            return {
                "package": package_id,
                "title": title,
                "developer": developer,
                # Add more fields structurally mapped
            }
        except Exception as e:
            print(f"Error scraping PlayStore for {package_id}: {e}")
            return None
