def sync_extract_crm_data(real_name: str, start_date_val: date, is_marketing: bool) -> dict:
    from datetime import timedelta
    from sqlalchemy import text
    
    monday = start_date_val
    sunday = start_date_val + timedelta(days=6)
    
    # 格式化日期参数
    start_date_str = monday.strftime('%Y-%m-%d')
    end_date_str = sunday.strftime('%Y-%m-%d 23:59:59')
    
    result = {
        "delivery_actual": "",
        "sales_actual": "",
        "delivery_rate": "",
        "sales_rate": "",
        "delivery_highlights": "",
        "sales_highlights": "",
        "delivery_blockers": "",
        "sales_blockers": "",
        "delivery_support": "",
        "sales_support": "",
        "next_delivery_plan": "",
        "next_sales_plan": "",
        "crm_active_projects": "",
        "crm_milestone_tasks": "",
        "crm_suspended_projects": "",
        "crm_no_contract_warning": "",
        "crm_unbilled_warning": "",
        "crm_unreceived_warning": "",
        "crm_health_diagnosis": ""
    }
    
    try:
        from app.database import get_crm_db
        with get_crm_db() as conn:
            # 1. 统计个人当周产值与回款（排除重置虚高账期影响）
            month_start_date = monday.replace(day=1)
            prev_month_start_date = (month_start_date - timedelta(days=15)).replace(day=1)
            
            prod_sql = text("""
                SELECT COALESCE(SUM(dp.money), 0) as total_prod
                FROM dashboard_production dp
                JOIN project p ON dp.project_id = p.id
                WHERE p.project_manager = :real_name
                  AND dp.createDate BETWEEN :start AND :end
                  AND dp.account_date IN (:prev_month_start, :month_start)
                  AND dp.isDel = '0'
            """)
            prod_val = conn.execute(prod_sql, {
                "real_name": real_name,
                "start": start_date_str + " 00:00:00",
                "end": end_date_str,
                "prev_month_start": prev_month_start_date.strftime('%Y-%m-%d'),
                "month_start": month_start_date.strftime('%Y-%m-%d')
            }).scalar() or 0.0
            personal_production = float(prod_val) / 10000.0 # 元转万元
            
            recv_sql = text("""
                SELECT COALESCE(SUM(r.receive_money), 0) as total_recv
                FROM zdcrm_contract_receive_money_view r
                INNER JOIN contract c ON r.contract_id = c.id
                WHERE c.signer = :real_name
                  AND r.receive_date BETWEEN :start_date AND :end_date
            """)
            recv_val = conn.execute(recv_sql, {
                "real_name": real_name,
                "start_date": start_date_str,
                "end_date": end_date_str
            }).scalar() or 0.0
            personal_receive = float(recv_val) # 万元
            
            # 2. 统计个人名下正在实施项目并诊断饱和度预警
            active_projects_sql = text("""
                SELECT project_name, project_progress, project_status
                FROM project
                WHERE project_manager = :real_name
                  AND project_progress < 100.0
                  AND (project_status IS NULL OR (project_status != '已归档' AND project_status != '已结项' AND project_status != '3'))
            """)
            active_projects = conn.execute(active_projects_sql, {"real_name": real_name}).mappings().all()
            
            personal_warnings = []
            active_count = len(active_projects)
            
            if active_count == 0 and not is_marketing:
                personal_warnings.append("🚨 红色警报：您目前名下无任何活跃正在实施的交付项目，需立即核实饱和度并协调新项目分配！")
            else:
                # 检查项目本周是否进度停滞（无任何异动）
                p_change_sql = text("""
                    SELECT COUNT(*)
                    FROM dashboard_production dp
                    JOIN project p ON dp.project_id = p.id
                    WHERE p.project_manager = :real_name
                      AND dp.createDate BETWEEN :start AND :end
                      AND dp.account_date IN (:prev_month_start, :month_start)
                      AND dp.isDel = '0'
                """)
                change_count = conn.execute(p_change_sql, {
                    "real_name": real_name,
                    "start": start_date_str + " 00:00:00",
                    "end": end_date_str,
                    "prev_month_start": prev_month_start_date.strftime('%Y-%m-%d'),
                    "month_start": month_start_date.strftime('%Y-%m-%d')
                }).scalar() or 0
                
                if change_count == 0 and not is_marketing:
                    personal_warnings.append("⚠️ 黄色预警：名下正在实施项目本周进度停滞（无任何进度条推进记录），请在下方补充卡点或原因说明！")
                
                # 检查空仓风险
                all_near_complete = True
                for ap in active_projects:
                    progress_val = ap['project_progress']
                    try:
                        progress_val_float = float(progress_val) if progress_val is not None else 0.0
                    except Exception:
                        progress_val_float = 0.0
                    if progress_val_float < 90.0:
                        all_near_complete = False
                        break
                
                if active_count <= 2 and all_near_complete and not is_marketing:
                    personal_warnings.append(f"💡 风险提示：目前仅有 {active_count} 个正在实施项目且进度均已接近完成（当前进度≥90%），面临项目断档空仓风险，请尽快联系巴长安排新项目储备！")

            # 业绩快照与预警文本前缀准备
            perf_snapshot = (
                f"【📊 CRM 本周业绩快照】：累计确认产值 {personal_production:.2f} 万元，实际到账回款 {personal_receive:.2f} 万元。\n\n"
            )
            warning_text = ""
            if personal_warnings:
                warning_text = "【🚨 个人工作饱和度与项目健康度诊断】：\n" + "\n".join([f"  * {w}" for w in personal_warnings]) + "\n\n"

            # 3. 提取计划达成率说明 (根据 responsible_person_alias 匹配当前人在当月的目标)
            target_sql = text("""
                SELECT 
                    SUM(new_sign_target_amount) as target_sign, 
                    SUM(new_sign_actual_amount) as actual_sign,
                    SUM(receive_target_amount) as target_receive, 
                    SUM(receive_actual_amount) as actual_receive
                FROM zdcrm_target_plan_management
                WHERE (responsible_person_alias = :real_name OR create_by = :real_name)
                  AND year = :year AND month = :month
                  AND is_del = '0'
            """)
            target_rows = conn.execute(target_sql, {
                "real_name": real_name,
                "year": monday.year,
                "month": monday.month
            }).mappings().all()
            
            rate_desc = ""
            if target_rows and target_rows[0]["target_sign"] is not None:
                row = target_rows[0]
                t_sign = float(row["target_sign"])
                a_sign = float(row["actual_sign"]) if row["actual_sign"] else 0.0
                t_recv = float(row["target_receive"])
                a_recv = float(row["actual_receive"]) if row["actual_receive"] else 0.0
                
                sign_rate = f"{(a_sign / t_sign * 100):.1f}%" if t_sign > 0 else "—"
                recv_rate = f"{(a_recv / t_recv * 100):.1f}%" if t_recv > 0 else "—"
                
                if is_marketing:
                    rate_desc = f"月度销售新签达成率：{sign_rate} (实际 {a_sign:.1f}万 / 目标 {t_sign:.1f}万)；月度回款达成率：{recv_rate} (实际 {a_recv:.1f}万 / 目标 {t_recv:.1f}万)"
                else:
                    rate_desc = f"本月累计新签达成：{sign_rate}，回款达成：{recv_rate}"
            
            if is_marketing:
                result["sales_rate"] = rate_desc or "月度新签与回款指标正在统计中"
                result["delivery_rate"] = ""
            else:
                result["delivery_rate"] = rate_desc or "月度指标正在统计中"
                result["sales_rate"] = ""
                
            if is_marketing:
                # 2. 营销岗：新签合同 actual
                contract_sql = text("""
                    SELECT contract_name, contract_money 
                    FROM contract 
                    WHERE signer = :real_name 
                      AND signing_date BETWEEN :start_date AND :end_date 
                      AND (is_suspension IS NULL OR is_suspension != '1')
                """)
                contracts = conn.execute(contract_sql, {
                    "real_name": real_name,
                    "start_date": start_date_str,
                    "end_date": end_date_str
                }).mappings().all()
                
                sales_list = []
                c_idx = 1
                if contracts:
                    sales_list.append("本周正式签约合同项目如下：")
                    for c in contracts:
                        # 原始单位为“元”，需除以10000转换为“万元”
                        c_money_val = float(c['contract_money']) / 10000.0 if c['contract_money'] is not None else 0.0
                        sales_list.append(f"  {c_idx}) 【{c['contract_name']}】签署成功，金额：{c_money_val:.2f} 万元")
                        c_idx += 1
                
                # 3. 营销岗：实际回款 actual
                receive_sql = text("""
                    SELECT r.contract_name, r.receive_money, r.receive_date 
                    FROM zdcrm_contract_receive_money_view r
                    INNER JOIN contract c ON r.contract_id = c.id
                    WHERE c.signer = :real_name 
                      AND r.receive_date BETWEEN :start_date AND :end_date
                """)
                receives = conn.execute(receive_sql, {
                    "real_name": real_name,
                    "start_date": start_date_str,
                    "end_date": end_date_str
                }).mappings().all()
                
                if receives:
                    if not sales_list:
                        sales_list.append("本周到账回款明细：")
                    else:
                        sales_list.append("\n本周到账回款明细：")
                    for r in receives:
                        sales_list.append(f"  {c_idx}) 【{r['contract_name']}】收到回款金额：{float(r['receive_money'] or 0):.2f} 万元，到账日期：{r['receive_date'].strftime('%m-%d') if r['receive_date'] else '—'}")
                        c_idx += 1
                
                # 4. 营销岗：客户跟进拜访 actual
                visit_sql = text("""
                    SELECT customer_name, remark, create_time 
                    FROM zdcrm_visit_customer_record 
                    WHERE (create_by = :real_name OR update_by = :real_name)
                      AND create_time BETWEEN :start_date AND :end_date
                      AND is_del = '0'
                    ORDER BY create_time ASC
                """)
                visits = conn.execute(visit_sql, {
                    "real_name": real_name,
                    "start_date": start_date_str,
                    "end_date": end_date_str
                }).mappings().all()
                
                if visits:
                    if not sales_list:
                        sales_list.append("本周拜访/跟进客户动作明细：")
                    else:
                        sales_list.append("\n本周拜访/跟进客户动作明细：")
                    for v in visits:
                        t_str = v['create_time'].strftime('%m-%d') if v['create_time'] else '—'
                        sales_list.append(f"  {c_idx}) 【{t_str}】对接拜访【{v['customer_name']}】(工作记录：{v['remark'] or '未填'})")
                        c_idx += 1
                
                formatted_sales = perf_snapshot + ("\n".join(sales_list) if sales_list else "1. 本周暂无相关的合同新签、到账回款与客户拜访登记。")
                result["sales_actual"] = formatted_sales
                result["delivery_actual"] = ""
                
                # 5. 亮点与卡点智能提取
                highlight_list = []
                blocker_list = []
                
                # 如果有大额签约
                h_idx = 1
                for c in contracts:
                    # 原始单位为“元”，需除以10000转换为“万元”
                    c_money_val = float(c['contract_money']) / 10000.0 if c['contract_money'] is not None else 0.0
                    if c_money_val >= 50.0:
                        highlight_list.append(f"  {h_idx}) 成功签订大额合同：【{c['contract_name']}】（金额：{c_money_val:.2f}万元）")
                        h_idx += 1
                
                if len(visits) >= 3:
                    highlight_list.append(f"  {h_idx}) 本周客户对接频次较高，累计完成 {len(visits)} 次客户拜访与商务洽谈")
                    h_idx += 1
                
                # 卡点检查
                terminated_sql = text("""
                    SELECT remark, action_strategy 
                    FROM zdcrm_target_plan_management
                    WHERE (responsible_person_alias = :real_name OR create_by = :real_name)
                      AND is_terminated = '1' AND is_del = '0'
                      AND year = :year AND month = :month
                """)
                term_projects = conn.execute(terminated_sql, {
                    "real_name": real_name,
                    "year": monday.year,
                    "month": monday.month
                }).mappings().all()
                
                b_idx = 1
                if term_projects:
                    for tp in term_projects:
                        blocker_list.append(f"  {b_idx}) CRM 中标注的中止/预警项目跟进阻碍（备注：{tp['remark'] or '无'}，应对策略：{tp['action_strategy'] or '暂无'}）")
                        b_idx += 1
                
                result["sales_highlights"] = "\n".join(highlight_list) if highlight_list else "1. 本周销售签约及商务拓展平稳推进。"
                result["sales_blockers"] = warning_text + ("\n".join(blocker_list) if blocker_list else "1. 目前名下意向商机及收款合同暂无重大异常阻碍。")
                result["delivery_highlights"] = ""
                result["delivery_blockers"] = ""
                
            else:
                # 6. 交付及其他岗：负责的项目与进度 update（筛选最近一个月内更新过进展且不是100%进展的项目）
                one_month_ago_dt = (monday - timedelta(days=30)).strftime('%Y-%m-%d 23:59:59')
                project_sql = text("""
                    SELECT project_name, project_progress, project_status 
                    FROM project 
                    WHERE project_manager = :real_name
                      AND (project_status IS NULL OR (project_status != '已归档' AND project_status != '已结项'))
                      AND project_progress < 100.0
                      AND update_date >= :one_month_ago
                """)
                projects = conn.execute(project_sql, {
                    "real_name": real_name,
                    "one_month_ago": one_month_ago_dt
                }).mappings().all()
                
                delivery_list = []
                d_idx = 1
                if projects:
                    delivery_list.append("目前负责跟进的正在实施项目进度情况如下：")
                    for p in projects:
                        delivery_list.append(f"  {d_idx}) 项目【{p['project_name']}】当前总体进度：{float(p['project_progress'] or 0):.1f}%")
                        d_idx += 1
                
                # 7. 里程碑任务实际完成情况
                task_sql = text("""
                    SELECT t.name as task_name, p.project_name, t.milestone 
                    FROM task t
                    INNER JOIN project p ON t.project_id = p.id
                    WHERE p.project_manager = :real_name
                      AND t.finish_date BETWEEN :start_date AND :end_date
                      AND t.status = '0'
                    ORDER BY t.finish_date ASC
                """)
                tasks = conn.execute(task_sql, {
                    "real_name": real_name,
                    "start_date": start_date_str,
                    "end_date": end_date_str
                }).mappings().all()
                
                if tasks:
                    if not delivery_list:
                        delivery_list.append("本周项目子任务及里程碑节点交付动作明细：")
                    else:
                        delivery_list.append("\n本周项目子任务及里程碑节点交付动作明细：")
                    for t in tasks:
                        m_tag = "【里程碑】" if t['milestone'] == '1' else ""
                        delivery_list.append(f"  {d_idx}) {m_tag}完成项目【{t['project_name']}】下的任务节点：【{t['task_name']}】")
                        d_idx += 1
                
                formatted_delivery = perf_snapshot + ("\n".join(delivery_list) if delivery_list else "1. 本周名下负责的正在实施项目推进平稳，无重大子任务或里程碑完成提交。")
                result["delivery_actual"] = formatted_delivery
                result["sales_actual"] = ""
                
                # 8. 亮点与卡点智能提取
                highlight_list = []
                blocker_list = []
                
                h_idx = 1
                m_tasks = [t for t in tasks if t['milestone'] == '1']
                if m_tasks:
                    highlight_list.append(f"  {h_idx}) 本周成功突破并攻克了 {len(m_tasks)} 个核心项目交付里程碑节点！")
                    h_idx += 1
                
                if len(tasks) >= 3:
                    highlight_list.append(f"  {h_idx}) 本周高效推进并完成了 {len(tasks)} 个项目子项任务交付，项目稳步实施中")
                    h_idx += 1
                
                # 卡点检查
                project_block_sql = text("""
                    SELECT project_name, remarks 
                    FROM project 
                    WHERE project_manager = :real_name
                      AND stop_status = '1'
                """)
                block_projects = conn.execute(project_block_sql, {"real_name": real_name}).mappings().all()
                b_idx = 1
                if block_projects:
                    for bp in block_projects:
                        blocker_list.append(f"  {b_idx}) 交付难点：项目【{bp['project_name']}】处于暂停或异常挂起状态（备注：{bp['remarks'] or '无'}）")
                        b_idx += 1
                
                # 预设立（超过一个月未签合同）项目检查
                presetup_block_sql = text("""
                    SELECT project_name, create_date 
                    FROM project 
                    WHERE project_manager = :real_name
                      AND (project_status IS NULL OR (project_status != '已归档' AND project_status != '已结项'))
                      AND (contract_status = '0' OR contract_status IS NULL)
                      AND create_date < :one_month_ago
                """)
                presetup_projects = conn.execute(presetup_block_sql, {
                    "real_name": real_name,
                    "one_month_ago": (monday - timedelta(days=30)).strftime('%Y-%m-%d 23:59:59')
                }).mappings().all()
                if presetup_projects:
                    for pp in presetup_projects:
                        c_date_str = pp['create_date'].strftime('%Y-%m-%d') if pp['create_date'] else '—'
                        blocker_list.append(f"  {b_idx}) 预设立预警：项目【{pp['project_name']}】已立项执行超过一个月，但目前仍未签订正式合同（立项时间：{c_date_str}）")
                        b_idx += 1
                
                # 8.2 已到交付节点还未开发票的项目
                unbilled_node_sql = text("""
                    SELECT DISTINCT p.project_name, p.project_progress, np.project_progress_trigger, cm.installment_money
                    FROM project p
                    INNER JOIN contract_money_urge_notify_project np ON p.id = np.project_id
                    INNER JOIN contract_money cm ON np.contract_money_id = cm.id
                    WHERE p.project_manager = :real_name
                      AND p.project_progress >= np.project_progress_trigger
                      AND (cm.invoic_status IS NULL OR cm.invoic_status = '' OR cm.invoic_status = '0')
                      AND (p.project_status IS NULL OR (p.project_status != '已归档' AND p.project_status != '已结项'))
                """)
                unbilled_projects = conn.execute(unbilled_node_sql, {"real_name": real_name}).mappings().all()
                if unbilled_projects:
                    for up in unbilled_projects:
                        # 原始单位为“元”，需除以10000转换为“万元”
                        money_val = float(up['installment_money']) / 10000.0 if up['installment_money'] is not None else None
                        money_str = f"{money_val:,.2f}" if money_val is not None else "—"
                        blocker_list.append(
                            f"  {b_idx}) 交付卡点：项目【{up['project_name']}】进度已达 {float(up['project_progress'] or 0):.1f}%"
                            f"（已达收付款触发节点 {float(up['project_progress_trigger'] or 0):.1f}%），"
                            f"但尚未开发票（本阶段合同款项：{money_str}万元）"
                        )
                        b_idx += 1
 
                # 8.3 已开发票还未到账的项目
                unreceived_bill_sql = text("""
                    SELECT DISTINCT p.project_name, br.bill_money, br.un_account_money, br.bill_create_date
                    FROM contract_un_receive_bill_not_receive br
                    INNER JOIN contract_project cp ON br.contract_id = cp.contract_id
                    INNER JOIN project p ON cp.project_id = p.id
                    WHERE p.project_manager = :real_name
                      AND br.un_account_money > 0
                      AND (p.project_status IS NULL OR (p.project_status != '已归档' AND p.project_status != '已结项'))
                """)
                unreceived_projects = conn.execute(unreceived_bill_sql, {"real_name": real_name}).mappings().all()
                if unreceived_projects:
                    for urp in unreceived_projects:
                        bill_money_str = f"{float(urp['bill_money']):,.2f}" if urp['bill_money'] is not None else "—"
                        un_money_str = f"{float(urp['un_account_money']):,.2f}" if urp['un_account_money'] is not None else "—"
                        b_date_str = urp['bill_create_date'].strftime('%Y-%m-%d') if urp['bill_create_date'] else '—'
                        blocker_list.append(
                            f"  {b_idx}) 收欠款预警：项目【{urp['project_name']}】已开发票但尚未回款到账"
                            f"（开票日期：{b_date_str}，开票金额：{bill_money_str}万元，未到账金额：{un_money_str}万元）"
                        )
                        b_idx += 1
                
                result["delivery_highlights"] = "\n".join(highlight_list) if highlight_list else "1. 交付工作处于正常开发推进中，开发交付无积压。"
                result["delivery_blockers"] = warning_text + ("\n".join(blocker_list) if blocker_list else "1. 本周项目整体推进良好，暂无重大的技术难点与交付卡点。")
                result["sales_highlights"] = ""
                result["sales_blockers"] = ""

            # 无论什么岗位，都在最后将 7 个新增细粒度字段写好（如果有相应变量，就格式化；若没有或者为营销岗，默认为“—”）
            # 1. 目前负责跟进的正在实施项目进度情况
            if 'projects' in locals() and projects:
                active_list = []
                for idx, p in enumerate(projects, 1):
                    active_list.append(f"{idx}. 项目【{p['project_name']}】当前总体进度：{float(p['project_progress'] or 0):.1f}%")
                result["crm_active_projects"] = "\n".join(active_list)
            else:
                result["crm_active_projects"] = "—"
 
            # 2. 本周项目子任务及里程碑节点交付动作明细
            if 'tasks' in locals() and tasks:
                task_list = []
                for idx, t in enumerate(tasks, 1):
                    m_tag = "【里程碑】" if t['milestone'] == '1' else ""
                    task_list.append(f"{idx}. {m_tag}完成项目【{t['project_name']}】下的任务节点：【{t['task_name']}】")
                result["crm_milestone_tasks"] = "\n".join(task_list)
            else:
                result["crm_milestone_tasks"] = "—"
 
            # 3. 处于暂停或异常挂起状态的项目
            if 'block_projects' in locals() and block_projects:
                suspended_list = []
                for idx, bp in enumerate(block_projects, 1):
                    suspended_list.append(f"{idx}. 项目【{bp['project_name']}】处于暂停或异常挂起状态（备注：{bp['remarks'] or '无'}）")
                result["crm_suspended_projects"] = "\n".join(suspended_list)
            else:
                result["crm_suspended_projects"] = "—"
 
            # 4. 项目已立项执行超过一个月，但目前仍未签订正式合同
            if 'presetup_projects' in locals() and presetup_projects:
                no_contract_list = []
                for idx, pp in enumerate(presetup_projects, 1):
                    c_date_str = pp['create_date'].strftime('%Y-%m-%d') if pp['create_date'] else '—'
                    no_contract_list.append(f"{idx}. 项目【{pp['project_name']}】已立项执行超过一个月，但目前仍未签订正式合同（立项时间：{c_date_str}）")
                result["crm_no_contract_warning"] = "\n".join(no_contract_list)
            else:
                result["crm_no_contract_warning"] = "—"
 
            # 5. 交付卡点：项目有进度但尚未开发票
            if 'unbilled_projects' in locals() and unbilled_projects:
                unbilled_list = []
                for idx, up in enumerate(unbilled_projects, 1):
                    money_val = float(up['installment_money']) / 10000.0 if up['installment_money'] is not None else None
                    money_str = f"{money_val:,.2f}" if money_val is not None else "—"
                    unbilled_list.append(
                        f"{idx}. 项目【{up['project_name']}】进度已达 {float(up['project_progress'] or 0):.1f}%"
                        f"（已达收付款触发节点 {float(up['project_progress_trigger'] or 0):.1f}%），"
                        f"但尚未开发票（本阶段合同款项：{money_str}万元）"
                    )
                result["crm_unbilled_warning"] = "\n".join(unbilled_list)
            else:
                result["crm_unbilled_warning"] = "—"
 
            # 6. 收欠款预警：项目已开发票但尚未回款到账
            if 'unreceived_projects' in locals() and unreceived_projects:
                unreceived_list = []
                for idx, urp in enumerate(unreceived_projects, 1):
                    bill_money_str = f"{float(urp['bill_money']):,.2f}" if urp['bill_money'] is not None else "—"
                    un_money_str = f"{float(urp['un_account_money']):,.2f}" if urp['un_account_money'] is not None else "—"
                    b_date_str = urp['bill_create_date'].strftime('%Y-%m-%d') if urp['bill_create_date'] else '—'
                    unreceived_list.append(
                        f"{idx}. 项目【{urp['project_name']}】已开发票但尚未回款到账"
                        f"（开票日期：{b_date_str}，开票金额：{bill_money_str}万元，未到账金额：{un_money_str}万元）"
                    )
                result["crm_unreceived_warning"] = "\n".join(unreceived_list)
            else:
                result["crm_unreceived_warning"] = "—"
 
            # 7. 个人工作饱和度与项目健康度诊断
            if 'personal_warnings' in locals() and personal_warnings:
                result["crm_health_diagnosis"] = "\n".join([f"{idx}. {w}" for idx, w in enumerate(personal_warnings, 1)])
            else:
                result["crm_health_diagnosis"] = "1. 工作饱和度与项目实施状态正常，暂无诊断预警。"
