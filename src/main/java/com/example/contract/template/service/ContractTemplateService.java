package com.example.contract.template.service;

import com.example.contract.template.dto.request.TemplateUploadRequest;
import com.example.contract.template.dto.response.ContractTemplateDTO;
import com.example.contract.template.dto.response.TemplateVariableDTO;
import com.example.contract.template.dto.response.VersionDTO;
import com.example.contract.template.entity.ContractTemplate;
import com.example.contract.template.entity.TemplateCategory;
import com.example.contract.template.entity.TemplateVariable;
import com.example.contract.template.entity.TemplateVersion;
import com.example.contract.template.repository.ContractTemplateRepository;
import com.example.contract.template.repository.TemplateCategoryRepository;
import com.example.contract.template.repository.TemplateVariableRepository;
import com.example.contract.template.repository.TemplateVersionRepository;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ContractTemplateService {

    @Autowired
    private ContractTemplateRepository templateRepository;

    @Autowired
    private TemplateCategoryRepository categoryRepository;

    @Autowired
    private TemplateVersionRepository versionRepository;

    @Autowired
    private TemplateVariableRepository variableRepository;

    @Value("${file.template-dir:./templates}")
    private String templateDir;

    @Value("${file.version-dir:./versions}")
    private String versionDir;

    private static final Pattern TEXT_VARIABLE_PATTERN = Pattern.compile("\\{\\{(\\w+)\\}\\}");
    private static final Pattern IMAGE_VARIABLE_PATTERN = Pattern.compile("\\{\\{图片:(\\w+)\\}\\}");

    @Transactional
    public ContractTemplateDTO uploadTemplate(MultipartFile file, TemplateUploadRequest request) {
        validateFile(file);

        if (templateRepository.existsByCode(request.getCode())) {
            throw new IllegalArgumentException("模板编码已存在");
        }

        categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException("分类不存在"));

        String filePath = saveFile(file, templateDir);

        ContractTemplate template = new ContractTemplate();
        template.setName(request.getName());
        template.setCode(request.getCode());
        template.setCategoryId(request.getCategoryId());
        template.setFilePath(filePath);
        template.setFileName(file.getOriginalFilename());
        template.setFileSize(file.getSize());
        template.setVersion(1);
        template.setDescription(request.getDescription());
        template.setCreatedBy(request.getCreatedBy());

        ContractTemplate saved = templateRepository.save(template);

        saveInitialVersion(saved, file);

        List<TemplateVariable> variables = extractVariables(saved.getId(), file);
        variableRepository.saveAll(variables);

        return convertToDTO(saved);
    }

    @Transactional(readOnly = true)
    public List<ContractTemplateDTO> getAllTemplates() {
        List<ContractTemplate> templates = templateRepository.findByIsDeletedFalseOrderByCreatedAtDesc();
        return templates.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ContractTemplateDTO> getTemplatesByCategory(Long categoryId) {
        List<ContractTemplate> templates = templateRepository.findByCategoryIdAndIsDeletedFalse(categoryId);
        return templates.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ContractTemplateDTO getTemplateById(Long id) {
        ContractTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("模板不存在"));
        if (template.getIsDeleted()) {
            throw new IllegalArgumentException("模板已删除");
        }
        return convertToDTO(template);
    }

    @Transactional
    public ContractTemplateDTO updateTemplate(Long id, MultipartFile file, TemplateUploadRequest request) {
        ContractTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("模板不存在"));

        if (template.getIsDeleted()) {
            throw new IllegalArgumentException("模板已删除");
        }

        if (!template.getCode().equals(request.getCode()) && templateRepository.existsByCodeAndIdNot(request.getCode(), id)) {
            throw new IllegalArgumentException("模板编码已存在");
        }

        Integer newVersion = template.getVersion() + 1;

        if (file != null && !file.isEmpty()) {
            saveVersion(template, file, "模板更新");

            String filePath = saveFile(file, templateDir);
            template.setFilePath(filePath);
            template.setFileName(file.getOriginalFilename());
            template.setFileSize(file.getSize());

            variableRepository.deleteByTemplateId(id);
            List<TemplateVariable> variables = extractVariables(id, file);
            variableRepository.saveAll(variables);
        }

        template.setName(request.getName());
        template.setCode(request.getCode());
        template.setCategoryId(request.getCategoryId());
        template.setVersion(newVersion);
        template.setDescription(request.getDescription());
        template.setUpdatedBy(request.getCreatedBy());

        ContractTemplate updated = templateRepository.save(template);
        return convertToDTO(updated);
    }

    @Transactional
    public void deleteTemplate(Long id) {
        ContractTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("模板不存在"));
        template.setIsDeleted(true);
        templateRepository.save(template);
    }

    @Transactional(readOnly = true)
    public List<VersionDTO> getTemplateVersions(Long templateId) {
        List<TemplateVersion> versions = versionRepository.findByTemplateIdOrderByVersionNumberDesc(templateId);
        return versions.stream().map(this::convertToVersionDTO).collect(Collectors.toList());
    }

    @Transactional
    public void restoreVersion(Long templateId, Integer versionNumber) {
        ContractTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new IllegalArgumentException("模板不存在"));

        TemplateVersion version = versionRepository.findByTemplateIdAndVersionNumber(templateId, versionNumber)
                .orElseThrow(() -> new IllegalArgumentException("版本不存在"));

        Path sourcePath = Paths.get(version.getFilePath());
        Path targetPath = Paths.get(template.getFilePath());

        try {
            Files.copy(sourcePath, targetPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            template.setVersion(template.getVersion() + 1);
            templateRepository.save(template);

            saveVersion(template, new File(version.getFilePath()), "从版本" + versionNumber + "恢复");
        } catch (IOException e) {
            throw new RuntimeException("恢复版本失败", e);
        }
    }

    @Transactional(readOnly = true)
    public List<TemplateVariableDTO> getTemplateVariables(Long templateId) {
        List<TemplateVariable> variables = variableRepository.findByTemplateIdOrderBySortOrderAsc(templateId);
        return variables.stream().map(this::convertToVariableDTO).collect(Collectors.toList());
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("文件不能为空");
        }
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".docx")) {
            throw new IllegalArgumentException("只支持.docx格式的文件");
        }
    }

    private String saveFile(MultipartFile file, String directory) {
        try {
            Path dirPath = Paths.get(directory);
            if (!Files.exists(dirPath)) {
                Files.createDirectories(dirPath);
            }

            String uuid = UUID.randomUUID().toString();
            String extension = file.getOriginalFilename().substring(file.getOriginalFilename().lastIndexOf("."));
            String filename = uuid + extension;
            Path filePath = dirPath.resolve(filename);

            file.transferTo(filePath.toFile());
            return filePath.toString();
        } catch (IOException e) {
            throw new RuntimeException("保存文件失败", e);
        }
    }

    private void saveInitialVersion(ContractTemplate template, MultipartFile file) {
        TemplateVersion version = new TemplateVersion();
        version.setTemplateId(template.getId());
        version.setVersionNumber(1);
        version.setFilePath(template.getFilePath());
        version.setFileName(template.getFileName());
        version.setChangeLog("初始版本");
        version.setCreatedBy(template.getCreatedBy());
        versionRepository.save(version);
    }

    private void saveVersion(ContractTemplate template, MultipartFile file, String changeLog) {
        String filePath = saveFile(file, versionDir);

        TemplateVersion version = new TemplateVersion();
        version.setTemplateId(template.getId());
        version.setVersionNumber(template.getVersion());
        version.setFilePath(filePath);
        version.setFileName(file.getOriginalFilename());
        version.setChangeLog(changeLog);
        version.setCreatedBy(template.getUpdatedBy());
        versionRepository.save(version);
    }

    private void saveVersion(ContractTemplate template, File file, String changeLog) {
        try {
            Path dirPath = Paths.get(versionDir);
            if (!Files.exists(dirPath)) {
                Files.createDirectories(dirPath);
            }

            String uuid = UUID.randomUUID().toString();
            String extension = file.getName().substring(file.getName().lastIndexOf("."));
            String filename = uuid + extension;
            Path filePath = dirPath.resolve(filename);

            Files.copy(file.toPath(), filePath);

            TemplateVersion version = new TemplateVersion();
            version.setTemplateId(template.getId());
            version.setVersionNumber(template.getVersion());
            version.setFilePath(filePath.toString());
            version.setFileName(file.getName());
            version.setChangeLog(changeLog);
            version.setCreatedBy(template.getUpdatedBy());
            versionRepository.save(version);
        } catch (IOException e) {
            throw new RuntimeException("保存版本失败", e);
        }
    }

    private List<TemplateVariable> extractVariables(Long templateId, MultipartFile file) {
        List<TemplateVariable> variables = new ArrayList<>();

        try (InputStream is = file.getInputStream();
             XWPFDocument document = new XWPFDocument(is)) {

            Set<String> variableNames = new HashSet<>();

            for (XWPFParagraph paragraph : document.getParagraphs()) {
                String text = paragraph.getText();
                extractTextVariables(text, variableNames);
                extractImageVariables(text, variableNames);
            }

            for (XWPFTable table : document.getTables()) {
                for (XWPFTableRow row : table.getRows()) {
                    for (XWPFTableCell cell : row.getTableCells()) {
                        for (XWPFParagraph paragraph : cell.getParagraphs()) {
                            String text = paragraph.getText();
                            extractTextVariables(text, variableNames);
                            extractImageVariables(text, variableNames);
                        }
                    }
                }
            }

            int sortOrder = 0;
            for (String name : variableNames) {
                TemplateVariable variable = new TemplateVariable();
                variable.setTemplateId(templateId);
                variable.setName(name);
                variable.setDisplayName(name);
                variable.setType("TEXT");
                variable.setRequired(false);
                variable.setSortOrder(sortOrder++);
                variables.add(variable);
            }

        } catch (IOException e) {
            throw new RuntimeException("解析模板文件失败", e);
        }

        return variables;
    }

    private void extractTextVariables(String text, Set<String> variableNames) {
        if (text == null) return;
        Matcher matcher = TEXT_VARIABLE_PATTERN.matcher(text);
        while (matcher.find()) {
            variableNames.add(matcher.group(1));
        }
    }

    private void extractImageVariables(String text, Set<String> variableNames) {
        if (text == null) return;
        Matcher matcher = IMAGE_VARIABLE_PATTERN.matcher(text);
        while (matcher.find()) {
            variableNames.add(matcher.group(1));
        }
    }

    private ContractTemplateDTO convertToDTO(ContractTemplate template) {
        ContractTemplateDTO dto = new ContractTemplateDTO();
        dto.setId(template.getId());
        dto.setName(template.getName());
        dto.setCode(template.getCode());
        dto.setCategoryId(template.getCategoryId());
        dto.setFilePath(template.getFilePath());
        dto.setFileName(template.getFileName());
        dto.setFileSize(template.getFileSize());
        dto.setVersion(template.getVersion());
        dto.setStatus(template.getStatus());
        dto.setDescription(template.getDescription());
        dto.setCreatedAt(template.getCreatedAt());
        dto.setUpdatedAt(template.getUpdatedAt());
        dto.setCreatedBy(template.getCreatedBy());
        dto.setUpdatedBy(template.getUpdatedBy());

        categoryRepository.findById(template.getCategoryId())
                .ifPresent(category -> dto.setCategoryName(category.getName()));

        List<TemplateVariable> variables = variableRepository.findByTemplateIdOrderBySortOrderAsc(template.getId());
        dto.setVariables(variables.stream().map(this::convertToVariableDTO).collect(Collectors.toList()));

        return dto;
    }

    private TemplateVariableDTO convertToVariableDTO(TemplateVariable variable) {
        TemplateVariableDTO dto = new TemplateVariableDTO();
        dto.setId(variable.getId());
        dto.setTemplateId(variable.getTemplateId());
        dto.setName(variable.getName());
        dto.setDisplayName(variable.getDisplayName());
        dto.setType(variable.getType());
        dto.setDefaultValue(variable.getDefaultValue());
        dto.setRequired(variable.getRequired());
        dto.setSortOrder(variable.getSortOrder());

        if (variable.getOptions() != null && !variable.getOptions().isEmpty()) {
            dto.setOptions(Arrays.asList(variable.getOptions().split(",")));
        }

        return dto;
    }

    private VersionDTO convertToVersionDTO(TemplateVersion version) {
        VersionDTO dto = new VersionDTO();
        dto.setId(version.getId());
        dto.setParentId(version.getTemplateId());
        dto.setVersionNumber(version.getVersionNumber());
        dto.setFilePath(version.getFilePath());
        dto.setFileName(version.getFileName());
        dto.setChangeLog(version.getChangeLog());
        dto.setCreatedAt(version.getCreatedAt());
        dto.setCreatedBy(version.getCreatedBy());
        return dto;
    }
}