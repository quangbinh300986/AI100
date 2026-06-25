import os
import re
import sys

if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

root_dir = r"C:\APP\AI100\zdcrm\server\src"
patterns = [
    re.compile(r"region", re.IGNORECASE),
    re.compile(r"analysis", re.IGNORECASE),
    re.compile(r"competitor", re.IGNORECASE),
    re.compile(r"rival", re.IGNORECASE)
]

def search():
    print(f"开始在 {root_dir} 下搜索 Java 源码...")
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if not file.endswith(".java"):
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
            
            # 判断是否同时包含 region/analysis 或 competitor/rival 相关的业务
            lower_content = content.lower()
            if ("region" in lower_content or "analysis" in lower_content) and ("competitor" in lower_content or "rival" in lower_content):
                print(f"Found candidate: {file_path}")
                # 打印包含 competitor 或 rival 的行
                lines = content.split("\n")
                for i, line in enumerate(lines):
                    if "competitor" in line.lower() or "rival" in line.lower() or "region" in line.lower() or "analysis" in line.lower():
                        if any(k in line.lower() for k in ["mapping", "select", "query", "param", "where", "dto", "controller", "service"]):
                            print(f"  Line {i+1}: {line.strip()[:100]}")

if __name__ == "__main__":
    search()
