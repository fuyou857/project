package com.example.contract.template.controller;

import com.example.contract.template.dto.request.ContractGenerateRequest;
import com.example.contract.template.dto.request.ContractUpdateRequest;
import com.example.contract.template.dto.response.ContractDTO;
import com.example.contract.template.dto.response.VersionDTO;
import com.example.contract.template.service.ContractService;
import javax.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/contracts")
public class ContractController {

    @Autowired
    private ContractService contractService;

    @PostMapping
    public ResponseEntity<ContractDTO> generateContract(@Valid @RequestBody ContractGenerateRequest request) {
        ContractDTO dto = contractService.generateContract(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping
    public ResponseEntity<List<ContractDTO>> getAllContracts() {
        List<ContractDTO> contracts = contractService.getAllContracts();
        return ResponseEntity.ok(contracts);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ContractDTO> getContractById(@PathVariable Long id) {
        ContractDTO dto = contractService.getContractById(id);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/no/{contractNo}")
    public ResponseEntity<ContractDTO> getContractByNo(@PathVariable String contractNo) {
        ContractDTO dto = contractService.getContractByNo(contractNo);
        return ResponseEntity.ok(dto);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ContractDTO> updateContract(
            @PathVariable Long id,
            @RequestBody ContractUpdateRequest request) {
        ContractDTO dto = contractService.updateContract(id, request);
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteContract(@PathVariable Long id) {
        contractService.deleteContract(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<Void> submitApproval(@PathVariable Long id) {
        contractService.submitApproval(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<Void> approveContract(
            @PathVariable Long id,
            @RequestParam("approver") String approver) {
        contractService.approveContract(id, approver);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<Void> rejectContract(
            @PathVariable Long id,
            @RequestParam("approver") String approver) {
        contractService.rejectContract(id, approver);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/versions")
    public ResponseEntity<List<VersionDTO>> getContractVersions(@PathVariable Long id) {
        List<VersionDTO> versions = contractService.getContractVersions(id);
        return ResponseEntity.ok(versions);
    }

    @PostMapping("/{id}/versions/{versionNumber}/restore")
    public ResponseEntity<Void> restoreContractVersion(
            @PathVariable Long id,
            @PathVariable Integer versionNumber) {
        contractService.restoreContractVersion(id, versionNumber);
        return ResponseEntity.ok().build();
    }
}