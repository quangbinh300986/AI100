# -*- coding: utf-8 -*-
"""
查询并详细打印特定播报记录数据库字段的脚本
"""

import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent
from sqlalchemy import select
import json

async def main():
    async with AsyncSessionLocal() as db:
        stmt = select(BroadcastEvent).order_by(BroadcastEvent.id.desc()).limit(10)
        res = await db.execute(stmt)
        events = res.scalars().all()
        
        print("--- 最近 10 条播报记录数据 ---")
        for event in events:
            print(f"ID: {event.id} | 类型: {event.event_type} | 状态: {event.push_status} | MsgID: {event.dingtalk_msg_id} | 标题: {event.project_name}")

if __name__ == "__main__":
    asyncio.run(main())
