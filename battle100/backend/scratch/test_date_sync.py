import asyncio
import sys
import os

# 将 backend 根目录加入 path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from app.models.report import WeeklyReport
from sqlalchemy import select

async def main():
    print("===== 开始测试周报日期格式化拼接 =====")
    
    async with AsyncSessionLocal() as session:
        # 1. 查找一条周报记录
        stmt = select(WeeklyReport).limit(1)
        res = await session.execute(stmt)
        report = res.scalar_one_or_none()
        if not report:
            print("未在数据库中找到任何周报记录")
            return
            
        print(f"找到周报 ID: {report.id}")
        print(f"原 start_date: {report.start_date} (类型: {type(report.start_date)})")
        print(f"原 end_date: {report.end_date} (类型: {type(report.end_date)})")
        
        # 2. 执行我们的格式化拼接逻辑
        start_date_str = report.start_date.strftime('%Y-%m-%d') if hasattr(report.start_date, 'strftime') else str(report.start_date)
        end_date_str = report.end_date.strftime('%Y-%m-%d') if hasattr(report.end_date, 'strftime') else str(report.end_date)
        date_range_str = f"{start_date_str}至{end_date_str}"
        
        print(f"拼接后的周报日期字符串: {date_range_str}")
        
        # 3. 构造 contents 检查
        contents = [
            {"key": "周报日期", "value": date_range_str, "type": "text"},
            {"key": "本周目标计划", "value": "test", "type": "text"}
        ]
        print(f"构造后的 contents 结构: {contents}")

if __name__ == "__main__":
    asyncio.run(main())
