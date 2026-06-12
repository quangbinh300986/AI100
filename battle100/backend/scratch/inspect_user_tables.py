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
        
        # 1. 描述 js_sys_user 结构
        cursor.execute("DESCRIBE js_sys_user")
        results["js_sys_user_structure"] = cursor.fetchall()
        
        # 2. 描述 ding_talk_user 结构
        cursor.execute("DESCRIBE ding_talk_user")
        results["ding_talk_user_structure"] = cursor.fetchall()
        
        # 3. 查 xiangbinqiang_nts9 在这两个表里的匹配情况
        # 我们可以根据刚才 DESCRIBE 的字段或者先执行模糊/精确查询
        cursor.execute("SELECT * FROM js_sys_user WHERE user_code = 'xiangbinqiang_nts9' OR user_name LIKE '%项斌强%' OR login_code = 'xiangbinqiang_nts9'")
        results["xiang_in_js_sys_user"] = cursor.fetchall()
        
        cursor.execute("SELECT * FROM ding_talk_user WHERE userid = 'xiangbinqiang_nts9' OR name LIKE '%项斌强%'")
        results["xiang_in_ding_talk_user"] = cursor.fetchall()
        
        # 我们来看看这两条工时记录是否真的属于项斌强，以及项斌强的部门信息等
        # 比如：他的真实 user_code 在 js_sys_user 里是什么？
        
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
        with open("scratch/user_inspect_results.json", "w", encoding="utf-8") as f:
            json.dump(cleaned_results, f, ensure_ascii=False, indent=2)
            
        print("Success: Written to scratch/user_inspect_results.json")
        
finally:
    conn.close()
