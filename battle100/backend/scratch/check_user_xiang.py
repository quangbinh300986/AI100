import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.user import User

async def main():
    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.name.in_(["项斌强", "胡紫荣"]))
        res = await db.execute(stmt)
        users = res.scalars().all()
        print("Users found:")
        for u in users:
            print(f"Name: {u.name}, PositionType: {u.position_type}, Role: {u.role}")

if __name__ == "__main__":
    asyncio.run(main())
