#!/bin/bash

echo "=========================================="
echo "项目问题修复验证脚本"
echo "=========================================="

# 1. 检查 Git 提交记录
echo ""
echo "1. 最近 10 次提交记录"
git log --oneline -10

# 2. 检查关键组件是否存在
echo ""
echo "2. 关键组件检查"
COMPONENTS=(
  "src/components/ErrorBoundary.tsx"
  "src/components/ui/UiModalOverlay.tsx"
  "src/components/WechatWorkLogin.tsx"
  "src/hooks/useSafeFileInput.ts"
  "src/hooks/useCancellableRequest.ts"
  "src/hooks/useOptimisticUpdate.ts"
  "src/components/VirtualTable.tsx"
  "src/components/LazyImage.tsx"
  "src/components/SensitiveAmount.tsx"
  "src/components/ui/SkeletonLoader.tsx"
  "src/components/Chart.tsx"
  "src/utils/errorHandler.ts"
  "src/constants/messages.ts"
  "src/constants/endpoints.ts"
)

for comp in "${COMPONENTS[@]}"; do
  if [ -f "$comp" ]; then
    echo "✅ $comp"
  else
    echo "❌ $comp 不存在"
  fi
done

# 3. 检查修复相关的代码模式
echo ""
echo "3. 修复代码检查"

# 检查 stopPropagation 使用
STOP_PROP_COUNT=$(grep -r "stopPropagation" src/components/ --include="*.tsx" 2>/dev/null | wc -l)
echo "stopPropagation 使用次数: $STOP_PROP_COUNT"

# 检查 try/catch 在 handleClose 中的使用
TRY_CATCH_COUNT=$(grep -r "try {" src/components/ --include="*.tsx" -A5 | grep -c "handleClose\|onClose" || echo 0)
echo "handleClose 中的 try/catch 次数: $TRY_CATCH_COUNT"

# 检查 async downloadJsonRowsAsXlsx 调用
ASYNC_DOWNLOAD=$(grep -r "await.*downloadJsonRowsAsXlsx" src/ --include="*.tsx" 2>/dev/null | wc -l)
echo "await downloadJsonRowsAsXlsx 调用次数: $ASYNC_DOWNLOAD"

# 检查动态导入 xlsx
DYNAMIC_XLSX=$(grep -r "import('xlsx')" src/ --include="*.ts" 2>/dev/null | wc -l)
echo "动态导入 xlsx 次数: $DYNAMIC_XLSX"

# 4. 检查 Nginx 配置
echo ""
echo "4. Nginx 配置检查"
nginx -t 2>&1 | head -3

# 5. 检查前端构建
echo ""
echo "5. 前端构建检查"
if [ -d dist ]; then
  echo "✅ dist 目录存在"
  echo "   文件数量: $(find dist -name "*.js" | wc -l)"
  echo "   总大小: $(du -sh dist | cut -f1)"
else
  echo "❌ dist 目录不存在"
fi

# 6. 检查部署版本
echo ""
echo "6. 部署版本检查"
if [ -f "releases/.current-version" ]; then
  echo "当前版本: v$(cat releases/.current-version)"
else
  echo "版本文件不存在"
fi

# 7. 检查依赖
echo ""
echo "7. 新增依赖检查"
DEPS=(
  "react-window"
  "@types/react-window"
)
for dep in "${DEPS[@]}"; do
  if node -e "require('$dep/package.json')" 2>/dev/null; then
    echo "✅ $dep"
  else
    echo "❌ $dep 未安装"
  fi
done

echo ""
echo "=========================================="
echo "验证完成"
echo "=========================================="
