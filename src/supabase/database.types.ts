/**
 * Supabase 生成的 Database 类型占位。
 *
 * 生成本文件（覆盖本文件）：
 *   npm run gen:types
 *
 * 或本地已 link 项目：
 *   npx supabase gen types typescript --local > src/supabase/database.types.ts
 *
 * 或指定 project ref：
 *   npx supabase gen types typescript --project-id <ref> > src/supabase/database.types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** 在运行 gen:types 之前为宽松占位，避免 `Tables` 为 `never` 导致全项目推断崩溃 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
