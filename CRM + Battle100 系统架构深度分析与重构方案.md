# CRM + Battle100 系统架构深度分析与重构方案

## 一、系统全景架构

```mermaid
graph TB
    subgraph "Battle100 系统 (Python/FastAPI + PostgreSQL)"
        B_Broadcast["播报系统<br/>broadcast.py (1800行)"]
        B_Dashboard["作战大屏<br/>dashboard.py (4543行)"]
        B_Reports["日报/周报<br/>reports.py (2323行)"]
        B_DingTalk["钉钉推送<br/>dingtalk.py"]
        B_DB[("Battle100 DB<br/>PostgreSQL<br/>AI100")]
    end

    subgraph "CRM 系统 (Java/Spring Boot 2.5.5 + MySQL)"
        C_Modules["15个业务模块<br/>60+ RestController"]
        C_MyBatis["MyBatis-Plus ORM"]
        C_DB[("CRM DB<br/>MySQL<br/>gzzdpm")]
    end

    subgraph "外部集成"
        JYKJ["经营会计系统<br/>10.40.0.119:6061"]
        ZDPM["项目管理系统<br/>10.50.0.131:8080"]
        DingTalk["钉钉"]
        Screen["大屏播报"]
    end

    B_Broadcast -->|"pymysql.connect() 直连"| C_DB
    B_Dashboard -->|"pymysql.connect() 直连"| C_DB
    B_Reports -->|"SQLAlchemy (mysql+pymysql)"| C_DB
    B_DingTalk -->|"SQLAlchemy (mysql+pymysql)"| C_DB
    
    B_Broadcast -->|推送| DingTalk
    B_Broadcast -->|WebSocket| Screen

    C_Modules -->|HTTP API| JYKJ
    C_Modules -->|HTTP API| ZDPM
    C_Modules -->|SDK| DingTalk
```

> [!IMPORTANT]
> **关键发现**：Battle100 与 CRM 的集成完全依赖 **直连 MySQL 数据库** + **原生SQL**，没有调用 CRM 的 REST API，也没有通过 Webhook 事件驱动。`crm_client.py` 中的 HTTP 客户端方法全部为 TODO 占位实现。

---

## 二、CRM 数据库完整表结构（68+张表）

### 技术栈
| 项目 | 技术 |
|------|------|
| 数据库 | **MySQL** (连接池: Druid) |
| 数据库名 | `gzzdpm`（开发: `10.50.0.137:3306`） |
| ORM | MyBatis-Plus 3.4.3.1 |
| 后端框架 | Spring Boot 2.5.5 + Java 1.8 |
| 基础框架 | 非RuoYi，自研(`net.ghsoft.zdcrm`) |
| 前端 | Vue.js + TypeScript + Vite |
| 缓存 | Redis + Redisson |
| 搜索 | Elasticsearch 7.14 (Easy-ES) |

---

### A. 合同管理（核心业务）

#### `contract` — 合同表 ★ 最核心大表（621行字段定义）
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint | 主键 |
| `contract_name` | varchar | 合同名称 |
| `contract_no` | varchar | 合同编号 |
| `contract_money` | decimal | 合同金额(**元**) |
| `contract_money_wy` | decimal | 合同金额(**万元**) |
| `cooperation_money` | decimal | 合作费 |
| `signer` | varchar | 签署人姓名 |
| `signer_code` | varchar | 签署人编码 |
| `signing_date` | date | 签署日期 |
| `signing_date_year` | varchar | 签署年份 |
| `contract_type` | varchar | 合同类型 |
| `contract_status` | varchar | 合同状态(已签订/实施中/已验收) |
| `is_suspension` | char | 是否中止('0'/'1') |
| `suspension_year` | varchar | 中止年份 |
| `owner` | bigint | 甲方客户ID |
| `owner_name` | varchar | 甲方名称 |
| `office_code` | varchar | 部门编码 |
| `office_name` | varchar | 部门名称 |
| `market_office_code` | varchar | 营销巴编码 |
| `count_status` | varchar | 是否加入统计 |
| `is_inside_contract` | varchar | 是否参与KPI统计 |
| `audit_status` | varchar | 审核状态(0未审核/1审核中/2已审核/3已撤销) |
| `contract_head_user` | varchar | 合同负责人 |
| `province`/`city`/`district` | varchar | 区域信息 |
| `status` | char | 数据状态('0'正常) |

