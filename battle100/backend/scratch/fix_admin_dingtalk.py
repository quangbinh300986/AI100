import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import update
from app.models.user import User
from app.database import AsyncSessionLocal

async def main():
    print("===== 开始手动绑定管理员钉钉 ID =====")
    async with AsyncSessionLocal() as session:
        # 1. 先清空旧的占用此 ID 的记录以绕过唯一约束
        clear_stmt = (
            update(User)
            .where(User.dingtalk_id == "01246616630532082070")
            .values(dingtalk_id=None)
        )
        await session.execute(clear_stmt)
        
        # 2. 将此 ID 赋予 id = 1263 的系统管理员
        stmt = (
            update(User)
            .where(User.id == 1263)
            .values(dingtalk_id="01246616630532082070")
        )
        await session.execute(stmt)
        await session.commit()
        print("已成功将用户 ID: 1263 (系统管理员 13800138000) 的钉钉 ID 绑定为 01246616630532082070！")

if __name__ == "__main__":
    asyncio.run(main())
