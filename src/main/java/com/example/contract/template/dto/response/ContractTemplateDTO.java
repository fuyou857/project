package com.example.contract.template.dto.response;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ContractTemplateDTO {

    private Long id;

    private String name;

    private String code;

    private Long categoryId;

    private String categoryName;

    private String filePath;

    private String fileName;

    private Long fileSize;

    private Integer version;

    private String status;

    private String description;

    private List<TemplateVariableDTO> variables;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String createdBy;

    private String updatedBy;
}