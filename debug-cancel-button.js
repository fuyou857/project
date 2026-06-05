// ========================================
// 请在浏览器控制台粘贴执行以下代码
// 用于精准定位发票录入弹窗的"取消"按钮
// ========================================

console.log('=== 精准定位发票录入弹窗 ===');

// 1. 找到包含"确认入库"按钮的弹窗（这是发票录入弹窗的唯一标识）
const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
const invoiceDialog = dialogs.find(d => d.textContent.includes('确认入库'));

if (!invoiceDialog) {
  console.error('❌ 未找到发票录入弹窗！');
  console.log('当前所有弹窗按钮:');
  dialogs.forEach((d, i) => {
    const btns = Array.from(d.querySelectorAll('button')).map(b => b.textContent.trim());
    console.log(`  弹窗 ${i}:`, btns);
  });
} else {
  console.log('✅ 找到发票录入弹窗');
  
  // 2. 找到该弹窗内的"取消"按钮
  const cancelBtn = Array.from(invoiceDialog.querySelectorAll('button')).find(b => b.textContent.trim() === '取消');
  
  if (!cancelBtn) {
    console.error('❌ 未找到"取消"按钮');
  } else {
    console.log('✅ 找到"取消"按钮');
    console.log('按钮元素:', cancelBtn);
    console.log('按钮位置:', cancelBtn.getBoundingClientRect());
    console.log('pointer-events:', getComputedStyle(cancelBtn).pointerEvents);
    console.log('visibility:', getComputedStyle(cancelBtn).visibility);
    console.log('display:', getComputedStyle(cancelBtn).display);
    console.log('opacity:', getComputedStyle(cancelBtn).opacity);
    console.log('z-index:', getComputedStyle(cancelBtn).zIndex);
    
    // 3. 检查是否有元素遮挡
    const centerX = cancelBtn.getBoundingClientRect().left + cancelBtn.getBoundingClientRect().width / 2;
    const centerY = cancelBtn.getBoundingClientRect().top + cancelBtn.getBoundingClientRect().height / 2;
    const elementAtPoint = document.elementFromPoint(centerX, centerY);
    console.log('按钮中心点的元素:', elementAtPoint);
    console.log('是否为取消按钮本身:', elementAtPoint === cancelBtn);
    
    // 4. 尝试直接触发点击
    console.log('--- 尝试程序化点击 ---');
    try {
      cancelBtn.click();
      console.log('✅ click() 执行成功');
    } catch (e) {
      console.error('❌ click() 失败:', e);
    }
    
    // 5. 尝试 dispatchEvent
    try {
      cancelBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      console.log('✅ dispatchEvent 执行成功');
    } catch (e) {
      console.error(' dispatchEvent 失败:', e);
    }
  }
}

console.log('=== 调试完成 ===');