import pymysql
import json

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
        results = {}
        
        # 1. 查找昨天 21:50 之后生成的且被删除了的 19 条工时
        # 我们查询它们的 update_by, update_time, remark, update_date 
        cursor.execute("""
            SELECT id, user_id, create_by, create_time, update_by, update_time, remark, is_del 
            FROM zdcrm_visit_work_hour_record 
            WHERE create_time >= '2026-06-09 21:50:00'
              AND create_time <= '2026-06-09 22:15:00'
        """)
        hours = cursor.fetchall()
        
        cleaned_hours = []
        for h in hours:
            cleaned_hours.append({
                "id": h["id"],
                "user_id": h["user_id"],
                "create_by": h["create_by"],
                "create_time": h["create_time"].strftime("%Y-%m-%d %H:%M:%S") if h["create_time"] else None,
                "update_by": h["update_by"],
                "update_time": h["update_time"].strftime("%Y-%m-%d %H:%M:%S") if h["update_time"] else None,
                "remark": h["remark"],
                "is_del": h["is_del"]
            })
            
        results["deleted_hours_inspect"] = cleaned_hours
        
        # 2. 我们也查一下这 19 条工时关联的事项明细
        # 看看事项明细表的 update_by, update_time 
        cursor.execute("""
            SELECT id, work_hour_id, customer_name, create_by, create_time, update_by, update_time, is_del 
            FROM zdcrm_visit_customer_record 
            WHERE create_time >= '2026-06-09 21:50:00'
              AND create_time <= '2026-06-09 22:15:00'
        """)
        details = cursor.fetchall()
        
        cleaned_details = []
        for d in details:
            cleaned_details.append({
                "id": d["id"],
                "work_hour_id": d["work_hour_id"],
                "customer_name": d["customer_name"],
                "create_by": d["create_by"],
                "create_time": d["create_time"].strftime("%Y-%m-%d %H:%M:%S") if d["create_time"] else None,
                "update_by": d["update_by"],
                "update_time": d["update_time"].strftime("%Y-%m-%d %H:%M:%S") if d["update_time"] else None,
                "is_del": d["is_del"]
            })
            
        results["deleted_details_inspect"] = cleaned_details
        
        # 写入结果文件
        with open("scratch/deleted_records_inspect.json", "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
            
        print("Success: Written to scratch/deleted_records_inspect.json")
        
finally:
    conn.close()
