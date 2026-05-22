package com.example.contract.template.dto.request;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ContractGenerateRequest {

    @NotNull(message = "模板ID不能为空")
    private Long templateId;

    @NotBlank(message = "合同名称不能为空")
    private String name;

    private String partyA;

    private String partyB;

    private String projectName;

    private Double contractAmount;

    private Map<String, Object> variables;

    private String createdBy;
}