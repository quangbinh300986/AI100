# -*- coding: utf-8 -*-
import sys
import os
import asyncio
import pymysql
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import settings

async def main():
    sys.stdout.reconfigure(encoding='utf-8')
    
    # 1. 从系统数据库中获取全部激活用户和他们的战队信息
    print("--- 1. 正在载入系统用户战队数据 ---")
    user_names = []
    crm_user_ids = []
    user_team_map = {} # name -> team_id
    crm_id_team_map = {} # crm_user_id -> team_id
    team_name_map = {} # team_id -> team_name
    
    try:
        engine = create_async_engine(settings.DATABASE_URL)
        async with engine.connect() as conn:
            # 载入战队名
            t_res = await conn.execute(text("SELECT id, name FROM teams"))
            for r in t_res.fetchall():
                team_name_map[r[0]] = r[1]
            team_name_map[None] = "无战队"
            
            # 载入用户
            u_res = await conn.execute(text("SELECT name, crm_user_id, team_id FROM users WHERE is_active = True"))
            for r in u_res.fetchall():
                name, crm_id, team_id = r[0], r[1], r[2]
                user_names.append(name)
                user_team_map[name] = team_id
                if crm_id:
                    crm_user_ids.append(crm_id)
                    crm_id_team_map[crm_id] = team_id
                    
        await engine.dispose()
        print(f"载入完成。系统共 {len(user_names)} 个激活用户，分属 {len(team_name_map)} 个战队/小组。")
    except Exception as e:
        print("载入系统数据库失败:", e)
        return

    # 2. 连接 CRM，查询 6/8 至 6/16 的回款，并对比新旧逻辑下的战队归属
    try:
        crm_conn = pymysql.connect(
            host=settings.CRM_DB_HOST,
            port=settings.CRM_DB_PORT,
            user=settings.CRM_DB_USER,
            password=settings.CRM_DB_PASSWORD,
            database=settings.CRM_DB_NAME,
            charset='utf8mb4',
            connect_timeout=10
        )
        cur = crm_conn.cursor(pymysql.cursors.DictCursor)
        
        cur.execute("""
            SELECT r.contract_id, r.contract_name, r.receive_money, r.receive_date, 
                   c.signer, c.contract_head_user, c.create_by
            FROM zdcrm_contract_receive_money_view r
            INNER JOIN contract c ON r.contract_id = c.id
            WHERE r.receive_date >= '2026-06-08 00:00:00' AND r.receive_date <= '2026-06-16 23:59:59'
            ORDER BY r.receive_date ASC
        """)
        rows = cur.fetchall()
        
        print("\n--- 2. 对比回款合同在新旧逻辑下的战队归属 ---")
        for r in rows:
            contract_name = r['contract_name']
            money = float(r['receive_money'])
            signer = r['signer']
            head_user = r['contract_head_user']
            creator = r['create_by']
            
            # 旧逻辑归属：纯依靠 c.signer 是否在战队中
            old_team_id = user_team_map.get(signer, None)
            old_team_name = team_name_map.get(old_team_id, "无战队/漏计")
            
            # 新逻辑归属：优先归属到拥有具体战队（非 None）的关联人员上
            new_team_id = None
            match_by = ""
            
            signer_team = user_team_map.get(signer, None)
            head_team = user_team_map.get(head_user, None)
            creator_team = crm_id_team_map.get(creator, None)
            
            if signer_team is not None:
                new_team_id = signer_team
                match_by = f"签约人({signer})匹配"
            elif head_team is not None:
                new_team_id = head_team
                match_by = f"合同负责人({head_user})匹配"
            elif creator_team is not None:
                new_team_id = creator_team
                match_by = f"创建者账号({creator})匹配"
            else:
                # 兜底：如果关联的人都在无战队（None）
                if signer in user_team_map:
                    new_team_id = None
                    match_by = f"签约人({signer})无战队匹配"
                elif head_user in user_team_map:
                    new_team_id = None
                    match_by = f"合同负责人({head_user})无战队匹配"
                elif creator in crm_id_team_map:
                    new_team_id = None
                    match_by = f"创建者账号({creator})无战队匹配"
            
            new_team_name = team_name_map.get(new_team_id, "无战队/漏计")
            
            print(f"合同: {contract_name[:25]}... (回款 {money} 万)")
            print(f"  详细字段: signer={signer}, head={head_user}, creator={creator}")
            print(f"  [旧逻辑归属]: {old_team_name}")
            print(f"  [新逻辑归属]: {new_team_name} (由 {match_by if match_by else '未匹配到'})")
            print("-" * 60)
            
        cur.close()
        crm_conn.close()
    except Exception as e:
        print("连接或对比失败:", e)

if __name__ == "__main__":
    asyncio.run(main())
