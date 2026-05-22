package com.example.contract.template.dto.response;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TemplateVariableDTO {

    private Long id;

    private Long templateId;

    private String name;

    private String displayName;

    private String type;

    private String defaultValue;

    private Boolean required;

    private List<String> options;

    private Integer sortOrder;
}