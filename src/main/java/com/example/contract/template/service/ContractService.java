package com.example.contract.template.service;

import com.example.contract.template.dto.request.ContractGenerateRequest;
import com.example.contract.template.dto.request.ContractUpdateRequest;
import com.example.contract.template.dto.response.ContractDTO;
import com.example.contract.template.dto.response.VersionDTO;
import com.example.contract.template.entity.Contract;
import com.example.contract.template.entity.ContractTemplate;
import com.example.contract.template.entity.ContractVersion;
import com.example.contract.template.repository.ContractRepository;
import com.example.contract.template.repository.ContractTemplateRepository;
import com.example.contract.template.repository.ContractVersionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ContractService {

    @Autowired
    private ContractRepository contractRepository;

    @Autowired
    private ContractTemplateRepository templateRepository;

    @Autowired
    private ContractVersionRepository versionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${file.contract-dir:./contracts}")
    private String contractDir;

    private static final Pattern TEXT_VARIABLE_PATTERN = Pattern.compile("\\{\\{(\\w+)\\}\\}");

    @Transactional
    public ContractDTO generateContract(ContractGenerateRequest request) {
        ContractTemplate template = templateRepository.findById(request.getTemplateId())
                .orElseThrow(() -> new IllegalArgumentException("模板不存在"));

        String contractNo = generateContractNo();

        Map<String, Object> variables = request.getVariables() != null ? request.getVariables() : new HashMap<>();

        if (request.getPartyA() != null) {
            variables.put("partyA", request.getPartyA());
        }
        if (request.getPartyB() != null) {
            variables.put("partyB", request.getPartyB());
        }
        if (request.getProjectName() != null) {
            variables.put("projectName", request.getProjectName());
        }
        if (request.getContractAmount() != null) {
            variables.put("contractAmount", request.getContractAmount());
        }

        String filePath = generateContractFile(template, variables, contractNo);

        String variablesJson;
        try {
            variablesJson = objectMapper.writeValueAsString(variables);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("序列化变量失败", e);
        }

        Contract contract = new Contract();
        contract.setContractNo(contractNo);
        contract.setTemplateId(request.getTemplateId());
        contract.setName(request.getName());
        contract.setPartyA(request.getPartyA());
        contract.setPartyB(request.getPartyB());
        contract.setProjectName(request.getProjectName());
        contract.setContractAmount(request.getContractAmount());
        contract.setStatus("DRAFT");
        contract.setFilePath(filePath);
        contract.setVariablesJson(variablesJson);
        contract.setApprovalStatus("PENDING");
        contract.setCreatedBy(request.getCreatedBy());

        Contract saved = contractRepository.save(contract);

        saveInitialVersion(saved);

        return convertToDTO(saved);
    }

    @Transactional(readOnly = true)
    public List<ContractDTO> getAllContracts() {
        List<Contract> contracts = contractRepository.findByIsDeletedFalseOrderByCreatedAtDesc();
        return contracts.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ContractDTO getContractById(Long id) {
        Contract contract = contractRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("合同不存在"));
        if (contract.getIsDeleted()) {
            throw new IllegalArgumentException("合同已删除");
        }
        return convertToDTO(contract);
    }

    @Transactional(readOnly = true)
    public ContractDTO getContractByNo(String contractNo) {
        Contract contract = contractRepository.findByContractNoAndIsDeletedFalse(contractNo)
                .orElseThrow(() -> new IllegalArgumentException("合同不存在"));
        return convertToDTO(contract);
    }

    @Transactional
    public ContractDTO updateContract(Long id, ContractUpdateRequest request) {
        Contract contract = contractRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("合同不存在"));

        if (contract.getIsDeleted()) {
            throw new IllegalArgumentException("合同已删除");
        }

        Integer newVersion = contract.getVersion() != null ? contract.getVersion() + 1 : 2;

        if (request.getVariables() != null && !request.getVariables().isEmpty()) {
            Map<String, Object> currentVariables;
            try {
                currentVariables = contract.getVariablesJson() != null ?
                        objectMapper.readValue(contract.getVariablesJson(), Map.class) : new HashMap<>();
            } catch (JsonProcessingException e) {
                currentVariables = new HashMap<>();
            }
            currentVariables.putAll(request.getVariables());

            try {
                contract.setVariablesJson(objectMapper.writeValueAsString(currentVariables));
            } catch (JsonProcessingException e) {
                throw new RuntimeException("序列化变量失败", e);
            }

            ContractTemplate template = templateRepository.findById(contract.getTemplateId())
                    .orElseThrow(() -> new IllegalArgumentException("模板不存在"));

            String updatedFilePath = generateContractFile(template, currentVariables, contract.getContractNo());
            contract.setFilePath(updatedFilePath);
        }

        if (request.getName() != null) {
            contract.setName(request.getName());
        }
        if (request.getPartyA() != null) {
            contract.setPartyA(request.getPartyA());
        }
        if (request.getPartyB() != null) {
            contract.setPartyB(request.getPartyB());
        }
        if (request.getProjectName() != null) {
            contract.setProjectName(request.getProjectName());
        }
        if (request.getContractAmount() != null) {
            contract.setContractAmount(request.getContractAmount());
        }

        contract.setVersion(newVersion);
        contract.setUpdatedBy(request.getUpdatedBy());

        Contract updated = contractRepository.save(contract);

        saveVersion(updated, request.getChangeLog());

        return convertToDTO(updated);
    }

    @Transactional
    public void deleteContract(Long id) {
        Contract contract = contractRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("合同不存在"));
        contract.setIsDeleted(true);
        contractRepository.save(contract);
    }

    @Transactional
    public void submitApproval(Long id) {
        Contract contract = contractRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("合同不存在"));
        contract.setApprovalStatus("SUBMITTED");
        contractRepository.save(contract);
    }

    @Transactional
    public void approveContract(Long id, String approver) {
        Contract contract = contractRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("合同不存在"));
        contract.setApprovalStatus("APPROVED");
        contract.setStatus("ACTIVE");
        contract.setUpdatedBy(approver);
        contractRepository.save(contract);
    }

    @Transactional
    public void rejectContract(Long id, String approver) {
        Contract contract = contractRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("合同不存在"));
        contract.setApprovalStatus("REJECTED");
        contract.setUpdatedBy(approver);
        contractRepository.save(contract);
    }

    @Transactional(readOnly = true)
    public List<VersionDTO> getContractVersions(Long contractId) {
        List<ContractVersion> versions = versionRepository.findByContractIdOrderByVersionNumberDesc(contractId);
        return versions.stream().map(this::convertToVersionDTO).collect(Collectors.toList());
    }

    @Transactional
    public void restoreContractVersion(Long contractId, Integer versionNumber) {
        Contract contract = contractRepository.findById(contractId)
                .orElseThrow(() -> new IllegalArgumentException("合同不存在"));

        ContractVersion version = versionRepository.findByContractIdAndVersionNumber(contractId, versionNumber)
                .orElseThrow(() -> new IllegalArgumentException("版本不存在"));

        Path sourcePath = Paths.get(version.getFilePath());
        Path targetPath = Paths.get(contract.getFilePath());

        try {
            Files.copy(sourcePath, targetPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            Integer newVersion = contract.getVersion() != null ? contract.getVersion() + 1 : 2;
            contract.setVersion(newVersion);
            contractRepository.save(contract);

            saveVersion(contract, "从版本" + versionNumber + "恢复");
        } catch (IOException e) {
            throw new RuntimeException("恢复版本失败", e);
        }
    }

    private String generateContractNo() {
        String year = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy"));
        String prefix = "HT-" + year + "-";

        String maxNo = contractRepository.findMaxContractNoByPrefix(prefix);

        int nextNumber = 1;
        if (maxNo != null) {
            String numberPart = maxNo.substring(prefix.length());
            nextNumber = Integer.parseInt(numberPart) + 1;
        }

        return prefix + String.format("%04d", nextNumber);
    }

    private String generateContractFile(ContractTemplate template, Map<String, Object> variables, String contractNo) {
        try {
            Path templatePath = Paths.get(template.getFilePath());
            if (!Files.exists(templatePath)) {
                throw new RuntimeException("模板文件不存在");
            }

            Path dirPath = Paths.get(contractDir);
            if (!Files.exists(dirPath)) {
                Files.createDirectories(dirPath);
            }

            String filename = contractNo + ".docx";
            Path outputPath = dirPath.resolve(filename);

            try (InputStream is = Files.newInputStream(templatePath);
                 XWPFDocument document = new XWPFDocument(is)) {

                for (XWPFParagraph paragraph : document.getParagraphs()) {
                    replaceVariablesInParagraph(paragraph, variables);
                }

                for (XWPFTable table : document.getTables()) {
                    for (XWPFTableRow row : table.getRows()) {
                        for (XWPFTableCell cell : row.getTableCells()) {
                            for (XWPFParagraph paragraph : cell.getParagraphs()) {
                                replaceVariablesInParagraph(paragraph, variables);
                            }
                        }
                    }
                }

                try (OutputStream os = Files.newOutputStream(outputPath)) {
                    document.write(os);
                }
            }

            return outputPath.toString();
        } catch (IOException e) {
            throw new RuntimeException("生成合同文件失败", e);
        }
    }

    private void replaceVariablesInParagraph(XWPFParagraph paragraph, Map<String, Object> variables) {
        String text = paragraph.getText();
        if (text == null) return;

        Matcher matcher = TEXT_VARIABLE_PATTERN.matcher(text);
        StringBuffer sb = new StringBuffer();

        while (matcher.find()) {
            String variableName = matcher.group(1);
            Object value = variables.get(variableName);
            String replacement = value != null ? value.toString() : "";
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);

        String newText = sb.toString();
        if (!text.equals(newText)) {
            List<XWPFRun> runs = paragraph.getRuns();
            if (runs != null && runs.size() > 0) {
                runs.get(0).setText(newText, 0);
                for (int i = 1; i < runs.size(); i++) {
                    paragraph.removeRun(i);
                }
            }
        }
    }

    private void saveInitialVersion(Contract contract) {
        ContractVersion version = new ContractVersion();
        version.setContractId(contract.getId());
        version.setVersionNumber(1);
        version.setFilePath(contract.getFilePath());
        version.setFileName(contract.getContractNo() + ".docx");
        version.setChangeLog("初始版本");
        version.setCreatedBy(contract.getCreatedBy());
        versionRepository.save(version);
    }

    private void saveVersion(Contract contract, String changeLog) {
        ContractVersion version = new ContractVersion();
        version.setContractId(contract.getId());
        version.setVersionNumber(contract.getVersion());
        version.setFilePath(contract.getFilePath());
        version.setFileName(contract.getContractNo() + ".docx");
        version.setChangeLog(changeLog != null ? changeLog : "合同更新");
        version.setCreatedBy(contract.getUpdatedBy());
        versionRepository.save(version);
    }

    private ContractDTO convertToDTO(Contract contract) {
        ContractDTO dto = new ContractDTO();
        dto.setId(contract.getId());
        dto.setContractNo(contract.getContractNo());
        dto.setTemplateId(contract.getTemplateId());
        dto.setName(contract.getName());
        dto.setPartyA(contract.getPartyA());
        dto.setPartyB(contract.getPartyB());
        dto.setProjectName(contract.getProjectName());
        dto.setContractAmount(contract.getContractAmount());
        dto.setSignDate(contract.getSignDate());
        dto.setStartDate(contract.getStartDate());
        dto.setEndDate(contract.getEndDate());
        dto.setStatus(contract.getStatus());
        dto.setFilePath(contract.getFilePath());
        dto.setApprovalStatus(contract.getApprovalStatus());
        dto.setApprovalFlowId(contract.getApprovalFlowId());
        dto.setCreatedAt(contract.getCreatedAt());
        dto.setUpdatedAt(contract.getUpdatedAt());
        dto.setCreatedBy(contract.getCreatedBy());
        dto.setUpdatedBy(contract.getUpdatedBy());

        templateRepository.findById(contract.getTemplateId())
                .ifPresent(template -> dto.setTemplateName(template.getName()));

        return dto;
    }

    private VersionDTO convertToVersionDTO(ContractVersion version) {
        VersionDTO dto = new VersionDTO();
        dto.setId(version.getId());
        dto.setParentId(version.getContractId());
        dto.setVersionNumber(version.getVersionNumber());
        dto.setFilePath(version.getFilePath());
        dto.setFileName(version.getFileName());
        dto.setChangeLog(version.getChangeLog());
        dto.setCreatedAt(version.getCreatedAt());
        dto.setCreatedBy(version.getCreatedBy());
        return dto;
    }
}