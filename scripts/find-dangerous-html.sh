#!/bin/bash
echo "=== 查找所有 dangerouslySetInnerHTML 使用 ==="
grep -rn "dangerouslySetInnerHTML" --include="*.tsx" --include="*.jsx" src/

echo ""
echo "=== 查找所有 innerHTML 赋值 ==="
grep -rn "\.innerHTML\s*=" --include="*.tsx" --include="*.jsx" src/