import os

target_dir = r"C:\APP\AI100\zdcrm\server\src\main\java\net\ghsoft\zdcrm\modules\marketanalysis"

def list_files():
    if not os.path.exists(target_dir):
        print("目录不存在")
        return
        
    print(f"===== 目录 {target_dir} 下的文件结构 =====")
    for root, dirs, files in os.walk(target_dir):
        for file in files:
            relative_path = os.path.relpath(os.path.join(root, file), target_dir)
            print(relative_path)

if __name__ == "__main__":
    list_files()
