# -*- coding: utf-8 -*-
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.organization import Team
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.name == "郑雨婷")
        res = await db.execute(stmt)
        users = res.scalars().all()
        print("--- 数据库中所有叫 '郑雨婷' 的用户 ---")
        for u in users:
            t_name = "None"
            if u.team_id:
                t_stmt = select(Team).where(Team.id == u.team_id)
                t_res = await db.execute(t_stmt)
                team = t_res.scalar_one_or_none()
                t_name = team.name if team else "未知"
            print(f"ID: {u.id}, 电话: {u.phone}, team_id: {u.team_id} ({t_name}), position: {u.position}")

if __name__ == "__main__":
    asyncio.run(main())
