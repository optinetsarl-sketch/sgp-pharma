import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / "backend" / ".env")
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    print("Base active :", db.name)
    
    pipeline = [
        {"$match": {"status": "active", "current_quantity": {"$gt": 0}}},
        {"$group": {"_id": "$product_id", "total": {"$sum": "$current_quantity"}}}
    ]
    stock_map = {doc["_id"]: doc["total"] async for doc in db.batches.aggregate(pipeline)}
    print(f"Produits avec stock > 0 : {len(stock_map)}")
    
    prods = await db.products.find({}, {"_id": 0, "id": 1, "nom_commercial": 1, "prix_vente": 1}).to_list(5)
    print("\nExemples de produits dans le catalogue :")
    for p in prods:
        qty = stock_map.get(p["id"], 0)
        print(f"  • {p['nom_commercial']} ({p['prix_vente']} FCFA) => Stock en rayon : {qty}")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
