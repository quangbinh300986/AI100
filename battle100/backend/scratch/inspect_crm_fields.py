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
    with conn.cursor() as cursor:
        for table in ["zdcrm_outside_work_hour_push_record", "zdcrm_visit_work_hour_record", "zdcrm_visit_customer_record", "zdcrm_visit_customer_project_record"]:
            cursor.execute(f"DESCRIBE {table}")
            print(f"Table: {table}")
            for row in cursor.fetchall():
                print(f"  Field: {row[0]}, Type: {row[1]}, Null: {row[2]}, Key: {row[3]}, Default: {row[4]}, Extra: {row[5]}")
            print("-" * 50)
finally:
    conn.close()
