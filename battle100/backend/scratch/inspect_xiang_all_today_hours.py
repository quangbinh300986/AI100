import pymysql
import json

conn = pymysql.connect(
    host="10.40.0.56",
    port=3307,
    user="gzzdpm_read",
    password="cf6jx529KQ",
    database="gzzdpm",
    charset='utf8mb4'
)
try:
    with conn.cursor(pymysql.cursors.DictCursor) as cursor:
        results = {}
        
        # 1. 查找项斌强在 2026-06-09 产生的所有工时（无论 is_del 是 0 还是 1，也不论创建时间是何时）
        # 这里用 start_time 进行过滤，即 work_date 是今天的所有记录
        cursor.execute("""
            SELECT * FROM zdcrm_visit_work_hour_record 
            WHERE user_id = 'xiangbinqiang_nts9' 
              AND start_time >= '2026-06-09 00:00:00' 
              AND start_time < '2026-06-10 00:00:00'
        """)
        results["all_today_hours"] = cursor.fetchall()
        
        # 2. 如果还有 6 月 8 日的，也一并查一下，看一下他的近期填报记录
        cursor.execute("""
            SELECT * FROM zdcrm_visit_work_hour_record 
            WHERE user_id = 'xiangbinqiang_nts9' 
              AND start_time >= '2026-06-08 00:00:00' 
              AND start_time < '2026-06-09 00:00:00'
        """)
        results["all_yesterday_hours"] = cursor.fetchall()

        # 格式化
        import decimal
        def clean_record(rec):
            if isinstance(rec, list):
                return [clean_record(item) for item in rec]
            if isinstance(rec, dict):
                cleaned = {}
                for k, v in rec.items():
                    if hasattr(v, 'strftime'):
                        cleaned[k] = v.strftime('%Y-%m-%d %H:%M:%S')
                    elif isinstance(v, decimal.Decimal):
                        cleaned[k] = float(v)
                    elif isinstance(v, bytes):
                        cleaned[k] = v.decode('utf-8', errors='ignore')
                    elif isinstance(v, dict) or isinstance(v, list):
                        cleaned[k] = clean_record(v)
                    else:
                        cleaned[k] = v
                return cleaned
            return rec
            
        cleaned_results = clean_record(results)
        with open("scratch/xiang_all_history.json", "w", encoding="utf-8") as f:
            json.dump(cleaned_results, f, ensure_ascii=False, indent=2)
            
        print("Success: Written to scratch/xiang_all_history.json")
        
finally:
    conn.close()
