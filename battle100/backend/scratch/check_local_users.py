import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        print("====== 检查系统本地 User 记录 ======")
        stmt = select(User).where(User.is_active == True)
        res = await db.execute(stmt)
        users = res.scalars().all()
        
        print(f"活跃用户总数: {len(users)}")
        
        targets = ["付磊", "何欢", "何鲁旭东", "余伟斌", "冯丹妮", "刘罗军", "刘芳荣", "刘逸帆", "刘锶婷", "占艳"]
        
        print(f"{'ID':<5} | {'系统记录姓名':<10} | {'三级巴':<20} | {'角色':<15} | {'岗位类型':<15} | {'CRM用户ID':<15}")
        print("-" * 90)
        for u in users:
            # 模糊匹配或精确匹配
            if any(t in u.name for t in targets) or u.name in targets:
                print(f"{u.id:<5} | {u.name:<12} | {u.third_class_bar or '—':<22} | {u.role:<17} | {str(u.position_type):<17} | {u.crm_user_id or '—'}")

if __name__ == "__main__":
    asyncio.run(main())
