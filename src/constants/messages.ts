export const MESSAGES = {
  SAVE_SUCCESS: '保存成功',
  SAVE_FAILED: '保存失败，请重试',
  DELETE_SUCCESS: '删除成功',
  DELETE_FAILED: '删除失败，请重试',
  DELETE_CONFIRM: '确定要删除吗？此操作不可恢复。',
  NETWORK_ERROR: '网络连接失败，请检查网络后重试',
  LOAD_FAILED: '数据加载失败，请刷新重试',

  PROJECT_CREATE_SUCCESS: '项目创建成功',
  PROJECT_UPDATE_SUCCESS: '项目更新成功',
  PROJECT_DELETE_CONFIRM: '确定要删除该项目吗？',

  CONTRACT_CREATE_SUCCESS: '合同创建成功',
  CONTRACT_UPDATE_SUCCESS: '合同更新成功',
  CONTRACT_SUBMIT_SUCCESS: '合同已提交审批',

  APPROVAL_SUBMIT_SUCCESS: '审批已提交',
  APPROVAL_APPROVE_SUCCESS: '审批通过',
  APPROVAL_REJECT_SUCCESS: '已驳回',
  APPROVAL_REJECT_REQUIRED: '驳回原因不能为空',

  UPLOAD_SUCCESS: '上传成功',
  UPLOAD_FAILED: '上传失败，请重试',
  UPLOAD_FILE_TOO_LARGE: '文件大小超过限制',
  UPLOAD_INVALID_TYPE: '不支持的文件类型',

  LOGIN_SUCCESS: '登录成功',
  LOGIN_FAILED: '用户名或密码错误',
  LOGOUT_CONFIRM: '确定要退出登录吗？',
} as const;