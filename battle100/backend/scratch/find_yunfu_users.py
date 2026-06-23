import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.organization import Team
from app.models.user import User
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        # 1. 查找云浮战队的 Team ID
        stmt = select(Team).where(Team.name == "云浮战队")
        res = await db.execute(stmt)
        team = res.scalar_one_or_none()
        if not team:
            print("❌ 未找到云浮战队！")
            return
        
        print(f"云浮战队 ID: {team.id}")
        
        # 2. 查找该战队下的所有用户
        stmt2 = select(User).where(User.team_id == team.id)
        res2 = await db.execute(stmt2)
        users = res2.scalars().all()
        
        print(f"--- 云浮战队成员列表 (共 {len(users)} 人) ---")
        for u in users:
            print(f"ID: {u.id}, 姓名: {u.name}, 电话: {u.phone}, 岗位: {u.position}, 岗位类型: {u.position_type}, 钉钉ID: {u.dingtalk_id}")

if __name__ == "__main__":
    asyncio.run(main())
