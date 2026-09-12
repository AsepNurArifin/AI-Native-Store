"""Electronic spec filtering shared by owner API and SalesAgent tools."""
import pytest
import pytest_asyncio
from pydantic import ValidationError

from app.ai.tools import ToolExecutor
from app.core.security import hash_password
from app.models import InventoryTransaction, Product, User
from app.services.product_service import ProductService


@pytest_asyncio.fixture
async def electronics(db):
    rows = [
        ("Laptop kosong", 1_000_000, {"ram_gb": 16, "storage_gb": 1000}, 0, "ACTIVE"),
        ("Laptop hemat", 6_000_000, {"ram_gb": 8, "storage_gb": 512}, 4, "ACTIVE"),
        ("IdeaPad Slim 5", 10_499_000, {"brand": "Lenovo", "ram_gb": 16, "storage_gb": 512, "prosesor": "Intel Core i5-13500H", "gpu": "Intel Iris Xe"}, 3, "ACTIVE"),
        ("Swift Go 14", 11_499_000, {"brand": "Acer", "ram_gb": 16, "storage_gb": 512, "prosesor": "AMD Ryzen 7 7730U"}, 2, "ACTIVE"),
        ("ROG G14", 24_999_000, {"brand": "ASUS", "ram_gb": 16, "storage_gb": 1000, "prosesor": "AMD Ryzen 9", "gpu": "RTX 4060 8GB"}, 1, "ACTIVE"),
        ("Nonaktif", 2_000_000, {"ram_gb": 32, "storage_gb": 1000}, 4, "INACTIVE"),
        ("Belum diketahui", 2_500_000, {}, 5, "ACTIVE"),
        ("Data lama", 3_000_000, {"ram_gb": "unknown", "storage_gb": "SSD 512GB"}, 5, "ACTIVE"),
        ("Tipe JSON lain", 3_100_000, {"ram_gb": [16], "storage_gb": {"GB": 512}}, 5, "ACTIVE"),
    ]
    result = {}
    for name, price, spec, stock, status in rows:
        p = Product(name=name, category="Laptop", price=price, specification=spec, status=status)
        db.add(p)
        await db.flush()
        if stock:
            db.add(InventoryTransaction(product_id=p.id, type="IN", movement="IN", quantity=stock, reference_type="MANUAL"))
        result[name] = p
    await db.commit()
    return result


@pytest.mark.asyncio
async def test_minimum_specs_budget_and_stock_before_limit(db, electronics):
    params = dict(category="laptop", ram_min_gb=16, storage_min_gb=512, budget_max=12_000_000, stock_only=True)
    products = await ProductService.search(db, **params, limit=1)
    assert [p.name for p in products] == ["IdeaPad Slim 5"]
    tool = await ToolExecutor(db).search_products(**params)
    assert [p["name"] for p in tool["items"]] == ["IdeaPad Slim 5", "Swift Go 14"]
    assert tool["items"][0]["specification"]["ram_gb"] == 16
    assert tool["items"][0]["current_stock"] == 3
    # No relaxing constraints to return something when nothing matches.
    assert await ProductService.search(db, ram_min_gb=64, stock_only=True) == []


@pytest.mark.asyncio
@pytest.mark.parametrize("filters,expected", [
    ({"query": "laptop RAM 16GB", "budget_max": 12_000_000}, ["IdeaPad Slim 5", "Swift Go 14"]),
    ({"query": "ryzen 7"}, ["Swift Go 14"]),
    ({"query": "laptop SSD 1TB"}, ["ROG G14"]),
    ({"processor": "Ryzen", "gpu": "RTX 4060", "storage_min_gb": 1000}, ["ROG G14"]),
    ({"brand": "lenovo", "budget_min": 10_000_000}, ["IdeaPad Slim 5"]),
    ({"query": "%"}, []),
    ({"query": "nonexistent_model"}, []),
])
async def test_keyword_and_structured_spec_filters(db, electronics, filters, expected):
    result = await ProductService.search(db, stock_only=True, **filters)
    assert [p.name for p in result] == expected


@pytest.mark.asyncio
async def test_invalid_filters_are_recoverable_tool_errors(db, electronics):
    for filters in ({"ram_min_gb": -1}, {"budget_min": 10, "budget_max": 5}, {"budget_max": float("nan")}, {"query": "RAM 999999GB"}):
        with pytest.raises(ValidationError):
            await ProductService.search(db, **filters)
        result = await ToolExecutor(db).search_products(**filters)
        assert "error" in result and "items" not in result


@pytest.mark.asyncio
async def test_owner_api_spec_filters_and_validation(client, db, electronics):
    db.add(User(name="Owner", email="specs@test.dev", password_hash=hash_password("testpass"), role="OWNER"))
    await db.commit()
    login = await client.post("/api/v1/auth/login", json={"email": "specs@test.dev", "password": "testpass"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = await client.get("/api/v1/products", headers=headers, params={"ram_min_gb": 16, "budget_max": 12_000_000, "stock_only": True})
    assert response.status_code == 200, response.text
    assert [p["name"] for p in response.json()] == ["IdeaPad Slim 5", "Swift Go 14"]
    for params in ({"ram_min_gb": 0}, {"budget_min": 10, "budget_max": 5}):
        bad = await client.get("/api/v1/products", headers=headers, params=params)
        assert bad.status_code == 422, bad.text
