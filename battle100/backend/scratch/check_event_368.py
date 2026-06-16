# -*- coding: utf-8 -*-
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent
from app.models.user import User
from app.models.organization import Team
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        print("--- 查询 BroadcastEvent ID = 368 详细信息 ---")
        stmt = select(BroadcastEvent).where(BroadcastEvent.id == 368)
        res = await db.execute(stmt)
        event = res.scalar_one_or_none()
        
        if event:
            print(f"找到播报 ID: {event.id}")
            print(f"event_type: {event.event_type}")
            print(f"content: {event.content}")
            print(f"user_id: {event.user_id}")
            print(f"team_id: {event.team_id}")
            print(f"is_deleted: {event.is_deleted}")
            
            # 查一下发布用户 肖素芬 (ID 2076)
            print("\n--- 查询操作人 肖素芬 (ID 2076) 详情 ---")
            user_stmt = select(User).where(User.id == 2076)
            user_res = await db.execute(user_stmt)
            user = user_res.scalar_one_or_none()
            if user:
                print(f"操作人姓名: {user.name}")
                print(f"操作人 team_id: {user.team_id}")
                if user.team_id:
                    team_stmt = select(Team).where(Team.id == user.team_id)
                    team_res = await db.execute(team_stmt)
                    team = team_res.scalar_one_or_none()
                    if team:
                        print(f"操作人所属战队: {team.name}")
            else:
                print("未找到 ID 2076 的用户！")
                
            # 查一下播报关联的 user 和 team
            if event.user_id:
                u_stmt = select(User).where(User.id == event.user_id)
                u_res = await db.execute(u_stmt)
                u = u_res.scalar_one_or_none()
                if u:
                    print(f"播报关联用户: {u.name}, team_id: {u.team_id}")
                    
            if event.team_id:
                t_stmt = select(Team).where(Team.id == event.team_id)
                t_res = await db.execute(t_stmt)
                t = t_res.scalar_one_or_none()
                if t:
                    print(f"播报关联战队: {t.name}")
        else:
            print("未找到 ID = 368 的播报！")

if __name__ == "__main__":
    asyncio.run(main())