#### `contract_money` — 合同分期款项表
| 字段 | 说明 |
|---|---|
| `id` | 主键 |
| `contract_id` | 关联合同 |
| `installment_money` | 分期金额 |
| `invoic_status` | 开票状态(NULL/''/'0'未开票) |
| `status` | 状态 |
| `years` | 年份 |
| `receive_date` | 收款日期 |
| `responsible_person` | 催款责任人 |

#### `contract_money_exempt` — 合同免收金额表
| 字段 | 说明 |
|---|---|
| `contract_id` / `contract_money_id` | 关联合同/分期 |
| `amount` | 免收金额 |
| `exempt_type` | 免收类型 |
| `audit_status` | 审核状态(申请→确认→作废) |

#### `contract_project` — 合同-项目关联表
| 字段 | 说明 |
|---|---|
| `contract_id` | 合同ID |
| `project_id` | 项目ID |

---

### B. 回款/到账管理 ★ 播报扩展重点

#### `zdcrm_contract_receive_money_view` — 回款金额视图（VIEW）
| 字段 | 类型 | 说明 |
|---|---|---|
| `money` | decimal | 到账净额(**万元**) |
| `receive_money` | decimal | 到账金额(**万元**) |
| `contract_id` | bigint | 合同ID |
| `year` / `month` | varchar | 年/月 |
| `contract_name` | varchar | 合同名称 |
| `contract_no` | varchar | 合同编号 |
| `contract_type` | varchar | 合同类型 |
| `contract_money` | decimal | 合同金额 |
| `office_code` | varchar | 部门编码 |
| `receive_date` | date | 到账日期 |
| `owner` | varchar | 客户 |

> [!NOTE]
> 回款视图底层关联了4张表：`contract_pay_in`(到账记录)、`contract_account_bill`(账户账单)、`contract_money`(分期款项)、`contract_money_allocate`(款项分配)

#### `contract_money_feedback_detail_reviewer` — 到账反馈-反馈人表
| 字段 | 说明 |
|---|---|
| `contract_money_id` | 关联分期款 |
| `feedback_content` | 反馈内容 |
| `follow_way` | 跟进方式 |
| `expected_arrive_date` | 预计到账日期 |
| `expected_arrive_money` | 预计到账金额 |

#### `contract_un_receive_bill_not_receive` — 已开票未到账表
| 字段 | 说明 |
|---|---|
| `contract_id` | 合同ID |
| `bill_money` | 开票金额 |
| `un_account_money` | 未到账金额 |
| `bill_create_date` | 开票日期 |

---

### C. 产值/业绩管理 ★ 播报扩展重点

#### `dashboard_production` — 产值数据表
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint | 主键 |
| `project_id` | bigint | 项目ID |
| `money` | decimal | 产值金额(**元**) |
| `createDate` | date | 创建日期 |
| `account_date` | date | 账期日期 |
| `isDel` | char | 删除标记 |
| `start_progress` | int | 起始进度 |
| `end_progress` | int | 结束进度 |
| `progress_change` | int | 进度变化 |

#### `dashboard_signed` — 新签数据表
| 字段 | 说明 |
|---|---|
| 部门/金额/核算日期 | 新签统计维度 |

#### `dashboard_account` — 到账数据表
| 字段 | 说明 |
|---|---|
| 部门/金额/核算日期 | 到账统计维度 |

#### `zdcrm_target_plan_management` — 营销计划目标管理表
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint | 主键 |
| `type` | int | 类型: 0新签 / 1回款 |
| `bus_id` | bigint | 关联业务ID |
| `new_sign_target_amount` | decimal | 新签目标金额 |
| `new_sign_actual_amount` | decimal | 新签实际金额 |
| `receive_target_amount` | decimal | 回款目标金额 |
| `receive_actual_amount` | decimal | 回款实际金额 |
| `responsible_person_alias` | varchar | 催款人 |
| `year` / `month` | varchar | 年/月 |
| `is_terminated` | char | 是否中止 |
| `is_key_project` | char | 是否关键项目 |
| `action_strategy` | text | 行动策略 |

---

### D. 商机/潜力项目管理

