package com.example.contract.template.config;

import com.example.contract.template.entity.TemplateCategory;
import com.example.contract.template.repository.TemplateCategoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private TemplateCategoryRepository categoryRepository;

    @Override
    public void run(String... args) throws Exception {
        if (categoryRepository.count() == 0) {
            List<TemplateCategory> level1Categories = new ArrayList<>();
            String[][] level1Data = {
                    {"总包/对上合同", "CONTRACT_MAIN", "总承包合同及对上合同"},
                    {"专业分包合同", "CONTRACT_SUB_PROFESSIONAL", "专业分包类合同"},
                    {"劳务分包合同", "CONTRACT_SUB_LABOR", "劳务分包类合同"},
                    {"材料采购合同", "CONTRACT_PURCHASE", "材料采购类合同"},
                    {"机械/设备租赁合同", "CONTRACT_LEASE", "机械设备租赁合同"},
                    {"技术服务/咨询合同", "CONTRACT_SERVICE", "技术服务及咨询合同"},
                    {"对下扣款/处罚协议", "CONTRACT_PENALTY", "扣款及处罚协议"},
                    {"合同解除/终止/变更协议", "CONTRACT_CHANGE", "合同变更解除协议"}
            };

            for (int i = 0; i < level1Data.length; i++) {
                TemplateCategory cat = new TemplateCategory();
                cat.setName(level1Data[i][0]);
                cat.setCode(level1Data[i][1]);
                cat.setLevel(1);
                cat.setSortOrder(i + 1);
                cat.setDescription(level1Data[i][2]);
                cat.setIsDeleted(false);
                level1Categories.add(cat);
            }
            List<TemplateCategory> savedLevel1 = categoryRepository.saveAll(level1Categories);

            List<TemplateCategory> level2Categories = new ArrayList<>();
            Object[][] level2Data = {
                    {0, "施工总承包合同", "CONTRACT_MAIN_CONSTRUCTION", "施工总承包合同"},
                    {0, "补充协议", "CONTRACT_MAIN_SUPPLEMENT", "总承包补充协议"},
                    {0, "工期/质量/价款变更协议", "CONTRACT_MAIN_CHANGE", "工期质量价款变更"},
                    {0, "签证确认单/洽商协议", "CONTRACT_MAIN_VISA", "签证确认单"},
                    {1, "机电安装分包", "CONTRACT_SUB_ELECTRO", "机电安装分包"},
                    {1, "消防分包", "CONTRACT_SUB_FIRE", "消防工程分包"},
                    {1, "装饰装修分包", "CONTRACT_SUB_DECOR", "装饰装修分包"},
                    {1, "幕墙分包", "CONTRACT_SUB_CURTAIN", "幕墙工程分包"},
                    {1, "钢结构分包", "CONTRACT_SUB_STEEL", "钢结构分包"},
                    {1, "防水保温分包", "CONTRACT_SUB_WATERPROOF", "防水保温分包"},
                    {1, "市政/园林/道路分包", "CONTRACT_SUB_MUNICIPAL", "市政园林道路"},
                    {1, "其他专业分包", "CONTRACT_SUB_OTHER", "其他专业分包"},
                    {2, "主体结构劳务", "CONTRACT_LABOR_MAIN", "主体结构劳务"},
                    {2, "钢筋/木工/混凝土劳务", "CONTRACT_LABOR_REBAR", "钢筋木工混凝土"},
                    {2, "砌筑/抹灰劳务", "CONTRACT_LABOR_MASONRY", "砌筑抹灰劳务"},
                    {2, "脚手架劳务", "CONTRACT_LABOR_SCAFFOLD", "脚手架劳务"},
                    {2, "综合劳务", "CONTRACT_LABOR_GENERAL", "综合劳务"},
                    {3, "主材采购", "CONTRACT_PURCHASE_MAIN", "主材采购"},
                    {3, "装饰材料采购", "CONTRACT_PURCHASE_DECOR", "装饰材料"},
                    {3, "水电材料采购", "CONTRACT_PURCHASE_WATER", "水电材料"},
                    {3, "周转材料采购", "CONTRACT_PURCHASE_TURN", "周转材料"},
                    {3, "零星材料采购", "CONTRACT_PURCHASE_SPOT", "零星材料"},
                    {4, "塔吊/施工电梯", "CONTRACT_LEASE_CRANE", "塔吊施工电梯"},
                    {4, "挖掘机/装载机/压路机", "CONTRACT_LEASE_EXCAVATOR", "挖掘机等"},
                    {4, "汽车吊/泵车", "CONTRACT_LEASE_TRUCK", "汽车吊泵车"},
                    {4, "小型机具/设备租赁", "CONTRACT_LEASE_SMALL", "小型机具"},
                    {4, "周转料具租赁", "CONTRACT_LEASE_TURN", "周转料具"},
                    {5, "勘察/设计合同", "CONTRACT_SERVICE_SURVEY", "勘察设计"},
                    {5, "监理/检测合同", "CONTRACT_SERVICE_SUPERVISION", "监理检测"},
                    {5, "造价咨询/审计", "CONTRACT_SERVICE_COST", "造价咨询"},
                    {5, "技术服务/方案咨询", "CONTRACT_SERVICE_TECH", "技术服务"},
                    {5, "安保/保洁/后勤服务", "CONTRACT_SERVICE_LOGISTICS", "后勤服务"},
                    {6, "质量违约扣款", "CONTRACT_PENALTY_QUALITY", "质量违约"},
                    {6, "安全违约扣款", "CONTRACT_PENALTY_SAFETY", "安全违约"},
                    {6, "工期延误扣款", "CONTRACT_PENALTY_DELAY", "工期延误"},
                    {6, "文明施工/现场管理扣款", "CONTRACT_PENALTY_CIVIL", "文明施工"},
                    {6, "其他违约扣款确认单", "CONTRACT_PENALTY_OTHER", "其他扣款"},
                    {7, "合同解除协议", "CONTRACT_CHANGE_TERMINATE", "合同解除"},
                    {7, "合同终止协议", "CONTRACT_CHANGE_END", "合同终止"},
                    {7, "结算确认及结清协议", "CONTRACT_CHANGE_SETTLE", "结算结清"},
                    {7, "债权债务转让/抵销协议", "CONTRACT_CHANGE_ASSIGN", "债权转让"}
            };

            int sortOrder = 1;
            for (Object[] row : level2Data) {
                int parentIndex = (Integer) row[0];
                TemplateCategory cat = new TemplateCategory();
                cat.setName((String) row[1]);
                cat.setCode((String) row[2]);
                cat.setLevel(2);
                cat.setParentId(savedLevel1.get(parentIndex).getId());
                cat.setSortOrder(sortOrder++);
                cat.setDescription((String) row[3]);
                cat.setIsDeleted(false);
                level2Categories.add(cat);
            }
            List<TemplateCategory> savedLevel2 = categoryRepository.saveAll(level2Categories);

            List<TemplateCategory> level3Categories = new ArrayList<>();
            String[] level3Names = {"标准模板", "简易模板", "补充协议模板", "变更/签证模板", "结算模板", "对账确认单"};
            String[] level3Codes = {"STD", "SMP", "SUP", "CHG", "STL", "RCN"};

            for (TemplateCategory parent : savedLevel2) {
                for (int j = 0; j < level3Names.length; j++) {
                    TemplateCategory level3 = new TemplateCategory();
                    level3.setName(level3Names[j]);
                    level3.setCode("TM_" + parent.getCode() + "_" + level3Codes[j]);
                    level3.setLevel(3);
                    level3.setParentId(parent.getId());
                    level3.setSortOrder(j + 1);
                    level3.setDescription(level3Names[j]);
                    level3.setIsDeleted(false);
                    level3Categories.add(level3);
                }
            }
            categoryRepository.saveAll(level3Categories);

            System.out.println("分类数据初始化完成！");
        }
    }
}