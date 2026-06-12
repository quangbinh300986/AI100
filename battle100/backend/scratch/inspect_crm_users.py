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
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        print("Matching user tables:")
        for t in tables:
            if "user" in t.lower() or "member" in t.lower() or "employee" in t.lower():
                print("  ", t)
                
        # 常见用户表可能有 sys_user，如果是，查一下有没有陈小通
        target_tables = [t for t in tables if t.lower() in ["sys_user", "crm_user", "users", "user_info", "t_user", "sys_employee"]]
        for t in target_tables:
            cursor.execute(f"DESCRIBE {t}")
            fields = [r[0] for r in cursor.fetchall()]
            name_fields = [f for f in fields if "name" in f.lower() or "nick" in f.lower()]
            print(f"Table {t} fields:", fields)
            print(f"Table {t} name fields:", name_fields)
            if name_fields:
                name_col = name_fields[0]
                cursor.execute(f"SELECT id, {name_col} FROM {t} LIMIT 5")
                print("Samples:", cursor.fetchall())
                
                # 查陈小通
                cursor.execute(f"SELECT * FROM {t} WHERE {name_col} LIKE %s", ("%陈小通%",))
                print("Search '陈小通' in table:", cursor.fetchall())
                
                cursor.execute(f"SELECT * FROM {t} WHERE {name_col} LIKE %s", ("%雷杰%",))
                print("Search '雷杰' in table:", cursor.fetchall())
finally:
    conn.close()