#### `zdcrm_business_opportunity` — 商机/潜力项目表
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint | 主键 |
| `name` | varchar | 业务信息/项目名 |
| `customer_id` | bigint | 客户ID |
| `customer_name` | varchar | 业主单位 |
| `budget_money` | decimal | 项目预算(**万元**) |
| `expect_money` | decimal | 预计获取金额(**万元**) |
| `progress` | int | 当前进度: 5/10/25/50/75/100 |
| `feed_back_user_id` | bigint | 反馈人 |
| `market_user_id` | bigint | 营销人员ID |
| `market_office_code` | varchar | 营销巴编码 |
| `is_suspension` | char | 是否中止 |
| `contract_status` | varchar | 合同状态 |
| `data_source` | varchar | 项目来源 |
| `plan_sign_date` | date | 计划签订时间 |
| `technical_user_id` | bigint | 项目技术负责人 |
| `province`/`city`/`district` | varchar | 区域 |

#### 商机相关辅助表
| 表名 | 说明 |
|---|---|
| `zdcrm_business_opportunity_pending` | 待审核商机 |
| `zdcrm_business_opportunity_progress_history` | 进度变更历史 |
| `zdcrm_business_opportunity_undertake` | 承接部门 |
| `zdcrm_business_follow` | 业务跟进记录 |

---

### E. 项目管理

#### `project` — 项目表
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint | 主键 |
| `project_name` | varchar | 项目名称 |
| `project_manager` | varchar | 项目经理(姓名) |
| `project_progress` | int | 项目进度(0-100) |
| `project_status` | varchar | 项目状态(已归档/已结项/3等) |
| `stop_status` | char | 暂停状态('1'暂停) |
| `contract_status` | char | 合同状态('0'未签) |

#### `task` — 项目任务/里程碑表
| 字段 | 说明 |
|---|---|
| `name` | 任务名 |
| `project_id` | 关联项目 |
| `finish_date` | 完成日期 |
| `status` | 状态('0'已完成) |
| `milestone` | 里程碑标记('1'为里程碑) |

---

### F. 客户管理

| 表名 | 说明 |
|---|---|
| `crm_customer` | 客户信息表(名称/地址/类型/省市区/行业/大客户标识) |
| `crm_contacts` | 客户联系人表 |
| `zdcrm_customer_list` | 客户汇总列表(合同额/回款/投标数/中标数) |
| `zdcrm_customer_big` | 大客户表 |
| `crm_customer_year_category` | 客户年度A/B/C/D分类 |
| `zdcrm_visit_customer_record` | 客户拜访记录(事项类型/进展/协助内容/工时) |
| `zdcrm_visit_clock_in` | 拜访签到打卡 |
| `zdcrm_visit_frequency_setting` | 拜访频次设定 |

---

### G. 招投标管理

| 表名 | 说明 |
|---|---|
| `zdcrm_tender_win_project_cache` | 中标项目缓存表 |
| `tender_base_info` | 招标基本信息(Battle100直连查询) |
| `tender_company_info` | 投标公司信息(Battle100直连查询) |

---

### H. 经营分析/仪表盘

| 表名 | 说明 |
|---|---|
| `dashboard_account` | 到账数据 |
| `dashboard_expense` | 费用数据 |
| `dashboard_receivables` | 应收账款 |
| `dashboard_signed` | 新签数据 |
| `zdcrm_operate_dept_statistic` | 部门统计 |
| `zdcrm_operate_market_statistic` | 营销统计 |
| `zdcrm_operate_area_type_statistic` | 区域类型统计 |
| `zdcrm_operate_business_format_statistic` | 业态统计 |

---

### I. SQL 视图（17个）

CRM 中定义了大量数据库视图来简化复杂查询：

| 视图 | 说明 | Battle100是否使用 |
|---|---|---|
| `zdcrm_contract_receive_money_view` | **合同回款金额** | ✅ 已使用 |
| `zdcrm_contract_signing_list` | 合同签订列表 | ❌ |
| `zdcrm_contract_installment_unbilled_list` | 达标准未开票 | ❌ |
| `zdcrm_contract_receive_date_money_view` | 回款日期金额 | ❌ |
| `zdcrm_contract_area_view` | 合同区域 | ❌ |
| `zdcrm_contract_unaccount_money_list` | 未到账列表 | ❌ |
| `zdcrm_contract_production_operational` | 合同产值经营 | ❌ |
| `zdcrm_contract_account_operational` | 合同到账经营 | ❌ |
| `zdcrm_contract_singe_operational` | 合同签约经营 | ❌ |
| `zdcrm_customer_analysis` | 客户分析 | ❌ |
| `zdcrm_customer_contacts` | 客户联系人 | ❌ |
| `zdcrm_customer_project_view` | 客户项目 | ❌ |
| `zdcrm_tender_win_project_view` | 中标项目 | ❌ |

