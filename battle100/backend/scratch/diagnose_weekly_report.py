import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, desc

from app.config import settings
from app.models.user import User
from app.models.report import WeeklyReport
from app.database import AsyncSessionLocal

async def main():
    print("===== 开始查询最新提交的周报 =====")
    async with AsyncSessionLocal() as session:
        # 查询最近修改的周报
        stmt = select(WeeklyReport).order_by(desc(WeeklyReport.updated_at)).limit(3)
        res = await session.execute(stmt)
        reports = res.scalars().all()
        
        if not reports:
            print("没有在数据库中找到任何周报")
            return
            
        for r in reports:
            print(f"\n[周报ID: {r.id}] 周范围: {r.start_date} ~ {r.end_date}, 状态: {r.status}, 更新时间: {r.updated_at}")
            # 获取对应的用户
            user_stmt = select(User).where(User.id == r.user_id)
            user_res = await session.execute(user_stmt)
            u = user_res.scalar_one_or_none()
            if u:
                print(f"  - 提报员工: {u.name}, 手机号: {u.phone}, 角色: {u.role}")
                print(f"  - 钉钉ID: '{u.dingtalk_id}'")
            else:
                print(f"  - 未找到该周报对应的用户记录 (user_id: {r.user_id})")

if __name__ == "__main__":
    asyncio.run(main())
