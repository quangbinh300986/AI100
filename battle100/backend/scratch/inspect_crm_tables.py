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
        print("All tables count:", len(tables))
        print("Matching tables:")
        for t in tables:
            t_lower = t.lower()
            if any(k in t_lower for k in ["hour", "matter", "work", "customer", "project", "assist"]):
                print("  ", t)
finally:
    conn.close()
