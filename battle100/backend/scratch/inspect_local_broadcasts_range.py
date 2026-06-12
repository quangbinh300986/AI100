import asyncio
from datetime import datetime
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent
from app.models.user import User

async def main():
    print("=== 正在检查 2026-06-01 至 2026-06-09 本地待补推播报数据 ===")
    
    # 设定起止时间 (6月1日 00:00:00 至 6月9日 23:59:59)
    start_time = datetime(2026, 6, 1, 0, 0, 0)
    end_time = datetime(2026, 6, 9, 23, 59, 59)
    
    async with AsyncSessionLocal() as db:
        stmt = select(BroadcastEvent, User.name.label("user_real_name"))\
            .outerjoin(User, BroadcastEvent.user_id == User.id)\
            .where(
                BroadcastEvent.created_at >= start_time,
                BroadcastEvent.created_at <= end_time,
                BroadcastEvent.is_deleted == False,
                BroadcastEvent.event_type.in_(["triangle", "happiness", "marketing_report"])
            ).order_by(BroadcastEvent.created_at.asc())
            
        res = await db.execute(stmt)
        rows = res.all()
        
        print(f"找到符合类型(triangle, happiness, marketing_report)的播报共: {len(rows)} 条")
        
        # 统计各类型数量
        stats = {"triangle": 0, "happiness": 0, "marketing_report": 0}
        for row in rows:
            event, _ = row
            stats[event.event_type] = stats.get(event.event_type, 0) + 1
            
        print(f"按类型统计: {stats}")
        
        # 打印前 5 条和后 5 条进行概览
        if rows:
            print("\n--- 最早的 3 条记录 ---")
            for i in range(min(3, len(rows))):
                event, user_name = rows[i]
                print(f"ID: {event.id}, User: {user_name}, Type: {event.event_type}, Time: {event.created_at}")
                
            print("\n--- 最晚的 3 条记录 ---")
            for i in range(max(0, len(rows)-3), len(rows)):
                event, user_name = rows[i]
                print(f"ID: {event.id}, User: {user_name}, Type: {event.event_type}, Time: {event.created_at}")

if __name__ == "__main__":
    asyncio.run(main())
