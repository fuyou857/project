export const PAGE_SIZE = 15;

export const DATE_FORMAT = 'YYYY-MM-DD';

export const API_TIMEOUT = 30000;

export const TOAST_DURATION = 3000;

export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  CURRENT_COMPANY: 'currentCompanyId',
} as const;

export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
} as const;

export const COMPANY_TYPES = {
  HEADQUARTERS: '总公司',
  BRANCH: '分公司',
  PROJECT: '项目部',
} as const;

export const PARTY_A_TYPES = [
  '建设单位',
  '总包单位',
  '分包单位',
] as const;

export const PARTY_B_TYPES = [
  '材料类',
  '劳务类',
  '专业分包',
] as const;

export const TAXPAYER_TYPES = [
  '一般纳税人',
  '小规模纳税人',
] as const;

export const PROJECT_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SUSPENDED: 'suspended',
} as const;

export const CONTRACT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const INVOICE_STATUS = {
  PENDING: 'pending',
  ISSUED: 'issued',
  CANCELLED: 'cancelled',
} as const;

export const PAGINATION_CONFIG = {
  PAGE_SIZE,
  MAX_PAGE_NUMBERS: 7,
} as const;
