# -*- coding: utf-8 -*-
with open("app/api/dashboard.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "昨日有回款合同数量" in line:
        print(f"找到关键词在第 {i+1} 行")
        start = max(0, i - 40)
        end = min(len(lines), i + 60)
        for idx in range(start, end):
            print(f"{idx+1}: {lines[idx]}", end="")
        break
