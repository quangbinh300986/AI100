import os
import re
import sys

if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

root_dir = r"C:\APP\AI100"
patterns = [
    re.compile(r"region[-_]analysis", re.IGNORECASE),
    re.compile(r"library/competitors", re.IGNORECASE),
    re.compile(r"区域.*研判", re.IGNORECASE),
    re.compile(r"竞争对手", re.IGNORECASE),
    re.compile(r"监控标签", re.IGNORECASE)
]

def search_files(dir_path):
    print(f"开始在 {dir_path} 下正则搜索关键字模式...")
    for root, dirs, files in os.walk(dir_path):
        if "node_modules" in dirs:
            dirs.remove("node_modules")
        if "target" in dirs:
            dirs.remove("target")
        if ".git" in dirs:
            dirs.remove(".git")
        if ".git_bak" in dirs:
            dirs.remove(".git_bak")
        if ".venv" in dirs:
            dirs.remove(".venv")
            
        for file in files:
            file_path = os.path.join(root, file)
            # 排除非文本文件
            if file.endswith((".png", ".jpg", ".xlsx", ".pdf", ".docx", ".zip", ".tar", ".gz")):
                continue
                
            encodings = ["utf-8", "gbk", "utf-16", "latin-1"]
            content = None
            for enc in encodings:
                try:
                    with open(file_path, "r", encoding=enc) as f:
                        content = f.read()
                    break
                except Exception:
                    continue
            
            if content is None:
                continue
                
            for pat in patterns:
                if pat.search(content):
                    lines = content.split("\n")
                    for i, line in enumerate(lines):
                        if pat.search(line):
                            print(f"Match: {file_path} (L {i+1}): {line.strip()[:120]}")

if __name__ == "__main__":
    search_files(root_dir)
