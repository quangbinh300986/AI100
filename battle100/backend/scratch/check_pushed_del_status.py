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
        
        # 1. 查找昨天 21:50 之后（即我们批量补推 6月9日 历史战报后）在工时主表里生成的全部工时
        cursor.execute("""
            SELECT id, user_id, create_time, is_del, title 
            FROM zdcrm_visit_work_hour_record 
            WHERE create_time >= '2026-06-09 21:50:00'
              AND create_time <= '2026-06-09 22:15:00'
        """)
        hours = cursor.fetchall()
        results["total_count"] = len(hours)
        
        # 2. 统计 is_del 的状态
        del_count = 0
        active_count = 0
        details = []
        
        for h in hours:
            # 格式化时间
            create_time_str = h["create_time"].strftime("%Y-%m-%d %H:%M:%S")
            is_del = h["is_del"]
            if is_del == '1':
                del_count += 1
            else:
                active_count += 1
                
            details.append({
                "id": h["id"],
                "user_id": h["user_id"],
                "create_time": create_time_str,
                "is_del": is_del,
                "title": h["title"]
            })
            
        results["del_count"] = del_count
        results["active_count"] = active_count
        results["details"] = details
        
        # 3. 统计不包括 6月9日 我们昨天补推数据，今天其他推送过的在 21:50 之后的
        # 看看有多少是删除的
        # 写入 JSON
        with open("scratch/pushed_del_status.json", "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
            
        print(f"Success: Written. Total: {len(hours)}, Active: {active_count}, Deleted: {del_count}")

finally:
    conn.close()
