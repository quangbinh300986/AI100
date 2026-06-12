import asyncio
from sqlalchemy import text
from app.database import engine

async def main():
    async with engine.connect() as conn:
        # 查询 PostgreSQL 中的所有表
        result = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """))
        tables = [row[0] for row in result.fetchall()]
        print("PG tables count:", len(tables))
        print("PG tables:")
        for t in sorted(tables):
            print("  ", t)

if __name__ == "__main__":
    asyncio.run(main())
