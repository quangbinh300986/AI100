import asyncio
import sys
import os

# 将项目根目录加入模块搜索路径，以便能导入 app 模块
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.database import engine

async def migrate():
    """
    更新 broadcast_events 表，添加 is_stationed 列以指示是否为驻点人员。
    默认值为 TRUE。使用 ADD COLUMN IF NOT EXISTS 保证幂等性。
    """
    print("开始连接数据库添加 is_stationed 列...")
    try:
        async with engine.begin() as conn:
            sql = text("ALTER TABLE broadcast_events ADD COLUMN IF NOT EXISTS is_stationed BOOLEAN DEFAULT TRUE;")
            await conn.execute(sql)
            print("成功执行 ALTER TABLE，is_stationed 列添加成功！")
        print("数据库迁移成功！")
    except Exception as e:
        print(f"执行数据库迁移失败，错误信息: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(migrate())
