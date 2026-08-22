# AGENTS.md

## 项目概述

个人相册照片展示网站（V1），含公开前台与登录制管理后台。技术栈：Next.js 16 App Router + React 19 + TypeScript + Drizzle ORM + PostgreSQL（Neon）+ Cloudflare R2 + better-auth。包管理器为 pnpm（Node ≥ 20.9.0）。界面文案为中文，日期使用 `zh-CN` 格式化。

## 常用命令

```bash
pnpm dev            # 开发服务器（http://localhost:3000）
pnpm build          # 生产构建
pnpm typecheck      # tsc --noEmit
pnpm lint           # ESLint（eslint-config-next）
pnpm format         # Prettier 写入
pnpm format:check   # Prettier 检查
pnpm check          # typecheck + lint + format:check（提交前跑这个）
```

没有测试框架。`pnpm check` 是唯一的本地质量关卡。

### 数据库（Drizzle Kit）

```bash
pnpm db:generate    # 由 src/db/schema.ts 生成迁移（输出到 src/db/migrations）
pnpm db:migrate     # 应用迁移
pnpm db:push        # 直接推送 schema（跳过迁移文件）
```

## 架构

### 目录职责

- `src/app/(site)`：公开前台（首页、`/albums`、`/albums/[slug]`、`/photos/[id]`、`/about`），共享 `(site)/layout.tsx`。
- `src/app/admin`：管理后台。`(protected)` 组内是仪表盘、相册列表/新建/编辑/预览、上传页；`login` 在保护组外。Server Actions 集中在 `src/app/admin/actions.ts`。
- `src/app/api`：`/api/auth/[...all]`（better-auth）、`/api/admin/*`（上传与 slug 查询，均 `runtime = "nodejs"` 且自行校验会话）、`/api/health`、`/api/revalidate`、`/api/albums/[slug]/photos`（分页 JSON，limit 上限 48）。
- `src/server`：CLI 与网站共用的服务端领域层——`photos/`（照片处理管线）、`auth/`（better-auth 实例与会话守卫）、`admin/`（后台数据读取与相册/上传服务）。
- `src/importer`：仅剩 CLI 侧薄封装（文件遍历、参数解析），核心逻辑已抽到 `src/server/photos`；多数文件只是 re-export。
- `src/db`：Drizzle schema、Neon HTTP 客户端（懒加载单例 `getDb()`）、迁移文件。
- `src/storage`：R2（S3 API）封装，含预签名 PUT URL。
- `src/lib`：`gallery.ts`（网站数据读取层）、`uploads.ts`（上传常量/类型）、`lightbox.ts`、`album-slug.ts`、`routes.ts`。
- `src/proxy.ts`：Next.js 16 的中间件（旧 middleware.ts）。只检查 better-auth 会话 cookie 是否存在，不做角色校验。

### 数据模型（`src/db/schema.ts`）

- `photos`：核心表。`contentHash`（SHA-256）唯一索引用于去重；状态机 `PROCESSING → READY | FAILED`；存储完整 EXIF 及 `rawExif` jsonb、`blurhash`、经 Nominatim 反解的 `locationCity/locationDistrict`、`failureMessage`。
- `photo_variants`：每张照片的公开变体，唯一键 `(photoId, width, format)`。
- `albums`：`slug` 唯一（slug 允许中文字符，见 `normalizeAlbumSlug`）；状态 `DRAFT | PUBLISHED`；封面焦点 `coverFocalX/Y`（0–100）。
- `album_photos`：相册-照片关联（复合主键），带 `sortOrder` 和章节文案（`chapterTitle/chapterText`）。
- `photo_uploads`：后台上传任务。状态机 `PENDING → UPLOADED → PROCESSING → SUCCEEDED | FAILED`；记录 `reservedPhotoId`（预分配的照片 UUID）和暂存对象 Key（唯一索引）。
- better-auth 四表 `user/session/account/verification`：表名与列名由 better-auth 约定（text 主键、snake_case 列），角色存 `user.role`（逗号分隔字符串，后台要求含 `admin`）。改动需同时满足 drizzle adapter 期望。

网站层只读取 `PUBLISHED` 相册和 `READY` 照片；查询封装在 `src/lib/gallery.ts` 中，页面不直接查库。

### 照片处理管线（共享核心在 `src/server/photos/process-photo.ts`）

1. 校验并解析 EXIF（文件路径走 `inspectPhotoFile` 包装，Buffer 走 `inspectPhotoBuffer`）；
2. 计算原文件 SHA-256，已存在且 READY（且非 force）则跳过，只补标题或位置；
3. sharp 生成方向校正后的 480/960/1600/2400px AVIF（quality 62）+ WebP（quality 82）变体（`variant-config.ts` 定义尺寸），并计算 BlurHash；
4. 原图写入私有 R2 Bucket（`no-store`），变体写入公开 Bucket（`immutable` 一年缓存）；有 GPS 时调 Nominatim 反解城市/区县（限速 1.1s/次 + 进程内缓存，见 `photo-location.ts`）；
5. 写库标记 `READY`；失败标 `FAILED` 并记录 `failureMessage`，重跑可续传。

