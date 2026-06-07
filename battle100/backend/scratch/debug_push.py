# -*- coding: utf-8 -*-
"""
真实触发 trigger_broadcast_push 并捕获打印异常的调试脚本
"""

import asyncio
import sys
import os

# 将当前工作路径添加到系统路径中以允许正常导入 app 包
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent, EventType
from app.api.broadcast import trigger_broadcast_push
from sqlalchemy import select

async def main():
    print("正在启动数据库会话以获取最近的驻点快报记录...")
    async with AsyncSessionLocal() as db:
        # 获取最近的一条驻点人员播报
        stmt = select(BroadcastEvent).where(
            BroadcastEvent.event_type == EventType.STATION_REPORT.value
        ).order_by(BroadcastEvent.id.desc()).limit(1)
        
        res = await db.execute(stmt)
        event = res.scalar_one_or_none()
        
        if not event:
            print("未在数据库中查找到任何驻点快报记录，请确认数据是否入库。")
            return
            
        print(f"找到最近的驻点快报 ID: {event.id}, 标题: {event.project_name}, 推送状态: {event.push_status}")
        
        # 将其状态强行重置为 pending，以便 trigger_broadcast_push 能够触发执行
        event.push_status = "pending"
        db.add(event)
        await db.commit()
        print(f"已将该条记录的推送状态重置为 pending")

    print(f"\n开始直接调用 trigger_broadcast_push({event.id})...")
    # 我们不进行 try/except 捕获，以便直接在控制台看到最原始的错误堆栈！
    await trigger_broadcast_push(event.id)
    print("\ntrigger_broadcast_push 调用结束。")

    # 再次查询确认最新的状态
    async with AsyncSessionLocal() as db:
        stmt = select(BroadcastEvent).where(BroadcastEvent.id == event.id)
        res = await db.execute(stmt)
        updated_event = res.scalar_one_or_none()
        print(f"当前数据库中该记录的状态更新为: {updated_event.push_status if updated_event else '未找到'}")

if __name__ == "__main__":
    asyncio.run(main())
