import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from app.models.organization import Team
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Team.id, Team.name))
        rows = res.all()
        
    output = []
    for r in rows:
        output.append(f"ID: {r[0]}, Name: {r[1]}")
        
    file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "teams_utf8.txt"))
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(output))
    print("写入成功")

if __name__ == "__main__":
    asyncio.run(main())
