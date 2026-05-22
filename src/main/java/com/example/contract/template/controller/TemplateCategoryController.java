package com.example.contract.template.controller;

import com.example.contract.template.dto.request.TemplateCategoryRequest;
import com.example.contract.template.dto.response.TemplateCategoryDTO;
import com.example.contract.template.service.TemplateCategoryService;
import javax.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class TemplateCategoryController {

    @Autowired
    private TemplateCategoryService categoryService;

    @PostMapping
    public ResponseEntity<TemplateCategoryDTO> createCategory(@Valid @RequestBody TemplateCategoryRequest request) {
        TemplateCategoryDTO dto = categoryService.createCategory(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping
    public ResponseEntity<List<TemplateCategoryDTO>> getAllCategories(
            @RequestParam(required = false) Integer level,
            @RequestParam(required = false) Long parentId) {
        List<TemplateCategoryDTO> categories;
        if (level != null) {
            categories = categoryService.getCategoriesByLevel(level);
        } else if (parentId != null) {
            categories = categoryService.getCategoriesByParentId(parentId);
        } else {
            categories = categoryService.getAllCategories();
        }
        return ResponseEntity.ok(categories);
    }

    @GetMapping("/tree")
    public ResponseEntity<List<TemplateCategoryDTO>> getCategoryTree() {
        List<TemplateCategoryDTO> tree = categoryService.getCategoryTree();
        return ResponseEntity.ok(tree);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TemplateCategoryDTO> getCategoryById(@PathVariable Long id) {
        TemplateCategoryDTO dto = categoryService.getCategoryById(id);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/code/{code}")
    public ResponseEntity<TemplateCategoryDTO> getCategoryByCode(@PathVariable String code) {
        TemplateCategoryDTO dto = categoryService.getCategoryByCode(code);
        return ResponseEntity.ok(dto);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TemplateCategoryDTO> updateCategory(
            @PathVariable Long id,
            @Valid @RequestBody TemplateCategoryRequest request) {
        TemplateCategoryDTO dto = categoryService.updateCategory(id, request);
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        categoryService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }
}