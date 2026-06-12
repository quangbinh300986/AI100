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
        
        # 1. 查找今天 21:50 之后（补推开始后）所有的工时记录
        cursor.execute("""
            SELECT id, create_by, create_time, create_dept, user_id, title
            FROM zdcrm_visit_work_hour_record 
            WHERE create_time >= '2026-06-09 21:50:00'
        """)
        pushed_hours = cursor.fetchall()
        results["total_pushed_count"] = len(pushed_hours)
        
        # 2. 查出这些人在 js_sys_employee 表里的实际归属部门，并与工时里的作对比
        comparisons = []
        for ph in pushed_hours:
            user_id = ph["user_id"]
            cursor.execute("""
                SELECT emp_code, emp_name, office_code, office_name 
                FROM js_sys_employee 
                WHERE emp_code = %s
            """, (user_id,))
            emp = cursor.fetchone()
            
            if emp:
                office_match = (ph["create_dept"] == emp["office_code"])
                comparisons.append({
                    "user_id": user_id,
                    "user_name": emp["emp_name"],
                    "work_hour_title": ph["title"],
                    "pushed_create_dept": ph["create_dept"],
                    "actual_office_code": emp["office_code"],
                    "actual_office_name": emp["office_name"],
                    "is_match": office_match
                })
            else:
                comparisons.append({
                    "user_id": user_id,
                    "user_name": "未知员工",
                    "work_hour_title": ph["title"],
                    "pushed_create_dept": ph["create_dept"],
                    "actual_office_code": None,
                    "actual_office_name": None,
                    "is_match": False
                })
                
        results["comparisons"] = comparisons
        
        # 3. 统计不匹配的人
        mismatches = [c for c in comparisons if not c["is_match"]]
        results["mismatch_count"] = len(mismatches)
        results["mismatches"] = mismatches

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
        with open("scratch/crm_pushed_depts_comparison.json", "w", encoding="utf-8") as f:
            json.dump(cleaned_results, f, ensure_ascii=False, indent=2)
            
        print("Success: Written to scratch/crm_pushed_depts_comparison.json")
        
finally:
    conn.close()
