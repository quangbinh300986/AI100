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
        
        # 1. 查项斌强在 js_sys_employee_post 的所有岗位
        cursor.execute("SELECT * FROM js_sys_employee_post WHERE emp_code = 'xiangbinqiang_nts9'")
        results["employee_post"] = cursor.fetchall()
        
        # 2. 查项斌强在 js_sys_employee_office 的所有关联部门
        cursor.execute("SELECT * FROM js_sys_employee_office WHERE emp_code = 'xiangbinqiang_nts9'")
        results["employee_office"] = cursor.fetchall()
        
        # 3. 查 js_sys_office 中所有 office_name 含有 '巴' 的记录
        cursor.execute("SELECT * FROM js_sys_office WHERE office_name LIKE '%巴%' OR office_code = 'b8e4a84b114141799550c61f7f8cf199'")
        results["office_with_ba"] = cursor.fetchall()
        
        # 4. 查下 js_sys_office 里面有没有以 'ZD009' 作为父级 parent_code 的部门
        cursor.execute("SELECT * FROM js_sys_office WHERE parent_code = 'ZD009'")
        results["sub_offices_of_ZD009"] = cursor.fetchall()

        # 5. 试着在 zdcrm_target_plan_management_office 查找项斌强相关的数据
        # 比如我们查这个表里所有 office_code 是 'b8e4a84b114141799550c61f7f8cf199' 的记录
        cursor.execute("SELECT * FROM zdcrm_target_plan_management_office WHERE office_code = 'b8e4a84b114141799550c61f7f8cf199'")
        results["zdcrm_target_plan"] = cursor.fetchall()
        
        # 6. 我们再查一下：今天其他推送了工时的人，在 js_sys_employee 表中的 office_code 和他们在工时记录中的 create_dept
        # 我们看看这套映射是否可以从某张表里查出来。
        # 比如，有没有一张表是记录“部门 (ZDxxx)” 到 “销售巴/战队 (UUID)” 的映射？
        # 或者有销售部门到战队巴的映射关系表？
        # 我们在之前得到的表里发现有：zdcrm_market_office_area_relation
        # 让我们把这个表查一下！
        try:
            cursor.execute("SELECT * FROM zdcrm_market_office_area_relation")
            results["market_office_area_relation"] = cursor.fetchall()
        except Exception as e:
            results["market_office_area_relation_err"] = str(e)

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
        with open("scratch/targeted_relations_results.json", "w", encoding="utf-8") as f:
            json.dump(cleaned_results, f, ensure_ascii=False, indent=2)
            
        print("Success: Written to scratch/targeted_relations_results.json")
        
finally:
    conn.close()
