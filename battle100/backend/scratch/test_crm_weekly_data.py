import sys
import os
from datetime import date

# 将项目根目录加入模块搜索路径，以便能导入 app 模块
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.reports import sync_extract_crm_data

def test_sync():
    """
    通过调用系统内的核心函数 sync_extract_crm_data 提取丁浩然的周报数据，
    验证其“已开票未回款预警”字段是否已正确进行去重。
    """
    print("开始调用核心业务函数 sync_extract_crm_data...")
    
    # 模拟周一开始时间为 2026-06-08 (周报的日期参数)
    test_date = date(2026, 6, 8)
    real_name = "丁浩然"
    is_marketing = False # 丁浩然是交付岗
    
    try:
        data = sync_extract_crm_data(real_name, test_date, is_marketing)
        
        print("\n--- 提取数据成功 ---")
        
        # 1. 验证 crm_unreceived_warning
        unreceived_warning = data.get("crm_unreceived_warning", "")
        lines = [line for line in unreceived_warning.split("\n") if line.strip()]
        print(f"1. 字段 crm_unreceived_warning 的行数（去重后数量）: {len(lines)}")
        if lines:
            print("部分内容样例:")
            for line in lines[:5]:
                print(f"  {line}")
            if len(lines) > 5:
                print("  ...")
        
        # 2. 验证 delivery_blockers 字段中的收欠款预警
        delivery_blockers = data.get("delivery_blockers", "")
        blocker_lines = [line for line in delivery_blockers.split("\n") if "收欠款预警" in line]
        print(f"\n2. 交付难点字段 delivery_blockers 中的【收欠款预警】条数: {len(blocker_lines)}")
        if blocker_lines:
            print("部分内容样例:")
            for line in blocker_lines[:5]:
                print(f"  {line}")
            if len(blocker_lines) > 5:
                print("  ...")
                
        print("\n====================================")
        print("核心业务函数数据校验完全正常！")
        print("====================================")
        
    except Exception as e:
        print(f"测试失败，抛出异常: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    test_sync()
