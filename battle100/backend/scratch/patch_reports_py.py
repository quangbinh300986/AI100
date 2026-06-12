import os

def main():
    reports_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../app/api/reports.py"))
    new_func_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "new_sync_func.py"))
    
    print(f"Reading reports.py from: {reports_path}")
    with open(reports_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    print(f"Reading new function implementation from: {new_func_path}")
    with open(new_func_path, 'r', encoding='utf-8') as f:
        new_func_code = f.read()
        
    # 定位 sync_extract_crm_data 的开始
    start_marker = "def sync_extract_crm_data(real_name: str, start_date_val: date, is_marketing: bool) -> dict:"
    start_idx = content.find(start_marker)
    if start_idx == -1:
        print("Error: Could not find start of sync_extract_crm_data in reports.py")
        return
        
    # 定位 sync_extract_crm_data 之后的下一个 API 函数的装饰器，以此判定结束位置
    end_marker = "@router.get(\"/weekly/auto-extract-crm\""
    end_idx = content.find(end_marker)
    if end_idx == -1:
        # 兜底寻找单引号的装饰器
        end_marker = "@router.get('/weekly/auto-extract-crm'"
        end_idx = content.find(end_marker)
        
    if end_idx == -1:
        print("Error: Could not find end marker (@router.get(\"/weekly/auto-extract-crm\")) in reports.py")
        return
        
    # 替换中间部分
    # 注意保留 end_marker 之后的全部内容
    before = content[:start_idx]
    after = content[end_idx:]
    
    # 组合新文件内容，并在函数和装饰器之间加上空行
    new_content = before + new_func_code + "\n\n\n" + after
    
    with open(reports_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print("Success: sync_extract_crm_data in reports.py has been updated successfully!")

if __name__ == "__main__":
    main()
