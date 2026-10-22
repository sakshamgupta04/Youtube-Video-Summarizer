"""Tests for the embedding module and /embed FastAPI endpoint."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)


def test_embed_endpoint_unauthorized():
    response = client.post("/embed", json={"text": "hello world"})
    assert response.status_code == 401
    assert "detail" in response.json()


def test_embed_endpoint_wrong_secret():
    response = client.post(
        "/embed",
        json={"text": "hello world"},
        headers={"X-Worker-Secret": "wrong-secret"},
    )
    assert response.status_code == 401


def test_embed_endpoint_bad_request():
    response = client.post(
        "/embed",
        json={},
        headers={"X-Worker-Secret": settings.worker_secret},
    )
    assert response.status_code == 400


def test_embed_endpoint_success():
    response = client.post(
        "/embed",
        json={"text": "semantic search test query"},
        headers={"X-Worker-Secret": settings.worker_secret},
    )
    assert response.status_code == 200
    data = response.json()
    assert "embedding" in data
    assert isinstance(data["embedding"], list)
    assert len(data["embedding"]) == 384
    # Check normalized vector
    vec_sum_sq = sum(x * x for x in data["embedding"])
    assert 0.98 <= vec_sum_sq <= 1.02
