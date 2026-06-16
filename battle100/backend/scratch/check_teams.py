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
        print("--- 数据库中的战队列表 ---")
        for t in teams:
            print(f"ID: {t.id}, 名称: {t.name}")

if __name__ == "__main__":
    asyncio.run(main())
