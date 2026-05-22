# 构建配置变更记录

## 变更日期
2026-05-11

## 变更目的
优化构建配置，确保最终构建产物仅生成一个独立的bundle文件，便于部署和管理。

## 变更文件
`webpack.config.js`

## 配置变更详情

### 1. 输出文件名配置
**变更前：**
```javascript
filename: isDev ? 'bundle.js' : 'bundle.[contenthash].js',
```
**变更后：**
```javascript
filename: isDev ? 'bundle.js' : 'bundle.js',
```
**说明：** 移除了生产环境下的contenthash，确保始终输出固定的bundle.js文件名。

### 2. 禁用运行时代码分割
**新增配置：**
```javascript
optimization: {
  moduleIds: 'deterministic',
  runtimeChunk: false,  // 新增：禁用运行时代码分割
  splitChunks: false   // 新增：禁用所有chunk分割
}
```
**说明：** 显式禁用webpack的代码分割功能，确保所有代码打包到单一文件中。

### 3. 资源内联配置
**变更前（图片资源）：**
```javascript
{
  test: /\.(png|jpe?g|gif|webp|ico|svg)$/i,
  type: 'asset',
  parser: { dataUrlCondition: { maxSize: 8 * 1024 } }
}
```
**变更后：**
```javascript
{
  test: /\.(png|jpe?g|gif|webp|ico|svg)$/i,
  type: 'asset/inline'
}
```

**变更前（字体资源）：**
```javascript
{
  test: /\.(woff2?|eot|ttf|otf)$/i,
  type: 'asset/resource'
}
```
**变更后：**
```javascript
{
  test: /\.(woff2?|eot|ttf|otf)$/i,
  type: 'asset/inline'
}
```

**变更前（兜底资源）：**
```javascript
{
  // 兜底规则：PDF、文档、音视频等所有其他文件一律输出为独立资源文件
  exclude: /\.(js|jsx|ts|tsx|mjs|css|json|html)$/i,
  type: 'asset/resource'
}
```
**变更后：**
```javascript
{
  // 兜底规则：所有其他文件一律内联到bundle中
  exclude: /\.(js|jsx|ts|tsx|mjs|css|json|html)$/i,
  type: 'asset/inline'
}
```
**说明：** 将所有资源类型改为`asset/inline`，确保图片、字体等资源都以内联data URL的形式嵌入到bundle中，不生成独立文件。

## 构建产物验证

### 变更前（多个文件）：
```
dist/
├── bundle.4414db9f6cb6bd204ed4.js
├── bundle.4414db9f6cb6bd204ed4.js.LICENSE.txt
├── bundle.86477269dc6b926b9d14.js
├── bundle.86477269dc6b926b9d14.js.LICENSE.txt
├── bundle.cf2a9b930d648ed28430.js
├── ... (多个历史bundle文件)
├── index.html
└── ...
```

### 变更后（单一文件）：
```
dist/
├── bundle.js          # 单一bundle文件，包含所有代码和资源
├── bundle.js.LICENSE.txt  # 许可证信息（可选辅助文件）
└── index.html
```

## 构建大小
- 单一bundle文件大小：2.27 MiB（minified）
- 符合项目预期，所有功能完整

## 注意事项
1. **功能完整性**：所有功能代码保持不变，仅修改构建配置
2. **性能影响**：由于所有资源内联，首次加载可能稍慢，但部署更简单
3. **缓存策略**：固定文件名意味着每次更新都需要清除浏览器缓存，或者在部署时修改index.html中的引用
4. **License文件**：bundle.js.LICENSE.txt是第三方库许可证信息文件，可保留用于合规性

## 回滚方法
如需回滚到多文件构建配置：
1. 恢复原始的webpack.config.js
2. 重新运行npm run build

## 相关文件
- 原始配置备份：无（通过git history管理）
- 当前构建配置：webpack.config.js
