package com.example.contract.template.dto.response;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ContractDTO {

    private Long id;

    private String contractNo;

    private Long templateId;

    private String templateName;

    private String name;

    private String partyA;

    private String partyB;

    private String projectName;

    private Double contractAmount;

    private LocalDateTime signDate;

    private LocalDateTime startDate;

    private LocalDateTime endDate;

    private String status;

    private String filePath;

    private String approvalStatus;

    private Long approvalFlowId;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String createdBy;

    private String updatedBy;
}