package com.example.contract.template.dto.request;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TemplateCategoryRequest {

    @NotBlank(message = "分类名称不能为空")
    @Size(max = 100, message = "分类名称长度不能超过100个字符")
    private String name;

    @NotBlank(message = "分类编码不能为空")
    @Size(max = 50, message = "分类编码长度不能超过50个字符")
    private String code;

    @NotNull(message = "分类级别不能为空")
    private Integer level;

    private Long parentId;

    private Integer sortOrder;

    @Size(max = 500, message = "描述长度不能超过500个字符")
    private String description;

    private String createdBy;
}