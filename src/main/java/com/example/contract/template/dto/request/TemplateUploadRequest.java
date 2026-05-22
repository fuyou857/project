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
public class TemplateUploadRequest {

    @NotBlank(message = "模板名称不能为空")
    @Size(max = 200, message = "模板名称长度不能超过200个字符")
    private String name;

    @NotBlank(message = "模板编码不能为空")
    @Size(max = 50, message = "模板编码长度不能超过50个字符")
    private String code;

    @NotNull(message = "分类ID不能为空")
    private Long categoryId;

    @Size(max = 1000, message = "描述长度不能超过1000个字符")
    private String description;

    private String createdBy;
}