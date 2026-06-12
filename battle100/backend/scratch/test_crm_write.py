import pymysql
import uuid
from datetime import datetime

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
        test_id = str(uuid.uuid4())
        sql = """
            INSERT INTO zdcrm_outside_work_hour_push_record (
                id, request_token, user_name, customer_name, matter_type, belong_date, request_body, create_time
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        val = (test_id, "test_token", "测试用户", "测试客户", "daily_work", "2026-06-09", "{}", datetime.now())
        cursor.execute(sql, val)
        conn.commit()
        print("Insert success! Inserted ID:", test_id)
        
        # 顺便删掉这条测试记录以保持清洁
        cursor.execute("DELETE FROM zdcrm_outside_work_hour_push_record WHERE id = %s", (test_id,))
        conn.commit()
        print("Delete success!")
except Exception as e:
    print("Error writing to CRM DB:", e)
finally:
    conn.close()
