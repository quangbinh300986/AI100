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
        # 1. 查工时记录
        cursor.execute("SELECT * FROM zdcrm_visit_work_hour_record WHERE id = %s", ("6a36d99343feed3b0532c21611abb57d",))
        print("=== zdcrm_visit_work_hour_record ===")
        print(cursor.fetchall())
        
        # 2. 查事项明细记录
        cursor.execute("SELECT * FROM zdcrm_visit_customer_record WHERE id = %s", ("71bb0bb835e899752eaf82e8339b41b2",))
        print("\n=== zdcrm_visit_customer_record ===")
        print(cursor.fetchall())
        
        # 3. 查关联项目明细
        cursor.execute("SELECT * FROM zdcrm_visit_customer_project_record WHERE customer_record_id = %s", ("71bb0bb835e899752eaf82e8339b41b2",))
        print("\n=== zdcrm_visit_customer_project_record ===")
        print(cursor.fetchall())
finally:
    conn.close()
