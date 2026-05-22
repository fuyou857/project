import { describe, expect, it } from 'vitest';
import { APPROVER_ROLE_TO_ROLE_CODES, roleCodesToApproverRoles } from '../constants/approvalRoles';

describe('approvalWorkflow role mapping', () => {
  it('APPROVER_ROLE_TO_ROLE_CODES includes admin aliases', () => {
    expect(APPROVER_ROLE_TO_ROLE_CODES.admin).toContain('admin');
    expect(APPROVER_ROLE_TO_ROLE_CODES.admin).toContain('super_admin');
  });

  it('roleCodesToApproverRoles maps business roles', () => {
    expect(roleCodesToApproverRoles(['manager', 'accountant'])).toEqual(
      expect.arrayContaining(['manager', 'accountant']),
    );
    expect(roleCodesToApproverRoles(['super_admin'])).toContain('admin');
  });

  it('roleCodesToApproverRoles deduplicates', () => {
    const roles = roleCodesToApproverRoles(['manager', 'manager']);
    expect(roles.filter((r) => r === 'manager')).toHaveLength(1);
  });
});
