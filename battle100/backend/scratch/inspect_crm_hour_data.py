import pymysql

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
        # 1. 查最近的工时记录
        cursor.execute("SELECT * FROM zdcrm_visit_work_hour_record ORDER BY create_time DESC LIMIT 3")
        rows = cursor.fetchall()
        print("=== zdcrm_visit_work_hour_record samples ===")
        for r in rows:
            print("id:", r.get("id"), "create_by:", r.get("create_by"), "user_id:", r.get("user_id"), "create_time:", r.get("create_time"))

        # 2. 查最近的事项明细
        cursor.execute("SELECT * FROM zdcrm_visit_customer_record ORDER BY create_time DESC LIMIT 3")
        rows_detail = cursor.fetchall()
        print("\n=== zdcrm_visit_customer_record samples ===")
        for r in rows_detail:
            print("id:", r.get("id"), "create_by:", r.get("create_by"), "matter_type:", r.get("matter_type"), "customer_name:", r.get("customer_name"), "assist_user_ids:", r.get("assist_user_ids"))

        # 3. 查 js_sys_user 看“陈小通”的信息
        cursor.execute("SELECT user_code, login_code, user_name, email, phone, mobile FROM js_sys_user WHERE user_name LIKE %s OR login_code LIKE %s", ("%陈小通%", "%陈小通%"))
        print("\n=== js_sys_user (陈小通) ===")
        print(cursor.fetchall())
        
        # 4. 查 js_sys_user 看“雷杰”的信息
        cursor.execute("SELECT user_code, login_code, user_name, email, phone, mobile FROM js_sys_user WHERE user_name LIKE %s OR login_code LIKE %s", ("%雷杰%", "%雷杰%"))
        print("\n=== js_sys_user (雷杰) ===")
        print(cursor.fetchall())
finally:
    conn.close()
