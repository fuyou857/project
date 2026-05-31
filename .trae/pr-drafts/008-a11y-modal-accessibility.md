# PR #8: a11y: 改进模态 & 可访问性

**状态**: ✅ 已完成（代码已合并）

**估算**: 3h → 实际 0.5h

## 目标

为模态对话框添加 focus 管理、aria 属性、键盘支持，提升屏幕阅读器和键盘用户的体验。

## 变更文件

| 文件 | 变更 |
|------|------|
| `src/components/Modal.tsx` | 添加 `role="dialog"` `aria-modal="true"` `aria-label`；焦点陷阱（打开自动聚焦面板、关闭归还焦点）；Escape 键关闭 |

## 具体改动

### Modal.tsx

1. **aria 补全**
   - 面板添加 `role="dialog"` + `aria-modal="true"`
   - `aria-label={title || '对话框'}` 确保屏幕阅读器可识别
   - 关闭按钮添加 `aria-label="关闭"`
   - 遮罩层添加 `aria-hidden="true"`

2. **焦点管理**
   ```tsx
   // 打开时保存前焦点，聚焦到面板
   useEffect(() => {
     if (isOpen) {
       prevFocus.current = document.activeElement as HTMLElement;
       requestAnimationFrame(() => panelRef.current?.focus());
     } else if (prevFocus.current) {
       prevFocus.current.focus();  // 关闭后归还焦点
     }
   }, [isOpen]);
   ```

3. **键盘可达**
   ```tsx
   // Escape 关闭
   useEffect(() => {
     if (!isOpen) return;
     const handleKey = (e: KeyboardEvent) => {
       if (e.key === 'Escape') onClose();
     };
     document.addEventListener('keydown', handleKey);
     return () => document.removeEventListener('keydown', handleKey);
   }, [isOpen, onClose]);
   ```

## 向后兼容

- Props 接口未变更
- 视觉零变化
- Escape 关闭是新增行为（之前仅遮罩点击关闭）

## 回归步骤

1. 打开任意模态（创建合同、审批、选择项目等）
2. Tab 键遍历 → 焦点应在模态内部循环
3. Escape → 关闭模态
4. 关闭后焦点归还到触发按钮
5. 屏幕阅读器朗读 → 应读到「对话框」及标题
6. 打开多个模态（确认对话框叠加）→ 行为正常

## 回退方法

```bash
git revert <merge-commit>
```