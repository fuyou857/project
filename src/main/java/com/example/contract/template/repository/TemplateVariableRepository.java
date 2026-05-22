package com.example.contract.template.repository;

import com.example.contract.template.entity.TemplateVariable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TemplateVariableRepository extends JpaRepository<TemplateVariable, Long> {

    List<TemplateVariable> findByTemplateIdOrderBySortOrderAsc(Long templateId);

    void deleteByTemplateId(Long templateId);
}