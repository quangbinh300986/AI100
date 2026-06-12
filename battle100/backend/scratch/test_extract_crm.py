import sys
import os
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.reports import sync_extract_crm_data

users = [
    "付磊", "何欢", "何鲁旭东", "余伟斌", "冯丹妮", 
    "刘罗军", "刘芳荣", "刘逸帆", "刘锶婷", "占艳"
]

def test():
    print("====== 测试同步全部交付人员 CRM 数据 ======")
    start_date = date(2026, 6, 1)
    
    fields = [
        "crm_active_projects",
        "crm_milestone_tasks",
        "crm_suspended_projects",
        "crm_no_contract_warning",
        "crm_unbilled_warning",
        "crm_unreceived_warning",
        "crm_health_diagnosis"
    ]
    
    print(f"{'姓名':<6} | " + " | ".join(fields))
    print("-" * 150)
    
    for user in users:
        res = sync_extract_crm_data(user, start_date, is_marketing=False)
        row_str = f"{user:<8} | "
        field_vals = []
        for f in fields:
            val = res.get(f, "—")
            # 缩短显示，如果多于15字符，显示前12字符+...
            if val and val != "—":
                snippet = val.replace('\n', ' ').strip()
                if len(snippet) > 15:
                    snippet = snippet[:12] + "..."
                field_vals.append(snippet)
            else:
                field_vals.append("—")
        row_str += " | ".join(field_vals)
        print(row_str)

if __name__ == "__main__":
    test()
