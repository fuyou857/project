package com.example.contract.template.service;

import com.example.contract.template.dto.request.TemplateCategoryRequest;
import com.example.contract.template.dto.response.TemplateCategoryDTO;
import com.example.contract.template.entity.TemplateCategory;
import com.example.contract.template.repository.TemplateCategoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TemplateCategoryService {

    @Autowired
    private TemplateCategoryRepository categoryRepository;

    @Transactional
    public TemplateCategoryDTO createCategory(TemplateCategoryRequest request) {
        if (categoryRepository.existsByCode(request.getCode())) {
            throw new IllegalArgumentException("分类编码已存在");
        }

        TemplateCategory category = new TemplateCategory();
        category.setName(request.getName());
        category.setCode(request.getCode());
        category.setLevel(request.getLevel());
        category.setParentId(request.getParentId());
        category.setSortOrder(request.getSortOrder());
        category.setDescription(request.getDescription());
        category.setCreatedBy(request.getCreatedBy());

        TemplateCategory saved = categoryRepository.save(category);
        return convertToDTO(saved);
    }

    @Transactional(readOnly = true)
    public List<TemplateCategoryDTO> getAllCategories() {
        List<TemplateCategory> categories = categoryRepository.findByIsDeletedFalseOrderBySortOrderAsc();
        return categories.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TemplateCategoryDTO> getCategoriesByLevel(Integer level) {
        List<TemplateCategory> categories = categoryRepository.findByLevelAndIsDeletedFalse(level);
        return categories.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TemplateCategoryDTO> getCategoriesByParentId(Long parentId) {
        List<TemplateCategory> categories = categoryRepository.findByParentIdAndIsDeletedFalse(parentId);
        return categories.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TemplateCategoryDTO getCategoryById(Long id) {
        TemplateCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("分类不存在"));
        if (category.getIsDeleted()) {
            throw new IllegalArgumentException("分类已删除");
        }
        return convertToDTO(category);
    }

    @Transactional(readOnly = true)
    public TemplateCategoryDTO getCategoryByCode(String code) {
        TemplateCategory category = categoryRepository.findByCodeAndIsDeletedFalse(code)
                .orElseThrow(() -> new IllegalArgumentException("分类不存在"));
        return convertToDTO(category);
    }

    @Transactional
    public TemplateCategoryDTO updateCategory(Long id, TemplateCategoryRequest request) {
        TemplateCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("分类不存在"));

        if (category.getIsDeleted()) {
            throw new IllegalArgumentException("分类已删除");
        }

        if (!category.getCode().equals(request.getCode()) && categoryRepository.existsByCodeAndIdNot(request.getCode(), id)) {
            throw new IllegalArgumentException("分类编码已存在");
        }

        category.setName(request.getName());
        category.setCode(request.getCode());
        category.setLevel(request.getLevel());
        category.setParentId(request.getParentId());
        category.setSortOrder(request.getSortOrder());
        category.setDescription(request.getDescription());
        category.setUpdatedBy(request.getCreatedBy());

        TemplateCategory updated = categoryRepository.save(category);
        return convertToDTO(updated);
    }

    @Transactional
    public void deleteCategory(Long id) {
        TemplateCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("分类不存在"));
        category.setIsDeleted(true);
        categoryRepository.save(category);
    }

    @Transactional(readOnly = true)
    public List<TemplateCategoryDTO> getCategoryTree() {
        List<TemplateCategory> allCategories = categoryRepository.findByIsDeletedFalseOrderBySortOrderAsc();
        
        List<TemplateCategory> level1Categories = allCategories.stream()
                .filter(c -> c.getLevel() == 1)
                .collect(Collectors.toList());

        return level1Categories.stream().map(c -> buildCategoryTree(c, allCategories)).collect(Collectors.toList());
    }

    private TemplateCategoryDTO buildCategoryTree(TemplateCategory parent, List<TemplateCategory> allCategories) {
        TemplateCategoryDTO dto = convertToDTO(parent);
        
        List<TemplateCategory> children = allCategories.stream()
                .filter(c -> parent.getId().equals(c.getParentId()))
                .collect(Collectors.toList());

        if (!children.isEmpty()) {
            dto.setChildren(children.stream()
                    .map(c -> buildCategoryTree(c, allCategories))
                    .collect(Collectors.toList()));
        } else {
            dto.setChildren(new ArrayList<>());
        }

        return dto;
    }

    private TemplateCategoryDTO convertToDTO(TemplateCategory category) {
        TemplateCategoryDTO dto = new TemplateCategoryDTO();
        dto.setId(category.getId());
        dto.setName(category.getName());
        dto.setCode(category.getCode());
        dto.setLevel(category.getLevel());
        dto.setParentId(category.getParentId());
        dto.setSortOrder(category.getSortOrder());
        dto.setDescription(category.getDescription());
        dto.setCreatedAt(category.getCreatedAt());
        dto.setUpdatedAt(category.getUpdatedAt());
        dto.setCreatedBy(category.getCreatedBy());
        dto.setUpdatedBy(category.getUpdatedBy());

        if (category.getParentId() != null) {
            categoryRepository.findById(category.getParentId())
                    .ifPresent(parent -> dto.setParentName(parent.getName()));
        }

        return dto;
    }
}