> [!TIP]
> 这些视图是CRM已经整理好的业务数据聚合，Battle100 可以直接利用，无需重复编写复杂SQL。

---

## 三、Battle100 现有系统分析

### 3.1 播报系统现状

#### 当前支持的6种播报事件

| 事件类型 | 枚举值 | 触发方式 | 说明 |
|---|---|---|---|
| 有效线索确定 | `lead_25` | CRM直连查询 | 商机进度25% |
| 中标确定 | `lead_75` | CRM直连查询 | 商机进度75% |
| 合同签订 | `contract_signed` | CRM直连查询 | 双方盖章完成 |
| 铁三角联动 | `triangle` | 手动录入 | 售前联动 |
| 幸福行动 | `happiness` | 手动录入 | 客户满意度 |
| 自定义播报 | `custom` | 手动录入 | 自由录入 |

#### 播报创建完整流程

```mermaid
sequenceDiagram
    participant User as 用户/CRM
    participant Broadcast as 播报模块
    participant Report as 日报模块
    participant DT as 钉钉
    participant WS as WebSocket大屏

    User->>Broadcast: POST /api/v1/broadcast
    Note right of Broadcast: 1. 创建 BroadcastEvent
    Note right of Broadcast: 2. 按北京时间20:00分水岭<br/>决定日报归属日期
    
    alt contract_signed 类型
        Broadcast->>Broadcast: 解析 delivery_allocations<br/>+ marketing_allocations
        loop 每个分摊用户
            Broadcast->>Report: get_or_create_report(user, date)
            Report->>Report: 创建 DailyReport(REVIEWED)
            Report->>Report: 创建 ReportDetail(CONTRACT)
            Note right of Report: description 末尾追加<br/>[broadcast_id:xxx]
        end
    end
    
    Broadcast->>DT: trigger_broadcast_push() 异步推送
    Broadcast->>WS: 广播通知大屏刷新
```

#### 双轨分摊机制（contract_signed 类型）

```
播报金额 = 100万
├── delivery_allocations（交付分摊）
│   ├── 用户A: 30%  → 30万 → 标注【交付新签分摊(30%)】
│   └── 用户B: 70%  → 70万 → 标注【交付新签分摊(70%)】
└── marketing_allocations（营销分摊）
    ├── 用户C: 50%  → 50万 → 标注【营销新签分摊(50%)】
    └── 用户D: 50%  → 50万 → 标注【营销新签分摊(50%)】
```

#### 播报 ↔ 日报的关联与级联

- **正向关联**：`ReportDetail.description` 末尾追加 `\n[broadcast_id:{id}]`
- **反向级联**：删除/修改播报时，通过 `LIKE '%\n[broadcast_id:{id}]'` 查找关联明细
- **扣减逻辑**：从 `DailyReport` 主表扣除对应的统计字段值

---

### 3.2 Battle100 直连 CRM 的15+张表

| CRM表 | 使用位置 | 连接方式 | 用途 |
|---|---|---|---|
| `zdcrm_business_opportunity` | broadcast, dashboard | pymysql | 商机/线索漏斗 |
| `tender_base_info` | broadcast | pymysql | 中标项目 |
| `tender_company_info` | broadcast | pymysql | 中标公司 |
| `contract` | broadcast, reports | 两种 | 合同签约 |
| `crm_customer` | broadcast | pymysql | 客户信息 |
| `bus_address` | broadcast | pymysql | 地址信息 |
| `project` | reports, dingtalk | SQLAlchemy | 项目进度 |
| `task` | reports | SQLAlchemy | 里程碑 |
| `dashboard_production` | reports, dingtalk | SQLAlchemy | 产值 |
| `zdcrm_contract_receive_money_view` | reports, dingtalk | SQLAlchemy | 回款 |
| `zdcrm_visit_customer_record` | reports | SQLAlchemy | 拜访记录 |
| `zdcrm_target_plan_management` | reports | SQLAlchemy | 目标计划 |
| `js_sys_user` | broadcast | pymysql | 用户映射 |
| `contract_money_urge_notify_project` | reports | SQLAlchemy | 催款触发 |
| `contract_money` | reports | SQLAlchemy | 分期款项 |
| `contract_un_receive_bill_not_receive` | reports | SQLAlchemy | 未到账 |
| `contract_project` | reports | SQLAlchemy | 合同-项目关联 |

