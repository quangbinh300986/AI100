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
        # 1. 查找 xiangbinqiang_nts9 在 2026-06-09 的所有工时主表记录
        # 这里用 create_time 来做时间筛选
        cursor.execute("""
            SELECT * FROM zdcrm_visit_work_hour_record 
            WHERE user_id = 'xiangbinqiang_nts9' 
              AND create_time >= '2026-06-09 00:00:00' 
              AND is_del = '0'
        """)
        work_hours = cursor.fetchall()
        print(f"=== Work Hour Records Count: {len(work_hours)} ===")
        for wh in work_hours:
            # 打印成可读的内容，防止控制台打印中文字符集报错
            print(f"WorkHourId: {wh['id']}")
            print(f"  Title: {wh['title']}")
            print(f"  CreateTime: {wh['create_time']}")
            print(f"  WorkHour: {wh['work_hour']}")
            
            # 查该工时底下的事项明细
            cursor.execute("""
                SELECT * FROM zdcrm_visit_customer_record 
                WHERE work_hour_id = %s 
                  AND is_del = '0'
            """, (wh['id'],))
            details = cursor.fetchall()
            print(f"  Details Count: {len(details)}")
            for det in details:
                print(f"    DetailId: {det['id']}")
                print(f"      CustomerName: {det['customer_name']}")
                print(f"      MatterType: {det['matter_type']}")
                print(f"      MatterProgress: {det['matter_progress']}")
                print(f"      AssistContent: {det['assist_content']}")
                print(f"      AssistUserIds: {det['assist_user_ids']}")
            print("-" * 50)
            
finally:
    conn.close()
