# -*- coding: utf-8 -*-
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        print("--- 查询 BroadcastEvent ID = 358 ---")
        stmt = select(BroadcastEvent).where(BroadcastEvent.id == 358)
        res = await db.execute(stmt)
        event = res.scalar_one_or_none()
        
        if event:
            print(f"找到记录 ID: {event.id}")
            print(f"event_type: {event.event_type}")
            print(f"content: {event.content}")
            print(f"push_status: {event.push_status}")
            print(f"is_deleted: {event.is_deleted}")
            print(f"created_at: {event.created_at}")
            print(f"updated_at: {event.updated_at}")
        else:
            print("在 broadcast_events 表中【未找到】 ID = 358 的记录！")
            
        print("\n--- 模糊查询包含 '肖素芬' 或 '土地储备' 的播报 ---")
        stmt_fuzzy = (
            select(BroadcastEvent)
            .where(
                (BroadcastEvent.content.like("%肖素芬%")) | 
                (BroadcastEvent.content.like("%土地储备%"))
            )
        )
        res_fuzzy = await db.execute(stmt_fuzzy)
        events = res_fuzzy.scalars().all()
        print(f"找到 {len(events)} 条符合模糊查询的记录:")
        for ev in events:
            print(f"ID: {ev.id}, is_deleted: {ev.is_deleted}, created_at: {ev.created_at}, content: {ev.content[:100]}...")

if __name__ == "__main__":
    asyncio.run(main())
