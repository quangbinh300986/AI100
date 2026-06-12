import os
import openpyxl
import pandas as pd

search_dir = r"C:\APP\AI100"
keywords = ["幸福委播报", "中台播报", "附件4", "附件5", "播报", "附件3"]

out_file = r"C:\APP\AI100\search_excel_result.txt"

with open(out_file, "w", encoding="utf-8") as out:
    for file in os.listdir(search_dir):
        if not file.endswith((".xlsx", ".xls")):
            continue
        file_path = os.path.join(search_dir, file)
        out.write(f"\n=====================================\nChecking {file}...\n")
        
        try:
            if file.endswith(".xlsx"):
                xls = pd.ExcelFile(file_path, engine='openpyxl')
            else:
                xls = pd.ExcelFile(file_path, engine='xlrd')
            for sheet_name in xls.sheet_names:
                df = pd.read_excel(xls, sheet_name=sheet_name)
                for idx, row in df.iterrows():
                    row_str = " | ".join([str(val) for val in row.values if pd.notna(val)])
                    for kw in keywords:
                        if kw in row_str:
                            out.write(f"[{sheet_name}] Line {idx}: {row_str}\n")
        except Exception as e:
            out.write(f"Error reading {file}: {e}\n")

print("搜索完成，结果已写入 search_excel_result.txt")
