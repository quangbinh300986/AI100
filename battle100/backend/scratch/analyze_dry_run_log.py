import re

log_path = "C:/Users/lsf/.gemini/antigravity/brain/409bb5e6-8b0e-4631-b977-13641b3182ef/.system_generated/tasks/task-2343.log"

print("=== 正在分析 Dry-run 日志 ===")

output_lines = []
output_lines.append("=== 正在分析 Dry-run 日志 ===")

try:
    with open(log_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    output_lines.append(f"日志总行数: {len(lines)}")
    
    # 1. 查找所有关于 6月9日 的记录
    june_9_lines = [l.strip() for l in lines if "2026-06-09" in l]
    output_lines.append(f"\n--- 6月9日相关日志 (共 {len(june_9_lines)} 条) ---")
    for l in june_9_lines:
        output_lines.append(l)
        
    # 2. 查找所有的查重跳过记录
    skip_lines = [l.strip() for l in lines if "跳过" in l or "skipped" in l or "查重" in l]
    output_lines.append(f"\n--- 查重判定结果 (共 {len(skip_lines)} 条) ---")
    for l in skip_lines:
        output_lines.append(l)
        
    # 3. 查找所有的警告和错误记录
    warn_lines = [l.strip() for l in lines if "WARNING" in l or "ERROR" in l or "未在外部" in l]
    output_lines.append(f"\n--- 警告与错误日志 (共 {len(warn_lines)} 条) ---")
    for l in warn_lines:
        output_lines.append(l)
        
except Exception as e:
    output_lines.append(f"读取或分析日志失败: {e}")

# 写入分析结果文件
with open("scratch/dry_run_analysis.txt", "w", encoding="utf-8") as out_f:
    out_f.write("\n".join(output_lines))
print("Success: Written to scratch/dry_run_analysis.txt")
