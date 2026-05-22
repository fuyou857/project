-- 删除现有的分类数据（包括二级和三级分类）
DELETE FROM template_category WHERE level = 3;
DELETE FROM template_category WHERE level = 2;
DELETE FROM template_category WHERE level = 1;

-- 重新插入一级分类
INSERT INTO template_category (name, code, level, parent_id, sort_order, description) VALUES
('A对上合同', 'A', 1, NULL, 1, '对上合同类'),
('B对下合同', 'B', 1, NULL, 2, '对下合同类');

-- 获取新插入的一级分类ID并插入二级分类
INSERT INTO template_category (name, code, level, parent_id, sort_order, description)
SELECT 
    unnest(ARRAY[
        'A-01-施工总承包主合同', 'A-02-专业分包合同', 'A-03-劳务分包合同', 
        'A-04-对业主补充变更签证协议', 'A-05-对业主结算结清协议',
        'B-01-专业分包合同', 'B-02-劳务分包合同', 'B-03-材料采购合同',
        'B-04-机械设备租赁合同', 'B-05-技术服务咨询合同', 'B-06-对下扣款处罚协议',
        'B-07-对下解除终止变更协议', 'B-08-对下结算对账确认单', 'B-09-其他协议'
    ]) AS name,
    unnest(ARRAY[
        'A-01', 'A-02', 'A-03', 'A-04', 'A-05',
        'B-01', 'B-02', 'B-03', 'B-04', 'B-05', 'B-06', 'B-07', 'B-08', 'B-09'
    ]) AS code,
    2 AS level,
    CASE 
        WHEN unnest(ARRAY[1,1,1,1,1,2,2,2,2,2,2,2,2,2]) = 1 THEN 
            (SELECT id FROM template_category WHERE code = 'A' AND level = 1)
        ELSE 
            (SELECT id FROM template_category WHERE code = 'B' AND level = 1)
    END AS parent_id,
    unnest(ARRAY[1,2,3,4,5,1,2,3,4,5,6,7,8,9]) AS sort_order,
    unnest(ARRAY[
        '施工总承包主合同', '专业分包合同', '劳务分包合同',
        '对业主补充变更签证协议', '对业主结算结清协议',
        '专业分包合同', '劳务分包合同', '材料采购合同',
        '机械设备租赁合同', '技术服务咨询合同', '对下扣款处罚协议',
        '对下解除终止变更协议', '对下结算对账确认单', '其他协议'
    ]) AS description;