import asyncio
import sys
import os

# 将项目根目录加入模块搜索路径，以便能导入 app 模块
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.database import engine

async def migrate():
    """
    更新 weekly_reports 表中 delivery_rate 和 sales_rate 的字段类型为 TEXT。
    使用异步引擎执行 ALTER TABLE 命令。
    """
    print("开始连接数据库并修改 weekly_reports 表的字段类型...")
    try:
        async with engine.begin() as conn:
            # 1. 修改 delivery_rate 字段类型为 TEXT
            await conn.execute(text("ALTER TABLE weekly_reports ALTER COLUMN delivery_rate TYPE TEXT;"))
            print("成功将 delivery_rate 字段类型修改为 TEXT")
            
            # 2. 修改 sales_rate 字段类型为 TEXT
            await conn.execute(text("ALTER TABLE weekly_reports ALTER COLUMN sales_rate TYPE TEXT;"))
            print("成功将 sales_rate 字段类型修改为 TEXT")
            
        print("数据库字段迁移修改全部成功！")
    except Exception as e:
        print(f"执行数据库迁移失败，错误信息: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(migrate())
