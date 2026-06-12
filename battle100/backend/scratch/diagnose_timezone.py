import pymysql

conn = pymysql.connect(
    host="10.40.0.56",
    port=3307,
    user="gzzdpm_read",
    password="cf6jx529KQ",
    database="gzzdpm",
    charset='utf8mb4',
    cursorclass=pymysql.cursors.DictCursor
)
try:
    with conn.cursor() as cursor:
        # 1. 查当前连接的时区
        cursor.execute("SELECT @@session.time_zone as sess_tz, @@global.time_zone as glob_tz")
        print("时区配置:", cursor.fetchone())
        
        # 2. 查项斌强那条记录在不同时区下的 start_time 的 Unix 时间戳和格式化值
        cursor.execute("""
            SELECT id, user_id, start_time, 
                   UNIX_TIMESTAMP(start_time) as ts, 
                   DATE_FORMAT(start_time, '%Y-%m-%d %H:%i:%s') as fmt_time
            FROM zdcrm_visit_work_hour_record 
            WHERE id = '6a36d99343feed3b0532c21611abb57d'
        """)
        print("默认时区下查询项斌强工时记录:", cursor.fetchone())
        
        # 3. 设置连接时区为东八区
        cursor.execute("SET time_zone = '+08:00'")
        print("已执行 SET time_zone = '+08:00'")
        
        # 4. 再次查询时区
        cursor.execute("SELECT @@session.time_zone as sess_tz")
        print("新Session时区:", cursor.fetchone())
        
        # 5. 再次查询项斌强工时记录
        cursor.execute("""
            SELECT id, user_id, start_time, 
                   UNIX_TIMESTAMP(start_time) as ts, 
                   DATE_FORMAT(start_time, '%Y-%m-%d %H:%i:%s') as fmt_time
            FROM zdcrm_visit_work_hour_record 
            WHERE id = '6a36d99343feed3b0532c21611abb57d'
        """)
        print("东八区时区下查询项斌强工时记录:", cursor.fetchone())
        
        # 6. 用我们的查重 SQL 试一下在东八区下是否能查出
        user_code = "xiangbinqiang_nts9"
        start_dt = "2026-06-09 00:00:00"
        end_dt = "2026-06-10 00:00:00"
        customer_name = "广东省国土资源技术中心（广东省基础地理信息中心）"
        
        sql = """
            SELECT COUNT(*) as cnt 
            FROM zdcrm_visit_customer_record r
            JOIN zdcrm_visit_work_hour_record h ON r.work_hour_id = h.id
            WHERE h.user_id = %s 
              AND h.start_time >= %s 
              AND h.start_time < %s
              AND h.is_del = '0'
              AND r.is_del = '0'
              AND (r.customer_name = %s OR r.customer_name = %s)
        """
        cursor.execute(sql, (user_code, start_dt, end_dt, customer_name, customer_name.replace("（", "(").replace("）", ")")))
        print("东八区查重比对 SQL 结果:", cursor.fetchone())

finally:
    conn.close()
