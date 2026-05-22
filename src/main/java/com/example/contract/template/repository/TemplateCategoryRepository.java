package com.example.contract.template.repository;

import com.example.contract.template.entity.TemplateCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TemplateCategoryRepository extends JpaRepository<TemplateCategory, Long> {

    List<TemplateCategory> findByLevelAndIsDeletedFalse(Integer level);

    List<TemplateCategory> findByParentIdAndIsDeletedFalse(Long parentId);

    Optional<TemplateCategory> findByCodeAndIsDeletedFalse(String code);

    List<TemplateCategory> findByIsDeletedFalseOrderBySortOrderAsc();

    boolean existsByCode(String code);

    boolean existsByCodeAndIdNot(String code, Long id);
}