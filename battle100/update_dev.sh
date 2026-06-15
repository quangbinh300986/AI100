#!/bin/bash
set -e

echo "=== 1. 拉取开发分支最新代码 ==="
git pull

echo "=== 2. 同步开发版后端 Python 依赖 ==="
cd backend
uv sync
# 由于后端服务运行在 --reload 模式下，依赖同步及代码拉取后，后端会自动秒级生效，无需手动重启！

echo "=== 3. 编译打包开发版前端静态资源 ==="
cd ../frontend
npm install
npm run build

echo "=== 4. 同步至开发环境 Nginx 路径 ==="
sudo mkdir -p /var/www/battle100/dev
sudo cp -r dist/* /var/www/battle100/dev/
sudo chown -R www-data:www-data /var/www/battle100/dev/

echo "🎉 开发环境 (8080端口) 更新完成，已全部生效！"