> [!WARNING]
> Battle100 存在**两种CRM连接方式混用**的问题：
> - `broadcast.py` / `dashboard.py` → 使用 `pymysql.connect()` 直连
> - `reports.py` / `dingtalk.py` → 使用 SQLAlchemy 同步引擎 (`get_crm_db()`)
> 
> 这导致连接池管理混乱，且所有查询都是原生SQL字符串拼接，改表名即全面失效。

---

### 3.3 Battle100 数据模型（16张表）

| 表名 | 说明 |
|---|---|
| `users` | 用户(姓名/角色/岗位/战队/CRM关联) |
| `role_permissions` | 角色权限 |
| `zones` | 战区 |
| `teams` | 战队(含CRM部门编码) |
| `daily_reports` | 日报主表 |
| `report_details` | 日报明细(合同/幸福/铁三角/线索) |
| `weekly_reports` | 个人周报 |
| `group_weekly_reports` | 团队整体周报 |
| `broadcast_events` | 播报事件 |
| `personal_goals` | 个人目标(8种) |
| `team_goals` | 战队目标(营销/交付双轨) |
| `weekly_targets` | 周度目标(保底+挑战) |
| `happiness_standards` | 幸福标准 |
| `lead_conversions` | 线索转化率 |
| `audit_logs` | 审计日志 |
| `llm_providers/models/routes` | AI模型配置 |

---

## 四、现有架构的七大局限性

### ① 播报类型严重不足
当前仅支持6种播报（合同签订、中标、线索、铁三角、幸福、自定义），缺少：
- **回款到账播报** — CRM 已有 `zdcrm_contract_receive_money_view` 和 `contract_money_feedback` 完整的回款流程
- **产值确认播报** — CRM 已有 `dashboard_production` 产值数据
- **开票播报** — CRM 已有 `contract_money` 分期开票状态
- **投标播报** — CRM 已有 `tender_base_info` 投标信息

### ② CRM 集成架构脆弱
- 散布在4个文件中的 **原生SQL字符串** 直接查询CRM的MySQL库
- 两种连接方式混用（pymysql直连 + SQLAlchemy），连接池管理混乱
- CRM改表/改字段名，Battle100 中所有查询全部失效，无编译期检查

### ③ 数据同步全靠直连
- **无Webhook机制**：CRM端没有任何向Battle100推送事件的代码
- **无定时同步**：没有定时任务主动拉取CRM变更
- **全量查询**：每次都是全表扫描，无增量同步机制
- `crm_client.py` HTTP客户端全部方法为 TODO 占位，实际未使用

### ④ 用户映射不可靠
- Battle100 通过 `js_sys_user.nick_name` 与 `users.name` 文本匹配
- 无唯一标识关联，改名即失效

### ⑤ 金额单位混乱
| 来源 | 单位 |
|---|---|
| CRM `contract.contract_money` | **元** |
| CRM `contract.contract_money_wy` | **万元** |
| CRM `zdcrm_business_opportunity.budget_money` | **万元** |
| CRM `dashboard_production.money` | **元** |
| CRM `zdcrm_contract_receive_money_view.money` | **万元** |
| Battle100 `DailyReport.contract_amount` | **万元** |

> 转换逻辑散布在多处代码中，之前已经出现过"亿元"的bug。

### ⑥ 缺乏事件驱动架构
CRM 中的业务事件（合同审批通过、回款确认、产值录入）没有统一的事件通知机制。

### ⑦ 项目全生命周期视角缺失
当前系统只关注"签约""线索"等营销维度，缺少：商机→投标→签约→执行→开票→回款→结项 的完整链路追踪。

---

## 五、分阶段重构方案

### 第一阶段：扩展播报系统（1-2周）

> [!TIP]
> **最小改动，最快见效。** 在现有架构上扩展播报类型，直连CRM查询新数据。

#### 1.1 新增播报事件类型

