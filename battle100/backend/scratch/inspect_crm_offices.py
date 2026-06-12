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
        
        # 1. 查找所有包含 office 的表
        cursor.execute("SHOW TABLES LIKE '%office%'")
        office_tables = cursor.fetchall()
        results["office_tables"] = office_tables
        
        # 2. 查找所有包含 dept 的表
        cursor.execute("SHOW TABLES LIKE '%dept%'")
        dept_tables = cursor.fetchall()
        results["dept_tables"] = dept_tables
        
        # 3. 试着在可能存储部门的表里查询这两个部门 ID
        # 比如常见的 js_sys_office
        # 我们来看看是否存在 js_sys_office 并查询它的内容
        for table_info in office_tables:
            table_name = list(table_info.values())[0]
            try:
                cursor.execute(f"SELECT * FROM `{table_name}` WHERE office_code IN ('402881e485a5bd790186020316b32541', 'b8e4a84b114141799550c61f7f8cf199')")
                results[f"office_in_{table_name}"] = cursor.fetchall()
            except Exception as e:
                pass
                
        # 试着在可能存储部门的表里以 dept_id 查
        # 比如 zdcrm_visit_work_hour_record 里的 create_dept 对应的部门名称
        # 看看是否存在 sys_office 或类似
        try:
            cursor.execute("SELECT * FROM js_sys_office WHERE office_code IN ('402881e485a5bd790186020316b32541', 'b8e4a84b114141799550c61f7f8cf199')")
            results["direct_js_sys_office"] = cursor.fetchall()
        except Exception as e:
            results["direct_js_sys_office_err"] = str(e)
            
        # 4. 我们看一下 xiangbinqiang_nts9 现在的部门关联。
        # 在 JeeSite 里，用户和部门的关联通常在 js_sys_employee_post 或者 js_sys_user 里有 office_code 字段？
        # 刚才 js_sys_user 结构里并没有 office_code。但有 corp_code，mgr_type 等。
        # 让我们查一下 js_sys_employee 表或者包含 employee_post 相关的表
        cursor.execute("SHOW TABLES LIKE '%employee%'")
        emp_tables = cursor.fetchall()
        results["emp_tables"] = emp_tables
        
        for table_info in emp_tables:
            table_name = list(table_info.values())[0]
            try:
                # 查是否有跟 xiangbinqiang_nts9 相关的记录
                # 比如 emp_code 或者是 user_code
                cursor.execute(f"SELECT * FROM `{table_name}` WHERE emp_code = 'xiangbinqiang_nts9' OR user_code = 'xiangbinqiang_nts9' LIMIT 5")
                results[f"emp_in_{table_name}"] = cursor.fetchall()
            except Exception as e:
                pass

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
        with open("scratch/crm_offices_results.json", "w", encoding="utf-8") as f:
            json.dump(cleaned_results, f, ensure_ascii=False, indent=2)
            
        print("Success: Written to scratch/crm_offices_results.json")
        
finally:
    conn.close()
