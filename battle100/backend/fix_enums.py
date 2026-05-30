import asyncio
import asyncpg
from app.config import settings

async def run_sql():
    url = settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(url)
    try:
        # Add the uppercase ones if they are missing
        await conn.execute("ALTER TYPE positiontype ADD VALUE IF NOT EXISTS 'BACK_OFFICE';")
        await conn.execute("ALTER TYPE positiontype ADD VALUE IF NOT EXISTS 'MIDDLE_OFFICE';")
        await conn.execute("ALTER TYPE positiontype ADD VALUE IF NOT EXISTS 'TECHNICAL';")
        
        await conn.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'MARKETING_STAFF';")
        await conn.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'TECH_MARKETING';")
        
        print('Enums fixed successfully')
    except Exception as e:
        print(f'Error updating enums: {e}')
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run_sql())
