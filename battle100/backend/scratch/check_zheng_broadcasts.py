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
        print("--- 查询郑雨婷 (User ID = 2083) 的所有播报数据 ---")
        stmt = select(BroadcastEvent).where(BroadcastEvent.user_id == 2083).order_by(BroadcastEvent.id.desc())
        res = await db.execute(stmt)
        events = res.scalars().all()
        print(f"找到 {len(events)} 条记录:")
        for ev in events:
            # 获取 team 名字
            t_name = "None"
            if ev.team_id:
                t_stmt = select(Team).where(Team.id == ev.team_id)
                t_res = await db.execute(t_stmt)
                team = t_res.scalar_one_or_none()
                t_name = team.name if team else "未知"
            print(f"ID: {ev.id}, team_id: {ev.team_id} ({t_name}), created_at: {ev.created_at}, content: {ev.content[:80]}...")

        print("\n--- 查询包含 '清新区土地中心' 的播报详情 ---")
        stmt_center = select(BroadcastEvent).where(BroadcastEvent.content.like("%清新区土地中心%"))
        res_center = await db.execute(stmt_center)
        events_center = res_center.scalars().all()
        for ev in events_center:
            print(f"ID: {ev.id}, user_id: {ev.user_id}, team_id: {ev.team_id}, content: {ev.content[:80]}...")

if __name__ == "__main__":
    asyncio.run(main())
