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
        print("=== 开始单步排查查重过滤条件 ===")
        
        # 1. 查询工时主表
        cursor.execute("SELECT id, user_id, start_time, is_del, title FROM zdcrm_visit_work_hour_record WHERE id = '6a36d99343feed3b0532c21611abb57d'")
        wh = cursor.fetchone()
        print("工时主表内容:")
        print(f"  id: '{wh['id']}' (type: {type(wh['id'])})")
        print(f"  user_id: '{wh['user_id']}' (type: {type(wh['user_id'])})")
        print(f"  start_time: '{wh['start_time']}' (type: {type(wh['start_time'])})")
        print(f"  is_del: '{wh['is_del']}' (type: {type(wh['is_del'])})")
        print(f"  title: '{wh['title']}' (type: {type(wh['title'])})")
        
        # 2. 查询明细表
        cursor.execute("SELECT id, work_hour_id, customer_name, is_del FROM zdcrm_visit_customer_record WHERE work_hour_id = '6a36d99343feed3b0532c21611abb57d'")
        det = cursor.fetchone()
        print("明细表内容:")
        print(f"  id: '{det['id']}' (type: {type(det['id'])})")
        print(f"  work_hour_id: '{det['work_hour_id']}' (type: {type(det['work_hour_id'])})")
        print(f"  customer_name: '{det['customer_name']}' (type: {type(det['customer_name'])})")
        print(f"  is_del: '{det['is_del']}' (type: {type(det['is_del'])})")
        
        # 3. 模拟 SQL 各个 WHERE 条件
        # 条件 1: user_id
        cond_user = (wh['user_id'] == 'xiangbinqiang_nts9')
        print(f"条件 1 (user_id == 'xiangbinqiang_nts9'): {cond_user}")
        
        # 条件 2: start_time
        # 注意: pymysql 会把 timestamp 自动解析为 datetime.datetime 对象
        # 我们用字符串比较时，MySQL能处理，但在 python 里我们需要注意类型转换
        import datetime
        dt_start = datetime.datetime(2026, 6, 9, 0, 0, 0)
        dt_end = datetime.datetime(2026, 6, 10, 0, 0, 0)
        cond_time = (wh['start_time'] >= dt_start and wh['start_time'] < dt_end)
        print(f"条件 2 (start_time 范围): {cond_time}")
        
        # 条件 3: is_del
        cond_wh_del = (wh['is_del'] == '0')
        cond_det_del = (det['is_del'] == '0')
        print(f"条件 3 (h.is_del == '0'): {cond_wh_del}")
        print(f"条件 3.2 (r.is_del == '0'): {cond_det_del}")
        
        # 条件 4: customer_name
        target_name = "广东省国土资源技术中心（广东省基础地理信息中心）"
        cond_name_exact = (det['customer_name'] == target_name)
        cond_name_repl = (det['customer_name'] == target_name.replace("（", "(").replace("）", ")"))
        print(f"条件 4 (customer_name 精确匹配): {cond_name_exact}")
        print(f"条件 4.2 (customer_name 英文括号匹配): {cond_name_repl}")
        
        # 4. 执行不含 is_del 的联表查询，看看能出来几条
        cursor.execute("""
            SELECT COUNT(*) as cnt 
            FROM zdcrm_visit_customer_record r
            JOIN zdcrm_visit_work_hour_record h ON r.work_hour_id = h.id
            WHERE h.user_id = 'xiangbinqiang_nts9' 
              AND h.start_time >= '2026-06-09 00:00:00' 
              AND h.start_time < '2026-06-10 00:00:00'
        """)
        print("只筛选用户和日期的联表 COUNT:", cursor.fetchone())
        
        # 5. 执行加上客户名称后的联表查询
        cursor.execute("""
            SELECT COUNT(*) as cnt 
            FROM zdcrm_visit_customer_record r
            JOIN zdcrm_visit_work_hour_record h ON r.work_hour_id = h.id
            WHERE h.user_id = 'xiangbinqiang_nts9' 
              AND h.start_time >= '2026-06-09 00:00:00' 
              AND h.start_time < '2026-06-10 00:00:00'
              AND r.customer_name LIKE '%%广东省国土资源技术中心%%'
        """)
        print("加上客户名称模糊匹配后的联表 COUNT:", cursor.fetchone())

finally:
    conn.close()
