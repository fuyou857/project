package com.example.contract.template.dto.request;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ContractUpdateRequest {

    private String name;

    private String partyA;

    private String partyB;

    private String projectName;

    private Double contractAmount;

    private Map<String, Object> variables;

    private String changeLog;

    private String updatedBy;
}