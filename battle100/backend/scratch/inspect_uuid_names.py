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
        
        uuids = [
            "8bd4ffc19f9f4fe89fc6937b64a902fe", # 卢俊松
            "b8e4a84b114141799550c61f7f8cf199", # 项斌强
            "402881e47ce3f929017d267cf1730d20", # 伍耀强
            "a1701d356ef84e339e3f8dbb0e06099f", # 李健鹏
            "b5a98fb31dca478db4bb03d7a4938289", # 陈鸿源
            "b4f1be9287f548eca194d9b56354d3f0", # 郑子鹏
            "402881e485a5bd790186020316b32541"  # 项斌强以前填工时用的ID
        ]
        
        uuid_str = ", ".join([f"'{u}'" for u in uuids])
        
        # 我们用这些 ID 在 zdcrm_target_plan_management_office 中查名字
        cursor.execute(f"""
            SELECT office_code, office_name 
            FROM zdcrm_target_plan_management_office 
            WHERE office_code IN ({uuid_str})
            GROUP BY office_code, office_name
        """)
        results["target_plan_office_names"] = cursor.fetchall()
        
        # 也在 zdcrm_market_office_area_relation 表里查一下
        cursor.execute(f"""
            SELECT office_code, office_name 
            FROM zdcrm_market_office_area_relation 
            WHERE office_code IN ({uuid_str})
            GROUP BY office_code, office_name
        """)
        results["market_office_relation_names"] = cursor.fetchall()
        
        # 也在 js_sys_office 中查（查 ID 或 office_code）
        cursor.execute(f"""
            SELECT office_code, office_name 
            FROM js_sys_office 
            WHERE office_code IN ({uuid_str})
        """)
        results["sys_office_names"] = cursor.fetchall()

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
        with open("scratch/uuid_names_results.json", "w", encoding="utf-8") as f:
            json.dump(cleaned_results, f, ensure_ascii=False, indent=2)
            
        print("Success: Written to scratch/uuid_names_results.json")
        
finally:
    conn.close()
