import asyncio
import sys
import os
import json

sys.path.append(r"c:\APP\AI100\battle100\backend")

from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        stmt = select(BroadcastEvent).where(
            BroadcastEvent.event_type == "station_report"
        ).order_by(BroadcastEvent.created_at.desc()).limit(5)
        
        res = await db.execute(stmt)
        events = res.scalars().all()
        
        for ev in events:
            print(f"ID: {ev.id}")
            print(f"Title: {ev.project_name}")
            print(f"Location: {ev.station_location}")
            print(f"Category: {ev.station_category}")
            print(f"Content: {repr(ev.content)}")
            print(f"Summary: {repr(ev.summary)}")
            print(f"Created At: {ev.created_at}")
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(main())
