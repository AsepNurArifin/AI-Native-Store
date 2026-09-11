"""P4.3 — endpoint health diekspos di root dan di bawah prefix /api/v1."""

from httpx import AsyncClient


async def test_health_root_ok(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["db"] == "ok"
    # tidak membocorkan secret apapun
    assert "key" not in str(body).lower()
    assert "token" not in str(body).lower()


async def test_health_api_prefix_ok(client: AsyncClient):
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert resp.json()["db"] == "ok"
