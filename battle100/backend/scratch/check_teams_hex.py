# -*- coding: utf-8 -*-
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.organization import Team
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        stmt = select(Team)
        res = await db.execute(stmt)
        teams = res.scalars().all()
        print("--- 战队映射 ---")
        for t in teams:
            # 使用 repr 和直接打印，方便核对
            print(f"ID: {t.id}, Hex: {t.name.encode('utf-8').hex()}")

if __name__ == "__main__":
    asyncio.run(main())