```python
# app/models/broadcast.py — EventType 枚举扩展
class EventType(str, enum.Enum):
    # === 已有 ===
    LEAD_25 = "lead_25"                 # 有效线索
    LEAD_75 = "lead_75"                 # 中标
    CONTRACT_SIGNED = "contract_signed" # 合同签订
    TRIANGLE = "triangle"               # 铁三角
    HAPPINESS = "happiness"             # 幸福行动
    CUSTOM = "custom"                   # 自定义
    # === 新增 ===
    RECEIVABLE = "receivable"           # 回款到账
    PRODUCTION_VALUE = "production_value" # 产值确认
    INVOICE = "invoice"                 # 开票
```

#### 1.2 新增日报明细类型 + 字段

```python
# app/models/report.py
class DetailType(str, enum.Enum):
    # 已有: CONTRACT, HAPPINESS, TRIANGLE, LEAD
    RECEIVABLE = "receivable"     # 回款明细
    PRODUCTION = "production"     # 产值明细

# DailyReport 新增字段
receivable_amount = Column(Float, default=0, comment="当日回款金额（万元）")
receivable_count = Column(Integer, default=0, comment="当日回款笔数")
production_amount = Column(Float, default=0, comment="当日产值金额（万元）")
```

#### 1.3 播报创建端新增 CRM 查询端点

| 新端点 | CRM表/视图 | 功能 |
|---|---|---|
| `GET /crm-receivables` | `zdcrm_contract_receive_money_view` | 查询近期回款记录 |
| `GET /crm-production` | `dashboard_production` JOIN `project` | 查询产值确认数据 |
| `GET /crm-invoices` | `contract_money` WHERE invoic_status | 查询开票记录 |

#### 1.4 大屏仪表盘新增维度

在 `dashboard.py` 的 KPI 汇总卡片中新增：
- **累计回款额** — 从 `zdcrm_contract_receive_money_view` 统计
- **累计确认产值** — 从 `dashboard_production` 统计
- **回款排行榜** — 个人/战队维度

#### 修改文件清单

