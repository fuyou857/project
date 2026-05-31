#!/usr/bin/env node
/**
 * 仅重置超级管理员密码（默认不改动权限、用户名、邮箱、角色、项目范围）
 *
 * 用法：
 *   SUPABASE_SERVICE_ROLE_KEY='…' node scripts/reset-super-admin.mjs
 *
 * 环境变量：
 *   INIT_ADMIN_PASSWORD     新密码（必填其一：本项或 RESET_GENERATE=1）
 *   RESET_GENERATE=1        自动生成 16 位密码
 *   RESET_TARGET_USERNAME   仅重置该用户名的超管（可选，避免误伤其他超管）
 *   RESET_ALLOW_CREATE=1    无任何超管时才创建新账号（默认不创建）
 *   RESET_FULL_OVERWRITE=1  危险：覆盖用户名/邮箱/role_ids（默认关闭，勿开）
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://wlkrdylgojkhgfzvcagc.supabase.co').trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const TARGET_USERNAME = (process.env.RESET_TARGET_USERNAME || '').trim();
const ALLOW_CREATE = process.env.RESET_ALLOW_CREATE === '1';
const FULL_OVERWRITE = process.env.RESET_FULL_OVERWRITE === '1';
const GENERATE = process.env.RESET_GENERATE === '1';

let PASSWORD = process.env.INIT_ADMIN_PASSWORD || '';
if (GENERATE) {
  PASSWORD = randomBytes(12).toString('base64url');
}

function fail(msg) {
  console.error(`[reset-admin] ${msg}`);
  process.exit(1);
}

if (!SERVICE_KEY) {
  fail('缺少 SUPABASE_SERVICE_ROLE_KEY');
}
if (!PASSWORD) {
  fail('请设置 INIT_ADMIN_PASSWORD 或 RESET_GENERATE=1');
}
if (FULL_OVERWRITE) {
  console.warn('[reset-admin] 警告：RESET_FULL_OVERWRITE=1 将覆盖用户名/邮箱/role_ids，一般不推荐');
}

function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) - hash) + password.charCodeAt(i);
    hash &= hash;
  }
  return `hash_${Math.abs(hash).toString(16)}`;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function resolveSuperAdminRoleId() {
  const { data: roles, error } = await admin.from('roles').select('id, code, name');
  if (error) throw error;
  const row = roles?.find((r) => r.code === 'super_admin' || r.name === '超级管理员');
  return row?.id ?? null;
}

async function listSuperAdmins(roleId) {
  const { data: users, error } = await admin
    .from('users')
    .select('id, username, email, phone, real_name, role_ids, project_ids, status, company_id');
  if (error) throw error;
  const all = users ?? [];
  if (!roleId) {
    return all.filter((u) => (u.role_ids || []).includes('super_admin'));
  }
  return all.filter((u) => {
    const ids = u.role_ids || [];
    return ids.includes(roleId);
  });
}

async function main() {
  console.log('[reset-admin] 模式：仅改密码，保留现有权限与资料（除非 RESET_FULL_OVERWRITE=1）');
  const roleId = await resolveSuperAdminRoleId();
  let supers = await listSuperAdmins(roleId);

  if (TARGET_USERNAME) {
    supers = supers.filter((u) => u.username === TARGET_USERNAME);
  }

  if (supers.length === 0) {
    if (!ALLOW_CREATE) {
      fail(
        '未找到超级管理员账号。不会自动创建（避免影响现有体系）。' +
          '若确需新建：RESET_ALLOW_CREATE=1，或到 Supabase Auth 手动创建。',
      );
    }
    fail('RESET_ALLOW_CREATE 创建流程已禁用，请使用 Supabase Dashboard 邀请用户或联系运维');
  }

  if (supers.length > 1 && !TARGET_USERNAME) {
    console.log('[reset-admin] 发现多名超管，将仅重置第一位（避免批量误操作）：');
    for (const u of supers) {
      console.log(`  - ${u.username} (${u.email || '无邮箱'}) id=${u.id}`);
    }
    console.log('[reset-admin] 若需指定用户：RESET_TARGET_USERNAME=你的用户名');
  }

  const target = supers[0];
  const authEmail = (target.email || '').trim();
  if (!authEmail) {
    fail(`用户「${target.username}」缺少 users.email，无法更新 Auth 密码。请在用户管理补内部邮箱，勿改 role_ids。`);
  }

  const { error: authErr } = await admin.auth.admin.updateUserById(target.id, {
    password: PASSWORD,
    email_confirm: true,
  });
  if (authErr) throw authErr;

  const patch = {
    password: hashPassword(PASSWORD),
    updated_at: new Date().toISOString(),
  };

  if (FULL_OVERWRITE) {
    Object.assign(patch, {
      username: process.env.INIT_ADMIN_USERNAME || target.username,
      email: process.env.INIT_ADMIN_EMAIL || authEmail,
      role_ids: roleId ? [roleId] : target.role_ids,
      status: 'active',
    });
  }

  const { error: upErr } = await admin.from('users').update(patch).eq('id', target.id);
  if (upErr) throw upErr;

  const credPath = path.join(process.cwd(), '.super-admin-credentials.txt');
  const lines = [
    '# 仅密码重置记录（role_ids / 权限未改）',
    `username=${target.username}`,
    `password=${PASSWORD}`,
    `email=${authEmail}`,
    `user_id=${target.id}`,
    `role_ids=${JSON.stringify(target.role_ids)}`,
    `reset_at=${new Date().toISOString()}`,
    '',
  ].join('\n');
  fs.writeFileSync(credPath, lines, { mode: 0o600 });

  console.log('');
  console.log('========== 密码已重置（权限未改） ==========');
  console.log(`用户名:     ${target.username}（未改）`);
  console.log(`新密码:     ${PASSWORD}`);
  console.log(`邮箱(内部): ${authEmail}（未改）`);
  console.log(`角色ID:     ${JSON.stringify(target.role_ids)}（未改）`);
  console.log('登录:       https://www.ciond.com/login （用户名或手机号 + 密码）');
  console.log(`凭证文件:   ${credPath}`);
  console.log('==========================================');
}

main().catch((e) => {
  fail(e instanceof Error ? e.message : String(e));
});
