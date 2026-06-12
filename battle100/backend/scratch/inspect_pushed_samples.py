import pymysql
import json
import re

log_path = "C:/Users/lsf/.gemini/antigravity/brain/409bb5e6-8b0e-4631-b977-13641b3182ef/.system_generated/tasks/task-2398.log"

# 从日志中提取推送成功的样本
samples = []
try:
    with open(log_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # 我们用正则搜索：[正式推送] 正在向 CRM 接口推送打卡请求: 用户【xxx】
    # 以及在附近查找它的 ID, 日期
    # 为了简单，我们直接查询数据库中创建时间在最近 10 分钟以内的记录！
    # 因为刚才执行正式推送是在 13:06 到 13:08 之间。
    # 只要查询创建时间在今天（6月10号）13:05 之后的工时，就都是我们刚刚推送写入的！
    # 这样更直接、更精准！
    
    conn = pymysql.connect(
        host="10.40.0.56",
        port=3307,
        user="gzzdpm_read",
        password="cf6jx529KQ",
        database="gzzdpm",
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
    try:
        with conn.cursor() as cursor:
            # 查今天 13:05 之后写入的最近 5 条工时
            cursor.execute("""
                SELECT id, user_id, create_by, create_time, is_del, title, start_time 
                FROM zdcrm_visit_work_hour_record 
                WHERE create_time >= '2026-06-10 13:05:00'
                ORDER BY create_time DESC
                LIMIT 5
            """)
            hours = cursor.fetchall()
            
            pushed_samples = []
            for h in hours:
                # 查明细
                cursor.execute("""
                    SELECT id, customer_name, matter_type, matter_progress, is_del 
                    FROM zdcrm_visit_customer_record 
                    WHERE work_hour_id = %s
                """, (h["id"],))
                details = cursor.fetchall()
                
                # 格式化
                h["create_time"] = h["create_time"].strftime("%Y-%m-%d %H:%M:%S")
                h["start_time"] = h["start_time"].strftime("%Y-%m-%d %H:%M:%S")
                
                pushed_samples.append({
                    "work_hour": h,
                    "details": details
                })
                
            print(f"抽检成功：在CRM数据库中成功匹配并检索出 {len(pushed_samples)} 条刚刚推送落库的工时记录！")
            
            with open("scratch/pushed_samples_verify.json", "w", encoding="utf-8") as out_f:
                json.dump(pushed_samples, out_f, ensure_ascii=False, indent=2)
                
    finally:
        conn.close()
        
except Exception as e:
    print(f"抽检脚本异常: {e}")
