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
        
        # 1. 查找 js_sys_office 的表结构，看看它的主键是什么
        cursor.execute("DESCRIBE js_sys_office")
        results["js_sys_office_structure"] = cursor.fetchall()
        
        # 2. 用这两个 ID 在 js_sys_office 中查找
        # 看看是不是主键不是 office_code，而是例如 office_id, id 等
        cursor.execute("""
            SELECT * FROM js_sys_office 
            WHERE office_code IN ('402881e485a5bd790186020316b32541', 'b8e4a84b114141799550c61f7f8cf199')
               OR office_name IN ('综合管理巴')
        """)
        results["js_sys_office_records"] = cursor.fetchall()
        
        # 3. 查一下 xiangbinqiang_nts9 在 js_sys_employee 中的记录
        cursor.execute("DESCRIBE js_sys_employee")
        results["js_sys_employee_structure"] = cursor.fetchall()
        
        cursor.execute("SELECT * FROM js_sys_employee WHERE emp_code = 'xiangbinqiang_nts9'")
        results["xiang_employee"] = cursor.fetchall()
        
        # 4. 查一下 xiangbinqiang_nts9 在 js_sys_employee_office 中的记录
        cursor.execute("SELECT * FROM js_sys_employee_office WHERE emp_code = 'xiangbinqiang_nts9'")
        results["xiang_employee_office"] = cursor.fetchall()
        
        # 5. 我们再看一下：项斌强以前写的那 18 条工时，它们是如何产生部门的？
        # 它对应的部门名称是“事项1”，等等，不，title是“事项1”，并不是部门名称。
        # 让我们把 402881e485a5bd790186020316b32541 这个ID在 js_sys_office 里单独查出来
        cursor.execute("SELECT * FROM js_sys_office WHERE office_code = '402881e485a5bd790186020316b32541'")
        results["old_office"] = cursor.fetchall()
        
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
        with open("scratch/crm_dept_names_results.json", "w", encoding="utf-8") as f:
            json.dump(cleaned_results, f, ensure_ascii=False, indent=2)
            
        print("Success: Written to scratch/crm_dept_names_results.json")
        
finally:
    conn.close()
