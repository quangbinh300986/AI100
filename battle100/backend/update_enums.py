import asyncio
import asyncpg
from app.config import settings

async def run_sql():
    # Remove +asyncpg from URL for asyncpg connect
    url = settings.DATABASE_URL.replace("+asyncpg", "")
    conn = await asyncpg.connect(url)
    try:
        await conn.execute("ALTER TYPE positiontype ADD VALUE IF NOT EXISTS 'back_office';")
        await conn.execute("ALTER TYPE positiontype ADD VALUE IF NOT EXISTS 'middle_office';")
        await conn.execute("ALTER TYPE positiontype ADD VALUE IF NOT EXISTS 'technical';")
        await conn.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'marketing_staff';")
        await conn.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'tech_marketing';")
        print('Enums updated successfully')
    except Exception as e:
        print(f'Error updating enums: {e}')
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run_sql())
