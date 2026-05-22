package com.example.contract.template.repository;

import com.example.contract.template.entity.TemplateVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TemplateVersionRepository extends JpaRepository<TemplateVersion, Long> {

    List<TemplateVersion> findByTemplateIdOrderByVersionNumberDesc(Long templateId);

    Optional<TemplateVersion> findByTemplateIdAndVersionNumber(Long templateId, Integer versionNumber);

    Integer countByTemplateId(Long templateId);

    void deleteByTemplateId(Long templateId);
}