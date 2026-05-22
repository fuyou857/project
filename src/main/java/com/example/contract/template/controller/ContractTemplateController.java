package com.example.contract.template.controller;

import com.example.contract.template.dto.request.TemplateUploadRequest;
import com.example.contract.template.dto.response.ContractTemplateDTO;
import com.example.contract.template.dto.response.TemplateVariableDTO;
import com.example.contract.template.dto.response.VersionDTO;
import com.example.contract.template.service.ContractTemplateService;
import javax.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/templates")
public class ContractTemplateController {

    @Autowired
    private ContractTemplateService templateService;

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<ContractTemplateDTO> uploadTemplate(
            @RequestParam("file") MultipartFile file,
            @RequestParam("name") String name,
            @RequestParam("code") String code,
            @RequestParam("categoryId") Long categoryId,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "createdBy", required = false) String createdBy) {

        TemplateUploadRequest request = new TemplateUploadRequest();
        request.setName(name);
        request.setCode(code);
        request.setCategoryId(categoryId);
        request.setDescription(description);
        request.setCreatedBy(createdBy);

        ContractTemplateDTO dto = templateService.uploadTemplate(file, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping
    public ResponseEntity<List<ContractTemplateDTO>> getAllTemplates(
            @RequestParam(required = false) Long categoryId) {
        List<ContractTemplateDTO> templates;
        if (categoryId != null) {
            templates = templateService.getTemplatesByCategory(categoryId);
        } else {
            templates = templateService.getAllTemplates();
        }
        return ResponseEntity.ok(templates);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ContractTemplateDTO> getTemplateById(@PathVariable Long id) {
        ContractTemplateDTO dto = templateService.getTemplateById(id);
        return ResponseEntity.ok(dto);
    }

    @PutMapping(value = "/{id}", consumes = "multipart/form-data")
    public ResponseEntity<ContractTemplateDTO> updateTemplate(
            @PathVariable Long id,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam("name") String name,
            @RequestParam("code") String code,
            @RequestParam("categoryId") Long categoryId,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "createdBy", required = false) String createdBy) {

        TemplateUploadRequest request = new TemplateUploadRequest();
        request.setName(name);
        request.setCode(code);
        request.setCategoryId(categoryId);
        request.setDescription(description);
        request.setCreatedBy(createdBy);

        ContractTemplateDTO dto = templateService.updateTemplate(id, file, request);
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        templateService.deleteTemplate(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/versions")
    public ResponseEntity<List<VersionDTO>> getTemplateVersions(@PathVariable Long id) {
        List<VersionDTO> versions = templateService.getTemplateVersions(id);
        return ResponseEntity.ok(versions);
    }

    @PostMapping("/{id}/versions/{versionNumber}/restore")
    public ResponseEntity<Void> restoreVersion(
            @PathVariable Long id,
            @PathVariable Integer versionNumber) {
        templateService.restoreVersion(id, versionNumber);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/variables")
    public ResponseEntity<List<TemplateVariableDTO>> getTemplateVariables(@PathVariable Long id) {
        List<TemplateVariableDTO> variables = templateService.getTemplateVariables(id);
        return ResponseEntity.ok(variables);
    }
}