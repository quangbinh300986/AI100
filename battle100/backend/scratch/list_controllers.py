import os
import re

controller_dir = r"C:\APP\AI100\zdcrm\server\src\main\java\net\ghsoft\zdcrm\modules\marketanalysis\controller"

def parse_controllers():
    for file in os.listdir(controller_dir):
        if not file.endswith(".java"):
            continue
        file_path = os.path.join(controller_dir, file)
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        print(f"\n===== Controller: {file} =====")
        # 寻找 @RequestMapping
        req_mapping = re.findall(r'@RequestMapping\((["\'].*?["\'])\)', content)
        if req_mapping:
            print(f"Base Path: {req_mapping[0]}")
            
        # 寻找方法上的 @PostMapping 或 @GetMapping
        methods = re.findall(r'@(PostMapping|GetMapping|RequestMapping)\((["\'].*?["\'])\)[\s\S]*?public.*? (.*?\()', content)
        for m in methods:
            print(f"  {m[0]} -> {m[1]} -> Method: {m[2]}")

if __name__ == "__main__":
    parse_controllers()
