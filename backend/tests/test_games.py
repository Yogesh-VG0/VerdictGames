from unittest.mock import patch

@patch("app.core.redis.get_cached_response")
def test_read_games_empty(mock_cache, client):
    # Mock cache miss
    mock_cache.return_value = None
    
    response = client.get("/api/v1/games/")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert len(data["items"]) == 0
