import re

def extract_marketing_report_v2(content, customer_name):
    lines = content.split('\n')
    matter_type = "daily_work"
    if "【日常工作】" in content:
        matter_type = "daily_work"
    elif "【回款跟进】" in content:
        matter_type = "payment_follow_up"

    region = ""
    customer = customer_name
    section = ""
    is_important = False
    assist_users = []
    contracts = []
    
    progress_lines = []
    help_lines = []
    
    in_progress = False
    in_help = False
    
    for line in lines:
        line_strip = line.strip()
        if not line_strip:
            if in_progress:
                progress_lines.append("")
            if in_help:
                help_lines.append("")
            continue
            
        # 识别基本字段
        if line_strip.startswith("* **区域**："):
            region = line_strip.replace("* **区域**：", "").strip()
            in_progress = False
            in_help = False
        elif line_strip.startswith("* **业主单位**："):
            if not customer:
                customer = line_strip.replace("* **业主单位**：", "").strip()
            in_progress = False
            in_help = False
        elif line_strip.startswith("* **科/股室**："):
            section = line_strip.replace("* **科/股室**：", "").strip()
            in_progress = False
            in_help = False
        elif line_strip.startswith("* **是否重点**："):
            is_important = "是" in line_strip
            in_progress = False
            in_help = False
        elif line_strip.startswith("* **协助人**："):
            assist_str = line_strip.replace("* **协助人**：", "").strip()
            if assist_str != "无":
                assist_users = [u.strip() for u in re.split(r"[,，、\s]+", assist_str) if u.strip()]
            in_progress = False
            in_help = False
        elif line_strip.startswith("* **关联合同**："):
            contract_str = line_strip.replace("* **关联合同**：", "").strip()
            if contract_str != "无":
                contracts = [c.strip() for c in re.split(r"[,，、]+", contract_str) if c.strip()]
            in_progress = False
            in_help = False
        elif line_strip.startswith("* **当前进展**："):
            in_progress = True
            in_help = False
        elif line_strip.startswith("* **需协助事项**："):
            in_help = True
            in_progress = False
        else:
            # 属于进展内容或协助内容
            if in_progress:
                progress_lines.append(line)
            elif in_help:
                help_lines.append(line)

    # 清理行首尾的空行
    matter_progress = "\n".join(progress_lines).strip()
    assist_content = "\n".join(help_lines).strip()
    
    if assist_content == "无" or not assist_content:
        assist_content = None
        
    project_list = []
    for c in contracts:
        project_list.append({
            "projectId": "",
            "projectName": c
        })
        
    if customer == "未指定":
        customer = "未指定客户"

    return {
        "matterType": matter_type,
        "matterProgress": matter_progress or content, # 兜底用原文本
        "assistContent": assist_content,
        "assistUserNames": assist_users,
        "projectList": project_list,
        "customerName": customer
    }

content1 = """【日常工作】
* **区域**：广东省/广州市/天河区
* **业主单位**：A客户
* **科/股室**：无
* **是否重点**：是 🔴
* **协助人**：李四, 王五
* **当前进展**：
拜访A客户，沟通XX项目方案测算及后续推进事项，耗时2小时。
第二行进展说明。

* **需协助事项**：
协助完善项目测算材料"""

content2 = """【回款跟进】
* **区域**：广东省/广州市/天河区
* **业主单位**：B客户
* **科/股室**：财务科
* **关联合同**：合同1, 合同2
* **是否重点**：否
* **当前进展**：
催收A客户第一笔款项，预计下周五到账。

* **需协助事项**：
无"""

print("Result 1:", extract_marketing_report_v2(content1, "A客户"))
print("Result 2:", extract_marketing_report_v2(content2, ""))