| 文件 | 修改内容 |
|---|---|
| [broadcast.py](file:///c:/APP/AI100/battle100/backend/app/models/broadcast.py) 模型 | 新增 EventType 枚举值 |
| [report.py](file:///c:/APP/AI100/battle100/backend/app/models/report.py) 模型 | 新增 DetailType + DailyReport 字段 |
| [broadcast.py](file:///c:/APP/AI100/battle100/backend/app/api/broadcast.py) API | 新增CRM查询端点 + 回款/产值播报创建逻辑 |
| [dashboard.py](file:///c:/APP/AI100/battle100/backend/app/api/dashboard.py) API | 新增回款/产值统计维度 |
| [reports.py](file:///c:/APP/AI100/battle100/backend/app/api/reports.py) API | 日报提交时处理新明细类型 |

---

### 第二阶段：构建 CRM 数据抽象层（2-4周）

> [!IMPORTANT]
> 用统一的数据访问层替代散布在4个文件中的80+处原生SQL，提高可维护性和安全性。

#### 2.1 统一 CRM 连接管理

```python
# 重构 app/database.py
# 统一使用 SQLAlchemy 异步引擎连接 CRM MySQL
# 废弃 broadcast.py 和 dashboard.py 中的 pymysql.connect() 直连
crm_engine = create_async_engine(
    "mysql+aiomysql://root:xxx@10.50.0.137:3306/gzzdpm",
    pool_size=5, max_overflow=10
)
```

#### 2.2 创建 CRM 只读 ORM 模型

```python
# 新建 app/models/crm.py
class CrmContract(CrmBase):
    __tablename__ = "contract"
    id: Mapped[int]
    contract_name: Mapped[str]
    contract_money: Mapped[Decimal]      # 元
    contract_money_wy: Mapped[Decimal]   # 万元
    signer: Mapped[str]
    signing_date: Mapped[date]
    ...

class CrmBusinessOpportunity(CrmBase):
    __tablename__ = "zdcrm_business_opportunity"
    ...

class CrmReceivableView(CrmBase):
    __tablename__ = "zdcrm_contract_receive_money_view"
    ...

class CrmProduction(CrmBase):
    __tablename__ = "dashboard_production"
    ...
```

#### 2.3 创建 CRM 服务层

```python
# 新建 app/services/crm_service.py
class CrmService:
    """统一 CRM 数据访问，所有金额自动转为万元"""

    async def get_receivables(self, user_name: str, start: date, end: date):
        """查询指定用户的回款记录"""

    async def get_production_values(self, user_name: str, start: date, end: date):
        """查询指定用户的产值"""

    async def get_contracts(self, signer: str, year: str):
        """查询合同列表"""

    async def get_opportunities(self, progress: int):
        """查询指定进度的商机"""
```

#### 2.4 建立可靠的用户映射

```python
# 新建 app/models/user_mapping.py
class UserMapping(BaseModel):
    __tablename__ = "user_mappings"
    battle100_user_id: Mapped[int]  # FK → users.id
    crm_user_code: Mapped[str]      # js_sys_user.user_code
    crm_user_name: Mapped[str]      # js_sys_user.user_name
```

---

### 第三阶段：重构项目/客户管理 + 事件驱动（1-3月）

> [!WARNING]
> 最大规模的改动，需要同时修改 CRM(Java) 和 Battle100(Python) 两个系统。建议前两阶段稳定后再启动。

#### 3.1 CRM 端添加事件推送

在 CRM 的 Service 层关键业务节点添加 HTTP 回调：

| CRM 模块 | 触发时机 | 推送到 Battle100 |
|---|---|---|
| `ContractController` | 合同审核通过 | `POST /api/v1/broadcast/webhook` |
| `ContractMoneyFeedbackController` | 回款到账确认 | `POST /api/v1/broadcast/webhook` |
| `DashboardController` | 产值数据同步后 | `POST /api/v1/broadcast/webhook` |
| `BusinessOpportunityController` | 商机进度变更 | `POST /api/v1/broadcast/webhook` |

#### 3.2 Battle100 端统一 Webhook 处理

```python
# broadcast.py — 统一事件处理器
@router.post("/webhook")
async def crm_webhook(payload: dict):
    event_type = payload["event_type"]
    handlers = {
        "contract_signed": handle_contract_signed,
        "receivable_confirmed": handle_receivable,
        "production_confirmed": handle_production,
        "opportunity_updated": handle_opportunity,
    }
    await handlers[event_type](payload)
```

#### 3.3 项目全生命周期追踪

```mermaid
graph LR
    A["商机发现<br/>5%-10%"] --> B["有效线索<br/>25%"]
    B --> C["投标<br/>50%"]
    C --> D["中标<br/>75%"]
    D --> E["合同签订<br/>90%-100%"]
    E --> F["项目执行<br/>产值确认"]
    F --> G["开票催款"]
    G --> H["回款到账"]
    H --> I["项目结项"]
    
    style A fill:#f9f,stroke:#333
    style E fill:#0f0,stroke:#333
    style H fill:#ff0,stroke:#333
```

每个阶段变更都触发播报，形成完整的业务闭环。

---

## 六、验证计划

### 第一阶段验证
- 在前端创建回款播报 → 验证日报自动生成回款明细
- 在前端创建产值播报 → 验证大屏显示产值排行
- 验证金额单位统一性

### 第二阶段验证
- 修改CRM表字段名 → 验证只需更新ORM映射
- 用户映射准确性测试
- 连接池压力测试

### 第三阶段验证
- 端到端项目全生命周期测试（从商机到回款）
- Webhook 可靠性测试（重试/幂等）

---

## 需用户确认的事项

> [!IMPORTANT]
> 1. **优先级**：三个阶段中，最希望先实现哪个？推荐从第一阶段开始。
> 2. **CRM 修改权限**：是否有 zdcrm Java 源码的修改和部署权限？第三阶段需要改 CRM 代码。
> 3. **回款播报场景**：回款到账时，是否需要像合同签订一样进行"分摊"？还是直接归属合同负责人？
> 4. **产值播报粒度**：产值是按月度汇总播报，还是每笔产值确认都单独播报？
> 5. **大屏展示**：回款/产值数据是否需要在作战大屏上新增独立的排行榜和趋势图？

## 开放问题

> [!WARNING]
> 1. CRM 数据库中 `zdcrm_contract_receive_money_view` 视图目前有多少数据？是否有2026年的实际回款记录？
> 2. CRM 的审批流程状态字段值：`audit_status` 的各个值含义（0/1/2/3）是否如我分析的那样？
> 3. CRM 的 `dashboard_production` 数据是从哪里同步来的？是经营会计系统(`10.40.0.119:6061`)推送的吗？
> 4. Battle100 用户与 CRM 用户的对应关系，除了名字匹配，是否有其他可靠的关联字段（如手机号、工号）？
> 5. 是否考虑将 CRM 的 MySQL 迁移到与 Battle100 相同的 PostgreSQL，简化运维？
