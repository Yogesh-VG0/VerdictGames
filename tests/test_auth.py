def test_read_main(client):
    response = client.get("/api/v1/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to Verdict.Games API"}

def test_register_user(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "test@test.com", "username": "testuser", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@test.com"
    assert "id" in data

def test_login_user(client):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "testuser", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
