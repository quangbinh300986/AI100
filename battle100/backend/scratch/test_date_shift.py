# -*- coding: utf-8 -*-
import sys
import os
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import settings
from app.api.dashboard import generate_daily_report

async def main():
    sys.stdout.reconfigure(encoding='utf-8')
    
    # 模拟 6 月 16 日晚上 20:47 生成日报
    simulated_now = datetime(2026, 6, 16, 20, 47, 48)
    end_time = datetime(simulated_now.year, simulated_now.month, simulated_now.day, 20, 0, 0)
    start_time = end_time - timedelta(days=1)
    
    # 按照我们推导的“昨日整天”逻辑：
    recv_start = (end_time - timedelta(days=1)).replace(hour=0, minute=0, second=0)
    recv_end = (end_time - timedelta(days=1)).replace(hour=23, minute=59, second=59)
    
    print(f"模拟当前时间: {simulated_now}")
    print(f"系统常规统计区间 (用于线索等): {start_time} 至 {end_time}")
    print(f"回款统计区间 (昨日整天): {recv_start} 至 {recv_end}")
    
    # 模拟调用
    engine = create_async_engine(settings.DATABASE_URL)
    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with AsyncSessionLocal() as db:
        res = await generate_daily_report(
            team_id=None,
            report_date="2026-06-16",
            role="admin",
            db=db
        )
        print("\n--- 模拟生成 6 月 16 日大盘日报文字 ---")
        print(res["text"])
        
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