对象 Key 约定（`src/server/photos/object-key.ts`）：原图 `photos/{id}/original.{ext}`（私有），变体 `photos/{id}/{width}.{format}`（公开）。数据库只存 Key 不存域名，URL 在读取层用 `R2_PUBLIC_BASE_URL` 拼接（未配置则 url 为 null，前端显示占位）。

CLI 导入（`pnpm photo import`）与后台上传最终都走同一个 `processPhotoSource` / `processInspectedPhotoSource` 入口；改管线只需改 `src/server/photos`，两路自动生效。

### 管理后台认证

- better-auth 配置在 `src/server/auth/auth.ts`：邮箱密码登录、`disableSignUp: true`、admin 插件（角色 `admin`）、登录限流（60s 内最多 30 次）。
- `src/proxy.ts` 对 `/admin/:path*` 与 `/api/admin/:path*` 只做 cookie 存在性检查（未登录跳 `/admin/login?next=...` 或返回 401）。它不能验证角色或会话有效性——每个 Server Action 和 API Route 必须再调用 `requireAdmin()` / `getAdminSession()`（`src/server/auth/session.ts`）。新增后台接口时两层都要有。

### 后台上传流程（预签名直传）

1. `POST /api/admin/uploads` 创建批次（≤20 个文件、单个 ≤60MB、扩展名+Content-Type 双重白名单），写入 `photo_uploads` 并签发私有 Bucket 的 presigned PUT URL（TTL 10 分钟）；暂存 Key 为 `uploads/{uploadId}/{reservedPhotoId}/original.{ext}`。
2. 浏览器直传 R2（`UPLOAD_CONCURRENCY = 2`，逻辑在 `admin-upload-manager.tsx`）。
3. `POST /api/admin/uploads/[id]/complete` 用 HEAD 校验大小与 Content-Type → CAS 式认领（`PENDING|UPLOADED|FAILED → PROCESSING`，防并发重复处理）→ 下载 Buffer 走共享管线（用 `reservedPhotoId` 保证对象 Key 稳定）→ 去重命中或 Key 变化时删除暂存对象。
4. `POST /api/admin/uploads/[id]/retry`：R2 中对象完好则直接重新处理，否则重签 URL 回到 PENDING。

浏览器直传要求 R2 私有 Bucket 配 CORS 允许站点来源的 PUT（模板见 `docs/r2-upload-cors.example.json`），否则上传必然失败。

### 缓存与重新验证

`src/lib/gallery.ts` 中所有查询都包在 `unstable_cache` 里，统一使用 tag `gallery`（常量 `GALLERY_CACHE_TAG`）、revalidate 3600。三个入口都会刷新它：CLI 导入完成后调用 `SITE_REVALIDATE_URL`（即 `/api/revalidate`，Bearer `REVALIDATE_SECRET` 鉴权，timingSafeEqual 比较）；后台发布/取消发布及内容修改通过 `revalidateTag(GALLERY_CACHE_TAG, { expire: 0 })`。改动缓存策略时保持这个 tag 一致。

### 相册浏览流程

相册页是服务端组件：SSR 首屏取 `viewPages × 24` 张（`?view=` 参数，上限 20 页），余下由客户端 `AlbumPhotoStream` 滚动时请求 `/api/albums/[slug]/photos?offset=&limit=` 增量加载，并在返回相册时恢复已加载范围和滚动位置。灯箱（`PhotoLightbox`）与详情页共用 `src/lib/lightbox.ts` 的 `toLightboxPhoto`。

### 环境变量（`src/config/env.ts`，Zod 校验）

- 网站运行用 `readServerEnv()`：全部可选——没有 R2 配置时网站仍可运行（图片 URL 为 null）。
- CLI/导入用 `readImportEnv()`：`DATABASE_URL`、R2 五项全部必填。
- 管理员初始化用 `readAdminInitEnv()`：额外要求 `BETTER_AUTH_SECRET`（≥32 字符）、`BETTER_AUTH_URL`。
- `.env.local` 优先于 `.env`（`src/config/load-env.ts`，CLI 和 drizzle.config.ts 手动加载；Next.js 自身按其默认规则加载）。模板见 `.env.example`。

### 其他约定

- 路由与链接：相册 slug 可含中文，生成链接必须用 `src/lib/routes.ts` 的 `albumHref()`（`encodeURIComponent`）；Next.js 16 中页面 `params`/`searchParams` 是 Promise，API Route 使用 `RouteContext<"/api/...">` 类型。
- 错误日志统一输出结构化 JSON（见 `src/instrumentation.ts` 与 `/api/revalidate` 中的 `console.error` 模式）。
- 视觉设计基于 `DESIGN-bmw-m.md`（BMW M 风格的近黑底、白色大写标题设计系统），样式集中在 `src/app/globals.css`。
- 原图和公开图片变体不提交 Git；`photos/` 目录是本地待导入照片。

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->