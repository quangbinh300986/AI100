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
        
        # 1. 描述表结构
        cursor.execute("DESCRIBE zdcrm_visit_work_hour_record")
        results["work_hour_structure"] = cursor.fetchall()
        
        cursor.execute("DESCRIBE zdcrm_visit_customer_record")
        results["customer_record_structure"] = cursor.fetchall()
        
        # 2. 检查项斌强那两条记录在所有字段上的值
        cursor.execute("SELECT * FROM zdcrm_visit_work_hour_record WHERE id IN ('6a36d99343feed3b0532c21611abb57d', '6eb50c65188e2af955eba87d9fbf0501')")
        results["xiang_hours"] = cursor.fetchall()
        
        cursor.execute("SELECT * FROM zdcrm_visit_customer_record WHERE id IN ('71bb0bb835e899752eaf82e8339b41b2', 'a6620f9e9965f48e882e8dbcf6c473eb')")
        results["xiang_details"] = cursor.fetchall()
        
        # 3. 找一条今天别人写入的、成功的、对比用的记录 (比如刚才的 f5974a1226f0cb610e3858fa2fac19f2)
        cursor.execute("SELECT * FROM zdcrm_visit_work_hour_record WHERE id = 'f5974a1226f0cb610e3858fa2fac19f2'")
        results["other_hour"] = cursor.fetchone()
        
        cursor.execute("SELECT * FROM zdcrm_visit_customer_record WHERE work_hour_id = 'f5974a1226f0cb610e3858fa2fac19f2'")
        results["other_details"] = cursor.fetchall()

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
        with open("scratch/crm_record_details.json", "w", encoding="utf-8") as f:
            json.dump(cleaned_results, f, ensure_ascii=False, indent=2)
            
        print("Success: Written to scratch/crm_record_details.json")
        
finally:
    conn.close()
