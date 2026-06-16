# -*- coding: utf-8 -*-
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent
from app.models.user import User
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        print("正在查找郑雨婷的个人信息...")
        user_stmt = select(User).where(User.name == "郑雨婷")
        user_res = await db.execute(user_stmt)
        user = user_res.scalar_one_or_none()
        
        if not user:
            print("未找到郑雨婷的用户记录！")
            return
            
        print(f"找到郑雨婷: ID={user.id}, team_id={user.team_id}")
        
        print("\n正在更新 368 号播报事件...")
        stmt = select(BroadcastEvent).where(BroadcastEvent.id == 368)
        res = await db.execute(stmt)
        event = res.scalar_one_or_none()
        
        if event:
            print(f"更新前: user_id={event.user_id}, team_id={event.team_id}")
            event.user_id = user.id
            event.team_id = user.team_id
            db.add(event)
            await db.commit()
            print(f"更新后: user_id={event.user_id}, team_id={event.team_id}")
            print("成功修复 368 号播报数据关联关系！请通知用户刷新系统播报页面并在‘清远战队’下查看效果。")
        else:
            print("未找到 ID = 368 的播报！")

if __name__ == "__main__":
    asyncio.run(main())
