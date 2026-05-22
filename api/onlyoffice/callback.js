const express = require('express');
const router = express.Router();

// ONLYOFFICE 回调接口
router.post('/callback', (req, res) => {
  try {
    const body = req.body;
    
    // 验证签名（可选）
    // const signature = req.headers['x-onlyoffice-signature'];
    // 验证签名的逻辑
    
    // 处理不同的状态
    if (body.status === 2) {
      // 文档已保存
      console.log('Document saved successfully:', body);
      // 这里可以处理保存逻辑，比如下载新文档并更新到存储
    } else if (body.status === 3) {
      // 文档保存失败
      console.error('Document save failed:', body);
    }
    
    // 返回成功响应
    res.status(200).json({ error: 0 });
  } catch (error) {
    console.error('Error handling ONLYOFFICE callback:', error);
    res.status(500).json({ error: 1 });
  }
});

module.exports = router;
