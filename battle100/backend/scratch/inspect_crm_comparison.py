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
        
        # 1. 查找最近 10 条别人填写的、正常的工时记录（不是通过接口推送的）
        # 接口推送的特点可能是：没有remark或者有特定特征，或者我们直接找 create_time 稍早，且非 sync_zdpm_success 的记录，
        # 或者直接按创建时间降序找一些记录。
        cursor.execute("""
            SELECT * FROM zdcrm_visit_work_hour_record 
            WHERE create_time >= '2026-06-08 00:00:00'
            ORDER BY create_time DESC 
            LIMIT 20
        """)
        recent_hours = cursor.fetchall()
        results["recent_hours"] = recent_hours
        
        # 2. 针对这 20 条工时记录，查询它们的事项明细
        hour_ids = [rh["id"] for rh in recent_hours]
        if hour_ids:
            # 拼成逗号分隔格式
            placeholders = ', '.join(['%s'] * len(hour_ids))
            cursor.execute(f"""
                SELECT * FROM zdcrm_visit_customer_record 
                WHERE work_hour_id IN ({placeholders})
            """, tuple(hour_ids))
            results["recent_details"] = cursor.fetchall()
            
            # 查询关联的项目
            cursor.execute(f"""
                SELECT * FROM zdcrm_visit_customer_project_record 
                WHERE customer_record_id IN (
                    SELECT id FROM zdcrm_visit_customer_record 
                    WHERE work_hour_id IN ({placeholders})
                )
            """, tuple(hour_ids))
            results["recent_projects"] = cursor.fetchall()

        # 格式化并序列化
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
        with open("scratch/crm_comparison_results.json", "w", encoding="utf-8") as f:
            json.dump(cleaned_results, f, ensure_ascii=False, indent=2)
            
        print("Success: Written to scratch/crm_comparison_results.json")
        
finally:
    conn.close()
