import os

root_dir = r"C:\APP\AI100\zdcrm\web\src"

def search():
    print("===== 搜索 zdcrm/web/src 中包含 region 或 competitor 的文件 =====")
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if not file.endswith((".ts", ".vue", ".js")):
                continue
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
            except Exception:
                try:
                    with open(file_path, "r", encoding="gbk") as f:
                        content = f.read()
                except Exception:
                    continue
            
            lower_content = content.lower()
            if "region" in lower_content or "competitor" in lower_content:
                # 打印包含的关键字
                matches = []
                if "region" in lower_content:
                    matches.append("region")
                if "competitor" in lower_content:
                    matches.append("competitor")
                print(f"{file_path} -> Matches: {matches}")

if __name__ == "__main__":
    search()
