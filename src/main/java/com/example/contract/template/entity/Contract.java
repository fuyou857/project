package com.example.contract.template.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "contract")
public class Contract {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "contract_no", unique = true, nullable = false, length = 50)
    private String contractNo;

    @Column(name = "template_id", nullable = false)
    private Long templateId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id", insertable = false, updatable = false)
    private ContractTemplate template;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "party_a", length = 200)
    private String partyA;

    @Column(name = "party_b", length = 200)
    private String partyB;

    @Column(name = "project_name", length = 300)
    private String projectName;

    @Column(name = "contract_amount")
    private Double contractAmount;

    @Column(name = "sign_date")
    private LocalDateTime signDate;

    @Column(name = "start_date")
    private LocalDateTime startDate;

    @Column(name = "end_date")
    private LocalDateTime endDate;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "DRAFT";

    @Column(name = "version")
    private Integer version = 1;

    @Column(name = "file_path", length = 500)
    private String filePath;

    @Column(name = "variables_json", columnDefinition = "TEXT")
    private String variablesJson;

    @Column(name = "approval_status", length = 20)
    private String approvalStatus = "PENDING";

    @Column(name = "approval_flow_id")
    private Long approvalFlowId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "created_by", length = 50)
    private String createdBy;

    @Column(name = "updated_by", length = 50)
    private String updatedBy;

    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}