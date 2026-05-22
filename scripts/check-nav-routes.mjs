/**
 * 静态校验：navMenuDefinition 中所有菜单 path 均能被 routes.tsx 中某条路由匹配，
 * 避免只改菜单漏配路由导致 404。
 *
 * 匹配规则与 React Router 片段一致：段数相同；路由段为 :param 则任意非空段可匹配。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function read(p) {
  return fs.readFileSync(path.join(root, p), 'utf8');
}

/** @param {string} fileContent */
function extractRoutePaths(fileContent) {
  const paths = [];
  const re = /\bpath:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(fileContent)) !== null) {
    paths.push(m[1]);
  }
  return paths;
}

/** @param {string} fileContent */
function extractNavMenuPaths(fileContent) {
  const start = fileContent.indexOf('export const NAV_MENU_ITEMS');
  if (start === -1) {
    throw new Error('NAV_MENU_ITEMS not found in navMenuDefinition.tsx');
  }
  const slice = fileContent.slice(start);
  const end = slice.indexOf('];');
  const block = end === -1 ? slice : slice.slice(0, end + 2);

  const paths = [];
  const re = /\bpath:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    paths.push(m[1]);
  }
  return [...new Set(paths)];
}

/**
 * candidate 是否与 routePattern 匹配（段级，:id 等占位）
 * @param {string} candidate
 * @param {string} routePattern
 */
function matchesRoutePattern(candidate, routePattern) {
  const norm = (s) => {
    const t = s.trim();
    if (t === '') return '/';
    return t.startsWith('/') ? t : '/' + t;
  };
  const c = norm(candidate);
  const r = norm(routePattern);
  const cSeg = c === '/' ? [] : c.slice(1).split('/');
  const rSeg = r === '/' ? [] : r.slice(1).split('/');
  if (cSeg.length !== rSeg.length) return false;
  for (let i = 0; i < rSeg.length; i++) {
    if (rSeg[i].startsWith(':')) continue;
    if (cSeg[i] !== rSeg[i]) return false;
  }
  return true;
}

/**
 * @param {string} menuPath
 * @param {string[]} routePaths
 */
function menuPathCovered(menuPath, routePaths) {
  return routePaths.some((rp) => matchesRoutePattern(menuPath, rp));
}

/** routePermissions 中字面量 path（prefix 特例等），须与 routes 一致 */
function extractRoutePermissionsLiteralPaths(fileContent) {
  const paths = [];
  const re = /\bpath:\s*['"](\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(fileContent)) !== null) {
    paths.push(m[1]);
  }
  return [...new Set(paths)];
}

/** 以下静态路由无菜单入口属正常（重定向、登录等），不参与「孤立路由」告警 */
/** 旧书签重定向等：无菜单项但须保留路由 */
const STATIC_ROUTE_SKIP_ORPHAN = new Set(['/', '/login', '/contract-templates']);

/**
 * 是否存在菜单或 routePermissions 字面量路径 a，使 route === a 或 route 为其子路径。
 * @param {string} routePath
 * @param {string[]} entryPaths
 */
function staticRouteCoveredByEntries(routePath, entryPaths) {
  return entryPaths.some((a) => routePath === a || routePath.startsWith(`${a}/`));
}

function main() {
  const navSrc = read('src/config/navMenuDefinition.tsx');
  const permSrc = read('src/config/routePermissions.ts');
  const routesSrc = read('src/config/routes.tsx');

  const routePaths = extractRoutePaths(routesSrc);
  const menuPaths = extractNavMenuPaths(navSrc);
  const permPaths = extractRoutePermissionsLiteralPaths(permSrc);

  const allRequired = [...new Set([...menuPaths, ...permPaths])];
  const missing = allRequired.filter((p) => !menuPathCovered(p, routePaths));

  if (missing.length > 0) {
    console.error(
      '[check-nav-routes] 以下 path（菜单或 routePermissions 字面量）在 routes.tsx 中无匹配路由：\n',
      missing.map((p) => `  - ${p}`).join('\n'),
    );
    process.exit(1);
  }

  /** 反向：静态路由是否都能关联到某菜单/权限入口（避免菜单漏配但路由仍存在） */
  const orphans = routePaths.filter((rp) => {
    if (rp.includes(':')) return false;
    if (STATIC_ROUTE_SKIP_ORPHAN.has(rp)) return false;
    return !staticRouteCoveredByEntries(rp, allRequired);
  });

  if (orphans.length > 0) {
    console.error(
      '[check-nav-routes] 以下 routes.tsx 中的静态路由未被任何菜单或 routePermissions 字面量覆盖（孤立路由）。若属有意为之请扩展 STATIC_ROUTE_SKIP_ORPHAN 或补菜单：\n',
      orphans.map((p) => `  - ${p}`).join('\n'),
    );
    process.exit(1);
  }

  console.log(
    `[check-nav-routes] OK：菜单 ${menuPaths.length} 条 + routePermissions 字面量 ${permPaths.length} 条（去重后 ${allRequired.length}）均已覆盖；` +
      `routes 静态路由无孤立项（动态含 : 段已跳过）；routes 共 ${routePaths.length} 条 path 声明。`,
  );
}

main();
