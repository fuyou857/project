/**
 * 管理员账户初始化（仅服务端运行）
 *
 * 必填环境变量：
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   INIT_ADMIN_EMAIL
 *   INIT_ADMIN_PASSWORD
 *
 * 可选：
 *   INIT_ADMIN_USERNAME（默认 admin）
 *
 * 示例：
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... INIT_ADMIN_EMAIL=... INIT_ADMIN_PASSWORD=... node scripts/init-admin.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.INIT_ADMIN_EMAIL;
const PASSWORD = process.env.INIT_ADMIN_PASSWORD;
const USERNAME = process.env.INIT_ADMIN_USERNAME || 'admin';

function requireEnv(name, value) {
  if (!value || String(value).trim() === '') {
    console.error(`缺少环境变量: ${name}`);
    process.exit(1);
  }
}

requireEnv('SUPABASE_URL', SUPABASE_URL);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY);
requireEnv('INIT_ADMIN_EMAIL', EMAIL);
requireEnv('INIT_ADMIN_PASSWORD', PASSWORD);

/** 与历史脚本一致的占位哈希（若库表仍保留 password 列）；登录以 Supabase Auth 为准 */
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

async function initAdmin() {
  console.log('正在初始化管理员账户（服务端脚本）...');

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data: roles, error: rolesError } = await supabaseAdmin.from('roles').select('*');

    if (rolesError) {
      console.error('获取角色列表失败:', rolesError.message);
      process.exit(1);
    }

    let superAdminRoleId = 'super_admin';
    if (roles && roles.length > 0) {
      const superAdminRole = roles.find(
        (r) => r.code === 'super_admin' || r.key === 'super_admin' || r.name === '超级管理员',
      );
      if (superAdminRole) {
        superAdminRoleId = superAdminRole.id;
      }
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        const existingUsers = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers.data.users.find(u => u.email === EMAIL);
        if (existingUser) {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: PASSWORD });
          console.log('用户已存在，已更新密码');
        }
      } else {
        throw authError;
      }
    }

    const userId = authUser?.user?.id ||
      (await supabaseAdmin.auth.admin.listUsers()).data.users.find(u => u.email === EMAIL)?.id;

    if (!userId) {
      throw new Error('无法获取用户ID');
    }

    await supabaseAdmin.from('users').delete().eq('email', EMAIL);

    const insertPayload = {
      id: userId,
      username: USERNAME,
      email: EMAIL,
      password: hashPassword(PASSWORD),
      real_name: '系统管理员',
      phone: null,
      company_id: null,
      role_ids: [superAdminRoleId],
      project_ids: [],
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabaseAdmin.from('users').insert(insertPayload);

    if (insertError) {
      console.error('业务表插入失败:', insertError.message);
      process.exit(1);
    }

    console.log('管理员账户初始化完成。请使用 INIT_ADMIN_EMAIL / INIT_ADMIN_PASSWORD 登录应用（勿在日志中泄露密码）。');
  } catch (err) {
    console.error('初始化失败:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

initAdmin();
