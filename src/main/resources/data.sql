INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('总包/对上合同', 'CONTRACT_MAIN', 1, NULL, 1, '总承包合同及对上合同'),
('专业分包合同', 'CONTRACT_SUB_PROFESSIONAL', 1, NULL, 2, '专业分包类合同'),
('劳务分包合同', 'CONTRACT_SUB_LABOR', 1, NULL, 3, '劳务分包类合同'),
('材料采购合同', 'CONTRACT_PURCHASE', 1, NULL, 4, '材料采购类合同'),
('机械/设备租赁合同', 'CONTRACT_LEASE', 1, NULL, 5, '机械设备租赁合同'),
('技术服务/咨询合同', 'CONTRACT_SERVICE', 1, NULL, 6, '技术服务及咨询合同'),
('对下扣款/处罚协议', 'CONTRACT_PENALTY', 1, NULL, 7, '扣款及处罚协议'),
('合同解除/终止/变更协议', 'CONTRACT_CHANGE', 1, NULL, 8, '合同变更解除协议');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('施工总承包合同', 'CONTRACT_MAIN_CONSTRUCTION', 2, 1, 1, '施工总承包合同'),
('补充协议', 'CONTRACT_MAIN_SUPPLEMENT', 2, 1, 2, '总承包补充协议'),
('工期/质量/价款变更协议', 'CONTRACT_MAIN_CHANGE', 2, 1, 3, '工期质量价款变更'),
('签证确认单/洽商协议', 'CONTRACT_MAIN_VISA', 2, 1, 4, '签证确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('机电安装分包', 'CONTRACT_SUB_ELECTRO', 2, 2, 1, '机电安装分包'),
('消防分包', 'CONTRACT_SUB_FIRE', 2, 2, 2, '消防工程分包'),
('装饰装修分包', 'CONTRACT_SUB_DECOR', 2, 2, 3, '装饰装修分包'),
('幕墙分包', 'CONTRACT_SUB_CURTAIN', 2, 2, 4, '幕墙工程分包'),
('钢结构分包', 'CONTRACT_SUB_STEEL', 2, 2, 5, '钢结构分包'),
('防水保温分包', 'CONTRACT_SUB_WATERPROOF', 2, 2, 6, '防水保温分包'),
('市政/园林/道路分包', 'CONTRACT_SUB_MUNICIPAL', 2, 2, 7, '市政园林道路'),
('其他专业分包', 'CONTRACT_SUB_OTHER', 2, 2, 8, '其他专业分包');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('主体结构劳务', 'CONTRACT_LABOR_MAIN', 2, 3, 1, '主体结构劳务'),
('钢筋/木工/混凝土劳务', 'CONTRACT_LABOR_REBAR', 2, 3, 2, '钢筋木工混凝土'),
('砌筑/抹灰劳务', 'CONTRACT_LABOR_MASONRY', 2, 3, 3, '砌筑抹灰劳务'),
('脚手架劳务', 'CONTRACT_LABOR_SCAFFOLD', 2, 3, 4, '脚手架劳务'),
('综合劳务', 'CONTRACT_LABOR_GENERAL', 2, 3, 5, '综合劳务');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('主材采购', 'CONTRACT_PURCHASE_MAIN', 2, 4, 1, '主材采购'),
('装饰材料采购', 'CONTRACT_PURCHASE_DECOR', 2, 4, 2, '装饰材料'),
('水电材料采购', 'CONTRACT_PURCHASE_WATER', 2, 4, 3, '水电材料'),
('周转材料采购', 'CONTRACT_PURCHASE_TURN', 2, 4, 4, '周转材料'),
('零星材料采购', 'CONTRACT_PURCHASE_SPOT', 2, 4, 5, '零星材料');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('塔吊/施工电梯', 'CONTRACT_LEASE_CRANE', 2, 5, 1, '塔吊施工电梯'),
('挖掘机/装载机/压路机', 'CONTRACT_LEASE_EXCAVATOR', 2, 5, 2, '挖掘机等'),
('汽车吊/泵车', 'CONTRACT_LEASE_TRUCK', 2, 5, 3, '汽车吊泵车'),
('小型机具/设备租赁', 'CONTRACT_LEASE_SMALL', 2, 5, 4, '小型机具'),
('周转料具租赁', 'CONTRACT_LEASE_TURN', 2, 5, 5, '周转料具');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('勘察/设计合同', 'CONTRACT_SERVICE_SURVEY', 2, 6, 1, '勘察设计'),
('监理/检测合同', 'CONTRACT_SERVICE_SUPERVISION', 2, 6, 2, '监理检测'),
('造价咨询/审计', 'CONTRACT_SERVICE_COST', 2, 6, 3, '造价咨询'),
('技术服务/方案咨询', 'CONTRACT_SERVICE_TECH', 2, 6, 4, '技术服务'),
('安保/保洁/后勤服务', 'CONTRACT_SERVICE_LOGISTICS', 2, 6, 5, '后勤服务');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('质量违约扣款', 'CONTRACT_PENALTY_QUALITY', 2, 7, 1, '质量违约'),
('安全违约扣款', 'CONTRACT_PENALTY_SAFETY', 2, 7, 2, '安全违约'),
('工期延误扣款', 'CONTRACT_PENALTY_DELAY', 2, 7, 3, '工期延误'),
('文明施工/现场管理扣款', 'CONTRACT_PENALTY_CIVIL', 2, 7, 4, '文明施工'),
('其他违约扣款确认单', 'CONTRACT_PENALTY_OTHER', 2, 7, 5, '其他扣款');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('合同解除协议', 'CONTRACT_CHANGE_TERMINATE', 2, 8, 1, '合同解除'),
('合同终止协议', 'CONTRACT_CHANGE_END', 2, 8, 2, '合同终止'),
('结算确认及结清协议', 'CONTRACT_CHANGE_SETTLE', 2, 8, 3, '结算结清'),
('债权债务转让/抵销协议', 'CONTRACT_CHANGE_ASSIGN', 2, 8, 4, '债权转让');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_MAIN_CONSTRUCTION_STD', 3, 9, 1, '标准模板'),
('简易模板', 'TM_MAIN_CONSTRUCTION_SMP', 3, 9, 2, '简易模板'),
('补充协议模板', 'TM_MAIN_CONSTRUCTION_SUP', 3, 9, 3, '补充协议模板'),
('变更/签证模板', 'TM_MAIN_CONSTRUCTION_CHG', 3, 9, 4, '变更签证模板'),
('结算模板', 'TM_MAIN_CONSTRUCTION_STL', 3, 9, 5, '结算模板'),
('对账确认单', 'TM_MAIN_CONSTRUCTION_RCN', 3, 9, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_MAIN_SUPPLEMENT_STD', 3, 10, 1, '标准模板'),
('简易模板', 'TM_MAIN_SUPPLEMENT_SMP', 3, 10, 2, '简易模板'),
('补充协议模板', 'TM_MAIN_SUPPLEMENT_SUP', 3, 10, 3, '补充协议模板'),
('变更/签证模板', 'TM_MAIN_SUPPLEMENT_CHG', 3, 10, 4, '变更签证模板'),
('结算模板', 'TM_MAIN_SUPPLEMENT_STL', 3, 10, 5, '结算模板'),
('对账确认单', 'TM_MAIN_SUPPLEMENT_RCN', 3, 10, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_MAIN_CHANGE_STD', 3, 11, 1, '标准模板'),
('简易模板', 'TM_MAIN_CHANGE_SMP', 3, 11, 2, '简易模板'),
('补充协议模板', 'TM_MAIN_CHANGE_SUP', 3, 11, 3, '补充协议模板'),
('变更/签证模板', 'TM_MAIN_CHANGE_CHG', 3, 11, 4, '变更签证模板'),
('结算模板', 'TM_MAIN_CHANGE_STL', 3, 11, 5, '结算模板'),
('对账确认单', 'TM_MAIN_CHANGE_RCN', 3, 11, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_MAIN_VISA_STD', 3, 12, 1, '标准模板'),
('简易模板', 'TM_MAIN_VISA_SMP', 3, 12, 2, '简易模板'),
('补充协议模板', 'TM_MAIN_VISA_SUP', 3, 12, 3, '补充协议模板'),
('变更/签证模板', 'TM_MAIN_VISA_CHG', 3, 12, 4, '变更签证模板'),
('结算模板', 'TM_MAIN_VISA_STL', 3, 12, 5, '结算模板'),
('对账确认单', 'TM_MAIN_VISA_RCN', 3, 12, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_SUB_ELECTRO_STD', 3, 13, 1, '标准模板'),
('简易模板', 'TM_SUB_ELECTRO_SMP', 3, 13, 2, '简易模板'),
('补充协议模板', 'TM_SUB_ELECTRO_SUP', 3, 13, 3, '补充协议模板'),
('变更/签证模板', 'TM_SUB_ELECTRO_CHG', 3, 13, 4, '变更签证模板'),
('结算模板', 'TM_SUB_ELECTRO_STL', 3, 13, 5, '结算模板'),
('对账确认单', 'TM_SUB_ELECTRO_RCN', 3, 13, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_SUB_FIRE_STD', 3, 14, 1, '标准模板'),
('简易模板', 'TM_SUB_FIRE_SMP', 3, 14, 2, '简易模板'),
('补充协议模板', 'TM_SUB_FIRE_SUP', 3, 14, 3, '补充协议模板'),
('变更/签证模板', 'TM_SUB_FIRE_CHG', 3, 14, 4, '变更签证模板'),
('结算模板', 'TM_SUB_FIRE_STL', 3, 14, 5, '结算模板'),
('对账确认单', 'TM_SUB_FIRE_RCN', 3, 14, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_SUB_DECOR_STD', 3, 15, 1, '标准模板'),
('简易模板', 'TM_SUB_DECOR_SMP', 3, 15, 2, '简易模板'),
('补充协议模板', 'TM_SUB_DECOR_SUP', 3, 15, 3, '补充协议模板'),
('变更/签证模板', 'TM_SUB_DECOR_CHG', 3, 15, 4, '变更签证模板'),
('结算模板', 'TM_SUB_DECOR_STL', 3, 15, 5, '结算模板'),
('对账确认单', 'TM_SUB_DECOR_RCN', 3, 15, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_SUB_CURTAIN_STD', 3, 16, 1, '标准模板'),
('简易模板', 'TM_SUB_CURTAIN_SMP', 3, 16, 2, '简易模板'),
('补充协议模板', 'TM_SUB_CURTAIN_SUP', 3, 16, 3, '补充协议模板'),
('变更/签证模板', 'TM_SUB_CURTAIN_CHG', 3, 16, 4, '变更签证模板'),
('结算模板', 'TM_SUB_CURTAIN_STL', 3, 16, 5, '结算模板'),
('对账确认单', 'TM_SUB_CURTAIN_RCN', 3, 16, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_SUB_STEEL_STD', 3, 17, 1, '标准模板'),
('简易模板', 'TM_SUB_STEEL_SMP', 3, 17, 2, '简易模板'),
('补充协议模板', 'TM_SUB_STEEL_SUP', 3, 17, 3, '补充协议模板'),
('变更/签证模板', 'TM_SUB_STEEL_CHG', 3, 17, 4, '变更签证模板'),
('结算模板', 'TM_SUB_STEEL_STL', 3, 17, 5, '结算模板'),
('对账确认单', 'TM_SUB_STEEL_RCN', 3, 17, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_SUB_WATERPROOF_STD', 3, 18, 1, '标准模板'),
('简易模板', 'TM_SUB_WATERPROOF_SMP', 3, 18, 2, '简易模板'),
('补充协议模板', 'TM_SUB_WATERPROOF_SUP', 3, 18, 3, '补充协议模板'),
('变更/签证模板', 'TM_SUB_WATERPROOF_CHG', 3, 18, 4, '变更签证模板'),
('结算模板', 'TM_SUB_WATERPROOF_STL', 3, 18, 5, '结算模板'),
('对账确认单', 'TM_SUB_WATERPROOF_RCN', 3, 18, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_SUB_MUNICIPAL_STD', 3, 19, 1, '标准模板'),
('简易模板', 'TM_SUB_MUNICIPAL_SMP', 3, 19, 2, '简易模板'),
('补充协议模板', 'TM_SUB_MUNICIPAL_SUP', 3, 19, 3, '补充协议模板'),
('变更/签证模板', 'TM_SUB_MUNICIPAL_CHG', 3, 19, 4, '变更签证模板'),
('结算模板', 'TM_SUB_MUNICIPAL_STL', 3, 19, 5, '结算模板'),
('对账确认单', 'TM_SUB_MUNICIPAL_RCN', 3, 19, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_SUB_OTHER_STD', 3, 20, 1, '标准模板'),
('简易模板', 'TM_SUB_OTHER_SMP', 3, 20, 2, '简易模板'),
('补充协议模板', 'TM_SUB_OTHER_SUP', 3, 20, 3, '补充协议模板'),
('变更/签证模板', 'TM_SUB_OTHER_CHG', 3, 20, 4, '变更签证模板'),
('结算模板', 'TM_SUB_OTHER_STL', 3, 20, 5, '结算模板'),
('对账确认单', 'TM_SUB_OTHER_RCN', 3, 20, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_LABOR_MAIN_STD', 3, 21, 1, '标准模板'),
('简易模板', 'TM_LABOR_MAIN_SMP', 3, 21, 2, '简易模板'),
('补充协议模板', 'TM_LABOR_MAIN_SUP', 3, 21, 3, '补充协议模板'),
('变更/签证模板', 'TM_LABOR_MAIN_CHG', 3, 21, 4, '变更签证模板'),
('结算模板', 'TM_LABOR_MAIN_STL', 3, 21, 5, '结算模板'),
('对账确认单', 'TM_LABOR_MAIN_RCN', 3, 21, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_LABOR_REBAR_STD', 3, 22, 1, '标准模板'),
('简易模板', 'TM_LABOR_REBAR_SMP', 3, 22, 2, '简易模板'),
('补充协议模板', 'TM_LABOR_REBAR_SUP', 3, 22, 3, '补充协议模板'),
('变更/签证模板', 'TM_LABOR_REBAR_CHG', 3, 22, 4, '变更签证模板'),
('结算模板', 'TM_LABOR_REBAR_STL', 3, 22, 5, '结算模板'),
('对账确认单', 'TM_LABOR_REBAR_RCN', 3, 22, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_LABOR_MASONRY_STD', 3, 23, 1, '标准模板'),
('简易模板', 'TM_LABOR_MASONRY_SMP', 3, 23, 2, '简易模板'),
('补充协议模板', 'TM_LABOR_MASONRY_SUP', 3, 23, 3, '补充协议模板'),
('变更/签证模板', 'TM_LABOR_MASONRY_CHG', 3, 23, 4, '变更签证模板'),
('结算模板', 'TM_LABOR_MASONRY_STL', 3, 23, 5, '结算模板'),
('对账确认单', 'TM_LABOR_MASONRY_RCN', 3, 23, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_LABOR_SCAFFOLD_STD', 3, 24, 1, '标准模板'),
('简易模板', 'TM_LABOR_SCAFFOLD_SMP', 3, 24, 2, '简易模板'),
('补充协议模板', 'TM_LABOR_SCAFFOLD_SUP', 3, 24, 3, '补充协议模板'),
('变更/签证模板', 'TM_LABOR_SCAFFOLD_CHG', 3, 24, 4, '变更签证模板'),
('结算模板', 'TM_LABOR_SCAFFOLD_STL', 3, 24, 5, '结算模板'),
('对账确认单', 'TM_LABOR_SCAFFOLD_RCN', 3, 24, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_LABOR_GENERAL_STD', 3, 25, 1, '标准模板'),
('简易模板', 'TM_LABOR_GENERAL_SMP', 3, 25, 2, '简易模板'),
('补充协议模板', 'TM_LABOR_GENERAL_SUP', 3, 25, 3, '补充协议模板'),
('变更/签证模板', 'TM_LABOR_GENERAL_CHG', 3, 25, 4, '变更签证模板'),
('结算模板', 'TM_LABOR_GENERAL_STL', 3, 25, 5, '结算模板'),
('对账确认单', 'TM_LABOR_GENERAL_RCN', 3, 25, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_PURCHASE_MAIN_STD', 3, 26, 1, '标准模板'),
('简易模板', 'TM_PURCHASE_MAIN_SMP', 3, 26, 2, '简易模板'),
('补充协议模板', 'TM_PURCHASE_MAIN_SUP', 3, 26, 3, '补充协议模板'),
('变更/签证模板', 'TM_PURCHASE_MAIN_CHG', 3, 26, 4, '变更签证模板'),
('结算模板', 'TM_PURCHASE_MAIN_STL', 3, 26, 5, '结算模板'),
('对账确认单', 'TM_PURCHASE_MAIN_RCN', 3, 26, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_PURCHASE_DECOR_STD', 3, 27, 1, '标准模板'),
('简易模板', 'TM_PURCHASE_DECOR_SMP', 3, 27, 2, '简易模板'),
('补充协议模板', 'TM_PURCHASE_DECOR_SUP', 3, 27, 3, '补充协议模板'),
('变更/签证模板', 'TM_PURCHASE_DECOR_CHG', 3, 27, 4, '变更签证模板'),
('结算模板', 'TM_PURCHASE_DECOR_STL', 3, 27, 5, '结算模板'),
('对账确认单', 'TM_PURCHASE_DECOR_RCN', 3, 27, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_PURCHASE_WATER_STD', 3, 28, 1, '标准模板'),
('简易模板', 'TM_PURCHASE_WATER_SMP', 3, 28, 2, '简易模板'),
('补充协议模板', 'TM_PURCHASE_WATER_SUP', 3, 28, 3, '补充协议模板'),
('变更/签证模板', 'TM_PURCHASE_WATER_CHG', 3, 28, 4, '变更签证模板'),
('结算模板', 'TM_PURCHASE_WATER_STL', 3, 28, 5, '结算模板'),
('对账确认单', 'TM_PURCHASE_WATER_RCN', 3, 28, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_PURCHASE_TURN_STD', 3, 29, 1, '标准模板'),
('简易模板', 'TM_PURCHASE_TURN_SMP', 3, 29, 2, '简易模板'),
('补充协议模板', 'TM_PURCHASE_TURN_SUP', 3, 29, 3, '补充协议模板'),
('变更/签证模板', 'TM_PURCHASE_TURN_CHG', 3, 29, 4, '变更签证模板'),
('结算模板', 'TM_PURCHASE_TURN_STL', 3, 29, 5, '结算模板'),
('对账确认单', 'TM_PURCHASE_TURN_RCN', 3, 29, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_PURCHASE_SPOT_STD', 3, 30, 1, '标准模板'),
('简易模板', 'TM_PURCHASE_SPOT_SMP', 3, 30, 2, '简易模板'),
('补充协议模板', 'TM_PURCHASE_SPOT_SUP', 3, 30, 3, '补充协议模板'),
('变更/签证模板', 'TM_PURCHASE_SPOT_CHG', 3, 30, 4, '变更签证模板'),
('结算模板', 'TM_PURCHASE_SPOT_STL', 3, 30, 5, '结算模板'),
('对账确认单', 'TM_PURCHASE_SPOT_RCN', 3, 30, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_LEASE_CRANE_STD', 3, 31, 1, '标准模板'),
('简易模板', 'TM_LEASE_CRANE_SMP', 3, 31, 2, '简易模板'),
('补充协议模板', 'TM_LEASE_CRANE_SUP', 3, 31, 3, '补充协议模板'),
('变更/签证模板', 'TM_LEASE_CRANE_CHG', 3, 31, 4, '变更签证模板'),
('结算模板', 'TM_LEASE_CRANE_STL', 3, 31, 5, '结算模板'),
('对账确认单', 'TM_LEASE_CRANE_RCN', 3, 31, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_LEASE_EXCAVATOR_STD', 3, 32, 1, '标准模板'),
('简易模板', 'TM_LEASE_EXCAVATOR_SMP', 3, 32, 2, '简易模板'),
('补充协议模板', 'TM_LEASE_EXCAVATOR_SUP', 3, 32, 3, '补充协议模板'),
('变更/签证模板', 'TM_LEASE_EXCAVATOR_CHG', 3, 32, 4, '变更签证模板'),
('结算模板', 'TM_LEASE_EXCAVATOR_STL', 3, 32, 5, '结算模板'),
('对账确认单', 'TM_LEASE_EXCAVATOR_RCN', 3, 32, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_LEASE_TRUCK_STD', 3, 33, 1, '标准模板'),
('简易模板', 'TM_LEASE_TRUCK_SMP', 3, 33, 2, '简易模板'),
('补充协议模板', 'TM_LEASE_TRUCK_SUP', 3, 33, 3, '补充协议模板'),
('变更/签证模板', 'TM_LEASE_TRUCK_CHG', 3, 33, 4, '变更签证模板'),
('结算模板', 'TM_LEASE_TRUCK_STL', 3, 33, 5, '结算模板'),
('对账确认单', 'TM_LEASE_TRUCK_RCN', 3, 33, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_LEASE_SMALL_STD', 3, 34, 1, '标准模板'),
('简易模板', 'TM_LEASE_SMALL_SMP', 3, 34, 2, '简易模板'),
('补充协议模板', 'TM_LEASE_SMALL_SUP', 3, 34, 3, '补充协议模板'),
('变更/签证模板', 'TM_LEASE_SMALL_CHG', 3, 34, 4, '变更签证模板'),
('结算模板', 'TM_LEASE_SMALL_STL', 3, 34, 5, '结算模板'),
('对账确认单', 'TM_LEASE_SMALL_RCN', 3, 34, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_LEASE_TURN_STD', 3, 35, 1, '标准模板'),
('简易模板', 'TM_LEASE_TURN_SMP', 3, 35, 2, '简易模板'),
('补充协议模板', 'TM_LEASE_TURN_SUP', 3, 35, 3, '补充协议模板'),
('变更/签证模板', 'TM_LEASE_TURN_CHG', 3, 35, 4, '变更签证模板'),
('结算模板', 'TM_LEASE_TURN_STL', 3, 35, 5, '结算模板'),
('对账确认单', 'TM_LEASE_TURN_RCN', 3, 35, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_SERVICE_SURVEY_STD', 3, 36, 1, '标准模板'),
('简易模板', 'TM_SERVICE_SURVEY_SMP', 3, 36, 2, '简易模板'),
('补充协议模板', 'TM_SERVICE_SURVEY_SUP', 3, 36, 3, '补充协议模板'),
('变更/签证模板', 'TM_SERVICE_SURVEY_CHG', 3, 36, 4, '变更签证模板'),
('结算模板', 'TM_SERVICE_SURVEY_STL', 3, 36, 5, '结算模板'),
('对账确认单', 'TM_SERVICE_SURVEY_RCN', 3, 36, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_SERVICE_SUPERVISION_STD', 3, 37, 1, '标准模板'),
('简易模板', 'TM_SERVICE_SUPERVISION_SMP', 3, 37, 2, '简易模板'),
('补充协议模板', 'TM_SERVICE_SUPERVISION_SUP', 3, 37, 3, '补充协议模板'),
('变更/签证模板', 'TM_SERVICE_SUPERVISION_CHG', 3, 37, 4, '变更签证模板'),
('结算模板', 'TM_SERVICE_SUPERVISION_STL', 3, 37, 5, '结算模板'),
('对账确认单', 'TM_SERVICE_SUPERVISION_RCN', 3, 37, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_SERVICE_COST_STD', 3, 38, 1, '标准模板'),
('简易模板', 'TM_SERVICE_COST_SMP', 3, 38, 2, '简易模板'),
('补充协议模板', 'TM_SERVICE_COST_SUP', 3, 38, 3, '补充协议模板'),
('变更/签证模板', 'TM_SERVICE_COST_CHG', 3, 38, 4, '变更签证模板'),
('结算模板', 'TM_SERVICE_COST_STL', 3, 38, 5, '结算模板'),
('对账确认单', 'TM_SERVICE_COST_RCN', 3, 38, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_SERVICE_TECH_STD', 3, 39, 1, '标准模板'),
('简易模板', 'TM_SERVICE_TECH_SMP', 3, 39, 2, '简易模板'),
('补充协议模板', 'TM_SERVICE_TECH_SUP', 3, 39, 3, '补充协议模板'),
('变更/签证模板', 'TM_SERVICE_TECH_CHG', 3, 39, 4, '变更签证模板'),
('结算模板', 'TM_SERVICE_TECH_STL', 3, 39, 5, '结算模板'),
('对账确认单', 'TM_SERVICE_TECH_RCN', 3, 39, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_SERVICE_LOGISTICS_STD', 3, 40, 1, '标准模板'),
('简易模板', 'TM_SERVICE_LOGISTICS_SMP', 3, 40, 2, '简易模板'),
('补充协议模板', 'TM_SERVICE_LOGISTICS_SUP', 3, 40, 3, '补充协议模板'),
('变更/签证模板', 'TM_SERVICE_LOGISTICS_CHG', 3, 40, 4, '变更签证模板'),
('结算模板', 'TM_SERVICE_LOGISTICS_STL', 3, 40, 5, '结算模板'),
('对账确认单', 'TM_SERVICE_LOGISTICS_RCN', 3, 40, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_PENALTY_QUALITY_STD', 3, 41, 1, '标准模板'),
('简易模板', 'TM_PENALTY_QUALITY_SMP', 3, 41, 2, '简易模板'),
('补充协议模板', 'TM_PENALTY_QUALITY_SUP', 3, 41, 3, '补充协议模板'),
('变更/签证模板', 'TM_PENALTY_QUALITY_CHG', 3, 41, 4, '变更签证模板'),
('结算模板', 'TM_PENALTY_QUALITY_STL', 3, 41, 5, '结算模板'),
('对账确认单', 'TM_PENALTY_QUALITY_RCN', 3, 41, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_PENALTY_SAFETY_STD', 3, 42, 1, '标准模板'),
('简易模板', 'TM_PENALTY_SAFETY_SMP', 3, 42, 2, '简易模板'),
('补充协议模板', 'TM_PENALTY_SAFETY_SUP', 3, 42, 3, '补充协议模板'),
('变更/签证模板', 'TM_PENALTY_SAFETY_CHG', 3, 42, 4, '变更签证模板'),
('结算模板', 'TM_PENALTY_SAFETY_STL', 3, 42, 5, '结算模板'),
('对账确认单', 'TM_PENALTY_SAFETY_RCN', 3, 42, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_PENALTY_DELAY_STD', 3, 43, 1, '标准模板'),
('简易模板', 'TM_PENALTY_DELAY_SMP', 3, 43, 2, '简易模板'),
('补充协议模板', 'TM_PENALTY_DELAY_SUP', 3, 43, 3, '补充协议模板'),
('变更/签证模板', 'TM_PENALTY_DELAY_CHG', 3, 43, 4, '变更签证模板'),
('结算模板', 'TM_PENALTY_DELAY_STL', 3, 43, 5, '结算模板'),
('对账确认单', 'TM_PENALTY_DELAY_RCN', 3, 43, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_PENALTY_CIVIL_STD', 3, 44, 1, '标准模板'),
('简易模板', 'TM_PENALTY_CIVIL_SMP', 3, 44, 2, '简易模板'),
('补充协议模板', 'TM_PENALTY_CIVIL_SUP', 3, 44, 3, '补充协议模板'),
('变更/签证模板', 'TM_PENALTY_CIVIL_CHG', 3, 44, 4, '变更签证模板'),
('结算模板', 'TM_PENALTY_CIVIL_STL', 3, 44, 5, '结算模板'),
('对账确认单', 'TM_PENALTY_CIVIL_RCN', 3, 44, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_PENALTY_OTHER_STD', 3, 45, 1, '标准模板'),
('简易模板', 'TM_PENALTY_OTHER_SMP', 3, 45, 2, '简易模板'),
('补充协议模板', 'TM_PENALTY_OTHER_SUP', 3, 45, 3, '补充协议模板'),
('变更/签证模板', 'TM_PENALTY_OTHER_CHG', 3, 45, 4, '变更签证模板'),
('结算模板', 'TM_PENALTY_OTHER_STL', 3, 45, 5, '结算模板'),
('对账确认单', 'TM_PENALTY_OTHER_RCN', 3, 45, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_CHANGE_TERMINATE_STD', 3, 46, 1, '标准模板'),
('简易模板', 'TM_CHANGE_TERMINATE_SMP', 3, 46, 2, '简易模板'),
('补充协议模板', 'TM_CHANGE_TERMINATE_SUP', 3, 46, 3, '补充协议模板'),
('变更/签证模板', 'TM_CHANGE_TERMINATE_CHG', 3, 46, 4, '变更签证模板'),
('结算模板', 'TM_CHANGE_TERMINATE_STL', 3, 46, 5, '结算模板'),
('对账确认单', 'TM_CHANGE_TERMINATE_RCN', 3, 46, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_CHANGE_END_STD', 3, 47, 1, '标准模板'),
('简易模板', 'TM_CHANGE_END_SMP', 3, 47, 2, '简易模板'),
('补充协议模板', 'TM_CHANGE_END_SUP', 3, 47, 3, '补充协议模板'),
('变更/签证模板', 'TM_CHANGE_END_CHG', 3, 47, 4, '变更签证模板'),
('结算模板', 'TM_CHANGE_END_STL', 3, 47, 5, '结算模板'),
('对账确认单', 'TM_CHANGE_END_RCN', 3, 47, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_CHANGE_SETTLE_STD', 3, 48, 1, '标准模板'),
('简易模板', 'TM_CHANGE_SETTLE_SMP', 3, 48, 2, '简易模板'),
('补充协议模板', 'TM_CHANGE_SETTLE_SUP', 3, 48, 3, '补充协议模板'),
('变更/签证模板', 'TM_CHANGE_SETTLE_CHG', 3, 48, 4, '变更签证模板'),
('结算模板', 'TM_CHANGE_SETTLE_STL', 3, 48, 5, '结算模板'),
('对账确认单', 'TM_CHANGE_SETTLE_RCN', 3, 48, 6, '对账确认单');

INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('标准模板', 'TM_CHANGE_ASSIGN_STD', 3, 49, 1, '标准模板'),
('简易模板', 'TM_CHANGE_ASSIGN_SMP', 3, 49, 2, '简易模板'),
('补充协议模板', 'TM_CHANGE_ASSIGN_SUP', 3, 49, 3, '补充协议模板'),
('变更/签证模板', 'TM_CHANGE_ASSIGN_CHG', 3, 49, 4, '变更签证模板'),
('结算模板', 'TM_CHANGE_ASSIGN_STL', 3, 49, 5, '结算模板'),
('对账确认单', 'TM_CHANGE_ASSIGN_RCN', 3, 49, 6, '对账确认单');