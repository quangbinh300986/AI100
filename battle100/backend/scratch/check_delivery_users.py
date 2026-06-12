import pymysql
from datetime import datetime, timedelta

users = [
    "付磊", "何欢", "何鲁旭东", "余伟斌", "冯丹妮", 
    "刘罗军", "刘芳荣", "刘逸帆", "刘锶婷", "占艳"
]

conn = pymysql.connect(
    host="10.40.0.56",
    port=3307,
    user="gzzdpm_read",
    password="cf6jx529KQ",
    database="gzzdpm",
    charset='utf8mb4'
)

monday = datetime(2026, 6, 1)
one_month_ago_dt = (monday - timedelta(days=30)).strftime('%Y-%m-%d 23:59:59')

try:
    with conn.cursor(pymysql.cursors.DictCursor) as cursor:
        print(f"{'姓名':<6} | {'活跃项目':<6} | {'活跃(1月内更新)':<12} | {'任务数':<5} | {'挂起项目':<5} | {'超月未签合同':<8}")
        print("-" * 65)
        for user in users:
            # 1. 活跃项目
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM project 
                WHERE project_manager = %s
                  AND (project_status IS NULL OR (project_status != '已归档' AND project_status != '已结项'))
                  AND project_progress < 100.0
            """, (user,))
            active_cnt = cursor.fetchone()['cnt']
            
            # 2. 活跃项目(1月内更新)
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM project 
                WHERE project_manager = %s
                  AND (project_status IS NULL OR (project_status != '已归档' AND project_status != '已结项'))
                  AND project_progress < 100.0
                  AND update_date >= %s
            """, (user, one_month_ago_dt))
            active_recent_cnt = cursor.fetchone()['cnt']
            
            # 3. 任务数
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM task t
                INNER JOIN project p ON t.project_id = p.id
                WHERE p.project_manager = %s
                  AND t.finish_date BETWEEN '2026-06-01 00:00:00' AND '2026-06-07 23:59:59'
                  AND t.status = '0'
            """, (user,))
            task_cnt = cursor.fetchone()['cnt']
            
            # 4. 挂起项目
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM project 
                WHERE project_manager = %s AND stop_status = '1'
            """, (user,))
            stop_cnt = cursor.fetchone()['cnt']
            
            # 5. 未签合同且立项超一个月
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM project 
                WHERE project_manager = %s 
                  AND (project_status IS NULL OR (project_status != '已归档' AND project_status != '已结项'))
                  AND (contract_status = '0' OR contract_status IS NULL)
                  AND create_date < %s
            """, (user, one_month_ago_dt))
            no_contract_cnt = cursor.fetchone()['cnt']
            
            print(f"{user:<8} | {active_cnt:<8} | {active_recent_cnt:<14} | {task_cnt:<6} | {stop_cnt:<6} | {no_contract_cnt:<10}")

finally:
    conn.close()
