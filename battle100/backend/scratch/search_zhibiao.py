import os

root_dir = r"C:\APP\AI100"

def search():
    print("===== 搜索整个工作区中包含 ZhiBiao 的文件 =====")
    for root, dirs, files in os.walk(root_dir):
        if "node_modules" in dirs:
            dirs.remove("node_modules")
        if "target" in dirs:
            dirs.remove("target")
        if ".git" in dirs:
            dirs.remove(".git")
        if ".venv" in dirs:
            dirs.remove(".venv")
            
        for file in files:
            file_path = os.path.join(root, file)
            if file.endswith((".png", ".jpg", ".xlsx", ".pdf", ".docx", ".zip", ".tar", ".gz")):
                continue
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
            except Exception:
                try:
                    with open(file_path, "r", encoding="gbk") as f:
                        content = f.read()
                except Exception:
                    continue
            
            if "zhibiao" in content.lower():
                print(f"Found ZhiBiao in: {file_path}")

if __name__ == "__main__":
    search()
