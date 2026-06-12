import asyncio
from sqlalchemy import select
from datetime import datetime, time
from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent
from app.models.user import User

async def main():
    async with AsyncSessionLocal() as db:
        # 获取今天（2026-06-09）开始的时刻
        today_start = datetime.combine(datetime.now().date(), time.min)
        
        # 查今天所有的播报记录
        stmt = select(BroadcastEvent, User.name.label("user_name"))\
            .outerjoin(User, BroadcastEvent.user_id == User.id)\
            .where(BroadcastEvent.created_at >= today_start)
            
        res = await db.execute(stmt)
        rows = res.all()
        print(f"Today's broadcasts count: {len(rows)}")
        for row in rows:
            event, user_name = row
            print("=" * 60)
            print(f"ID: {event.id}, Type: {event.event_type}, User: {user_name}, CreatedAt: {event.created_at}")
            print(f"Content:\n{event.content}")
            print(f"ProjectName: {event.project_name}, OpportunityID: {event.crm_opportunity_id}")
            print(f"AttachmentUrls: {event.attachment_urls}")

if __name__ == "__main__":
    asyncio.run(main())
