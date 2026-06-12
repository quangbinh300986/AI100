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
        
        # 1. 查找最近 3 个月内，项斌强在 CRM 中填报过的所有工时记录（不仅限于 6 月 9 日）
        # 让我们把限制放大一点，查看前 20 条记录，看看他们的 create_dept, create_time 等
        cursor.execute("""
            SELECT id, is_del, create_by, create_time, create_dept, user_id, start_time, title, work_hour, sync_zdpm_success
            FROM zdcrm_visit_work_hour_record 
            WHERE user_id = 'xiangbinqiang_nts9' 
            ORDER BY create_time DESC 
            LIMIT 20
        """)
        results["historical_hours"] = cursor.fetchall()
        
        # 2. 我们也查一下别的广州分公司营销岗员工（例如可能跟项斌强同部门的人），看看他们的部门ID是什么
        # 项斌强的钉钉职位是“广州分公司总经理（营销）”
        # 我们可以搜一下 recent_hours 里面最近填报工时的人的 user_id 在 js_sys_user 里的 user_name，
        # 并对比他们的 create_dept，看看是否是同一个部门。
        
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
        with open("scratch/xiang_historical_depts.json", "w", encoding="utf-8") as f:
            json.dump(cleaned_results, f, ensure_ascii=False, indent=2)
            
        print("Success: Written to scratch/xiang_historical_depts.json")
        
finally:
    conn.close()
