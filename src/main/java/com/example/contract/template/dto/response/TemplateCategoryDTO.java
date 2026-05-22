package com.example.contract.template.dto.response;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TemplateCategoryDTO {

    private Long id;

    private String name;

    private String code;

    private Integer level;

    private Long parentId;

    private String parentName;

    private Integer sortOrder;

    private String description;

    private List<TemplateCategoryDTO> children;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String createdBy;

    private String updatedBy;
}