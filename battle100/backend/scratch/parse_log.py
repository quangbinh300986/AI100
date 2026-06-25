import os

log_path = r"C:\Users\lsf\.gemini\antigravity\brain\18393176-cfd9-42e1-b31c-f085621d9775\.system_generated\tasks\task-2519.log"

def parse():
    if not os.path.exists(log_path):
        print("日志文件不存在")
        return
        
    print("===== zdcrm/web/src 匹配文件 =====")
    with open(log_path, "r", encoding="utf-8") as f:
        for line in f:
            if "Match:" in line and "battle100\\frontend\\src" in line:
                # 排除第三方库或dist等
                if "node_modules" not in line and "dist" not in line:
                    print(line.strip())
                    
        print("\n===== battle100/backend 匹配文件 =====")
        f.seek(0)
        for line in f:
            if "Match:" in line and "battle100\\backend" in line:
                if "node_modules" not in line and "backups" not in line and "target" not in line:
                    print(line.strip())

if __name__ == "__main__":
    parse()
