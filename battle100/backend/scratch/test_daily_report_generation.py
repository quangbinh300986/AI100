# -*- coding: utf-8 -*-
import sys
import os
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import settings
from app.api.dashboard import generate_daily_report

async def main():
    sys.stdout.reconfigure(encoding='utf-8')
    
    # 创建异步 Session
    engine = create_async_engine(settings.DATABASE_URL)
    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with AsyncSessionLocal() as db:
        print("--- 正在模拟调用 generate_daily_report(report_date='2026-06-15', team_id=None) ---")
        try:
            res = await generate_daily_report(
                team_id=None,
                report_date="2026-06-15",
                role="admin",
                db=db
            )
            print("生成日报结果:")
            print(res["text"])
        except Exception as e:
            print("生成日报失败:", e)
            import traceback
            traceback.print_exc()
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
