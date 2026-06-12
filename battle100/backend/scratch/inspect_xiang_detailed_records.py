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
        
        # 1. 查工时记录
        cursor.execute("SELECT * FROM zdcrm_visit_work_hour_record WHERE id = %s", ("6a36d99343feed3b0532c21611abb57d",))
        work_hour = cursor.fetchone()
        
        # 转换 datetime 对象为字符串以便 JSON 序列化
        if work_hour:
            for k, v in work_hour.items():
                if hasattr(v, 'strftime'):
                    work_hour[k] = v.strftime('%Y-%m-%d %H:%M:%S')
                elif hasattr(v, 'to_eng_string'): # decimal
                    work_hour[k] = str(v)
                elif isinstance(v, bytes):
                    work_hour[k] = v.decode('utf-8', errors='ignore')
        results["work_hour"] = work_hour
        
        # 2. 查事项明细记录
        cursor.execute("SELECT * FROM zdcrm_visit_customer_record WHERE id = %s", ("71bb0bb835e899752eaf82e8339b41b2",))
        customer_record = cursor.fetchone()
        if customer_record:
            for k, v in customer_record.items():
                if hasattr(v, 'strftime'):
                    customer_record[k] = v.strftime('%Y-%m-%d %H:%M:%S')
                elif hasattr(v, 'to_eng_string'):
                    customer_record[k] = str(v)
                elif isinstance(v, bytes):
                    customer_record[k] = v.decode('utf-8', errors='ignore')
        results["customer_record"] = customer_record
        
        # 3. 查关联项目明细
        cursor.execute("SELECT * FROM zdcrm_visit_customer_project_record WHERE customer_record_id = %s", ("71bb0bb835e899752eaf82e8339b41b2",))
        project_records = cursor.fetchall()
        for pr in project_records:
            for k, v in pr.items():
                if hasattr(v, 'strftime'):
                    pr[k] = v.strftime('%Y-%m-%d %H:%M:%S')
                elif hasattr(v, 'to_eng_string'):
                    pr[k] = str(v)
                elif isinstance(v, bytes):
                    pr[k] = v.decode('utf-8', errors='ignore')
        results["project_records"] = project_records
        
        # 4. 查项斌强在 CRM 中的用户信息
        # 我们不知道 CRM 用户表名，我们可以查一下 show tables like '%user%' 或者从已有的信息里推断
        # 或者查 zdcrm_visit_work_hour_record 里除了 xiangbinqiang_nts9，还有哪些字段，比如 user_name 等。
        # 看看他的 user_id = 'xiangbinqiang_nts9' 是否在 CRM 用户表中存在
        cursor.execute("SHOW TABLES LIKE '%user%'")
        user_tables = cursor.fetchall()
        results["user_tables"] = user_tables
        
        # 试着在一些可能的用户表里查 xiangbinqiang_nts9
        # 例如：sys_user, uc_user, zdcrm_user, member 等等
        for t_info in user_tables:
            table_name = list(t_info.values())[0]
            try:
                # 检查这个表里有没有 xiangbinqiang_nts9 或者 username/user_id
                cursor.execute(f"SELECT * FROM `{table_name}` WHERE id = %s OR username = %s OR login_name = %s LIMIT 1", 
                               ("xiangbinqiang_nts9", "xiangbinqiang_nts9", "xiangbinqiang_nts9"))
                u_rec = cursor.fetchone()
                if u_rec:
                    for k, v in u_rec.items():
                        if hasattr(v, 'strftime'):
                            u_rec[k] = v.strftime('%Y-%m-%d %H:%M:%S')
                        elif isinstance(v, bytes):
                            u_rec[k] = v.decode('utf-8', errors='ignore')
                    results[f"user_in_{table_name}"] = u_rec
            except Exception as e:
                pass

        # 写入 JSON 文件中
        with open("scratch/xiang_detailed_records.json", "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
            
        print("Success: Written to scratch/xiang_detailed_records.json")
        
finally:
    conn.close()
