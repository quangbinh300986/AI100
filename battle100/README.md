# 百日奋战管理系统

> 奋战一百天，亮剑破六千！

## 项目说明

中地顾问「百日奋战」经营目标冲刺管理系统，包含：

- 📱 **移动端** (`/m/`) - 员工每日填报、查看目标、排名
- 💻 **管理端** (`/admin/`) - 管理后台（用户管理、目标管理、审核等）
- 🖥️ **大屏端** (`/screen/`) - 4K数据战情看板

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vite + React 18 + TypeScript + Ant Design 5 + ECharts 5 |
| 后端 | Python FastAPI + SQLAlchemy 2.0 |
| 数据库 | PostgreSQL 16 + Redis 7 |
| 部署 | Docker Compose + Nginx |

## 快速启动

```bash
# 启动所有服务
docker-compose up -d

# 访问地址
# 移动端: http://localhost/m/
# 管理端: http://localhost/admin/
# 大屏端: http://localhost/screen/
# API文档: http://localhost:8000/docs
```

## 项目结构

```
battle100/
├── backend/          # FastAPI 后端
├── frontend/         # React 前端(三SPA)
├── nginx/            # Nginx 配置
├── docker-compose.yml
└── README.md
```
