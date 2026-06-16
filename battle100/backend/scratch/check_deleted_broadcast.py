# -*- coding: utf-8 -*-
import asyncio
import logging
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent
from sqlalchemy import select, text

async def main():
    async with AsyncSessionLocal() as db:
        # 1. 查询 ID 358 的播报详情
        print("--- 查询 BroadcastEvent ID = 358 ---")
        stmt = select(BroadcastEvent).where(BroadcastEvent.id == 358)
        res = await db.execute(stmt)
        event = res.scalar_one_or_none()
        
        if event:
            print(f"找到记录 ID: {event.id}")
            print(f"event_type: {event.event_type}")
            print(f"content: {event.content[:100]}...")
            print(f"push_status: {event.push_status}")
            print(f"is_deleted: {event.is_deleted}")
            print(f"created_at: {event.created_at}")
            print(f"updated_at: {event.updated_at}")
        else:
            print("在 broadcast_events 表中未找到 ID = 358 的记录！")
            
        # 2. 如果没找到，查询包含“肖素芬”或“清远市清新区土地储备”的相关播报
        print("\n--- 模糊查询包含特定内容的播报 ---")
        stmt_fuzzy = (
            select(BroadcastEvent)
            .where(
                (BroadcastEvent.content.like("%肖素芬%")) | 
                (BroadcastEvent.content.like("%清远市清新区土地储备%"))
            )
        )
        res_fuzzy = await db.execute(stmt_fuzzy)
        events = res_fuzzy.scalars().all()
        print(f"模糊查询找到 {len(events)} 条记录:")
        for ev in events:
            print(f"ID: {ev.id}, is_deleted: {ev.is_deleted}, content: {ev.content[:80]}...")

        # 3. 查一下操作审计日志中关于 358 或 broadcast 模块删除的日志
        print("\n--- 查询操作审计日志中与 358 或删除相关的记录 ---")
        # 审计日志表通常叫 audit_logs 或 operation_logs 等，我们先通过 SQL 查询一下系统里有哪些表
        tables_res = await db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
        tables = [r[0] for r in tables_res.all()]
        print("数据库中的表:", tables)
        
        # 假设审计日志表叫 audit_logs 或 operation_logs，我们可以查一下
        audit_table = None
        for t in ["audit_logs", "operation_logs", "sys_logs", "logs", "user_logs", "action_logs"]:
            if t in tables:
                audit_table = t
                break
                
        if audit_table:
            print(f"使用审计表 {audit_table} 查询日志:")
            stmt_log = text(f"SELECT * FROM {audit_table} WHERE target_id = '358' OR action_type LIKE '%delete%' OR action_type LIKE '%删除%' LIMIT 10")
            # 如果字段不一样可能会报错，我们先查一下该表的结构
            columns_res = await db.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='{audit_table}'"))
            cols = [r[0] for r in columns_res.all()]
            print(f"{audit_table} 表的列:", cols)
            
            # 根据列名查询
            query_str = f"SELECT * FROM {audit_table} WHERE "
            conditions = []
            if "target_id" in cols:
                conditions.append("target_id = '358'")
            if "object_id" in cols:
                conditions.append("object_id = 358")
            if "description" in cols:
                conditions.append("description LIKE '%358%'")
                conditions.append("description LIKE '%删除%'")
            
            if conditions:
                query_str += " OR ".join(conditions) + " ORDER BY id DESC LIMIT 15"
                print("执行日志查询 SQL:", query_str)
                log_res = await db.execute(text(query_str))
                log_rows = log_res.mappings().all()
                for row in log_rows:
                    print(dict(row))
            else:
                print("未匹配到合适的列进行审计查询。")

if __name__ == "__main__":
    asyncio.run(main())
