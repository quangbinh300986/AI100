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
        
        # 1. 查找包含项斌强用户 ID 'xiangbinqiang_nts9' 并且包含 'b8e4a84b114141799550c61f7f8cf199' 的表
        # 或者分别查一下，看看 'xiangbinqiang_nts9' 在哪些业务配置表里跟什么部门关联了
        # 比如我们查所有的表，如果表有这几个字段：user_id, emp_code, office_code, dept_id, etc.
        # 我们先查一下几张可能有关联的表：
        
        # 表 a: js_sys_employee_office
        # 表 b: js_sys_employee_post
        # 表 c: js_sys_user_role
        # 表 d: zdcrm_target_plan_management_office
        
        cursor.execute("SHOW TABLES")
        tables = [list(r.values())[0] for r in cursor.fetchall()]
        
        # 我们在所有表里去查含有 xiangbinqiang_nts9 的行，并打印这些表的字段，看看是否有关联到部门
        associated_tables = []
        for t in tables:
            # 排除日志表或者非常大的表，或者工时表等（避免查出刚才补推的内容）
            if t in ["zdcrm_visit_work_hour_record", "zdcrm_visit_customer_record", "zdcrm_visit_customer_project_record", "js_sys_log"]:
                continue
            try:
                # 检查表字段，看看有没有可能包含用户信息
                cursor.execute(f"DESCRIBE `{t}`")
                cols = [c["Field"] for c in cursor.fetchall()]
                
                user_cols = [c for c in cols if c in ["user_id", "emp_code", "user_code", "create_by", "update_by", "userid", "login_code"]]
                if user_cols:
                    # 查询这些列有没有项斌强的 ID
                    where_clause = " OR ".join([f"`{c}` = 'xiangbinqiang_nts9'" for c in user_cols])
                    cursor.execute(f"SELECT * FROM `{t}` WHERE {where_clause} LIMIT 5")
                    rows = cursor.fetchall()
                    if rows:
                        associated_tables.append({
                            "table": t,
                            "matching_rows": rows
                        })
            except Exception as e:
                pass
                
        results["associated_tables"] = associated_tables

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
        with open("scratch/find_dept_association.json", "w", encoding="utf-8") as f:
            json.dump(cleaned_results, f, ensure_ascii=False, indent=2)
            
        print("Success: Written to scratch/find_dept_association.json")
        
finally:
    conn.close()
