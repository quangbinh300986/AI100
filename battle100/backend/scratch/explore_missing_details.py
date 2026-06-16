# -*- coding: utf-8 -*-
import sys
import os
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import settings

async def main():
    sys.stdout.reconfigure(encoding='utf-8')
    try:
        engine = create_async_engine(settings.DATABASE_URL)
        async with engine.connect() as conn:
            # 查出创建合同的人对应的系统成员和战队名字
            # 1. 梁绮雯 (liangqiwen_ahab)
            # 2. 钟秀玲 (zhongxiuling_gph2)
            # 3. 李勇 (liyong_yqj6)
            # 4. 曾家艺 (cengjiayi_puap)
            print("--- 查找创建合同人员的战队归属 ---")
            target_crm_ids = ["liangqiwen_ahab", "zhongxiuling_gph2", "liyong_yqj6", "cengjiayi_puap"]
            placeholders = ", ".join([f"'{cid}'" for cid in target_crm_ids])
            res = await conn.execute(text(f"""
                SELECT u.name, u.crm_user_id, t.name as team_name, t.id as team_id 
                FROM users u
                LEFT JOIN teams t ON u.team_id = t.id
                WHERE u.crm_user_id IN ({placeholders})
            """))
            rows = res.fetchall()
            for r in rows:
                print(f"CRM账号: {r[1]} -> 系统名字: {r[0]}, 归属战队: {r[2]} (ID: {r[3]})")
        await engine.dispose()
    except Exception as e:
        print("查询失败:", e)

if __name__ == "__main__":
    asyncio.run(main())
