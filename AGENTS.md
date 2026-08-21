# AGENTS.md

## 项目概述

个人相册照片展示网站（V1）。技术栈：Next.js 16 App Router + React 19 + TypeScript + Drizzle ORM + PostgreSQL（Neon）+ Cloudflare R2。包管理器为 pnpm（Node ≥ 20.9.0）。界面文案为中文，日期使用 `zh-CN` 格式化。

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

### 照片 CLI（`pnpm photo`，入口 `src/cli/index.ts`）

```bash
pnpm photo inspect <图片路径>                          # 只读尺寸和 EXIF，不上传
pnpm photo import <文件或目录> --album <slug> [选项]    # 导入照片
pnpm photo update <photo-id> --title "..." [--description "..."]
pnpm photo album update <slug> [--context ... --cover <photo-id> --focus-x 0-100 --focus-y 0-100]
pnpm photo album chapter <slug> --photo <photo-id> --title "..." --text "..."
```

导入选项：`--album-title`（新建相册时显示的标题）、`--title`（单张照片标题，默认取文件名）、`--dry-run`（仅本地解析压缩，不写库不传 R2）、`--force`（重传已 READY 的照片，也可用来给旧照片补齐 AVIF/BlurHash）。

## 架构

### 目录职责

- `src/app`：页面与 API Route。页面有首页、`/albums`、`/albums/[slug]`、`/photos/[id]`、`/about`；API 有 `/api/health`、`/api/revalidate`、`/api/albums/[slug]/photos`（分页 JSON，limit 上限 48）。
- `src/db`：Drizzle schema、Neon HTTP 客户端（懒加载单例 `getDb()`）、迁移文件。
- `src/importer`：照片导入管线（EXIF 解析 exifr、sharp 变体生成、去重、CLI 子命令实现）。
- `src/storage`：R2（S3 API）封装，懒加载单例客户端。
- `src/lib`：`gallery.ts`（网站数据读取层，全部 Server 端）与 `lightbox.ts`（灯箱数据转换）。
- `src/components`：React 组件（照片网格、灯箱、相册卡片等）。

### 数据模型（`src/db/schema.ts`）

- `photos`：核心表。`contentHash`（SHA-256）唯一索引用于去重；状态机 `PROCESSING → READY | FAILED`；存储完整 EXIF 及 `rawExif` jsonb、`blurhash`、`failureMessage`。
- `photo_variants`：每张照片的公开变体，唯一键 `(photoId, width, format)`。
- `albums`：`slug` 唯一（slug 允许中文字符，见 `normalizeAlbumSlug`）；状态 `DRAFT | PUBLISHED`；封面焦点 `coverFocalX/Y`（0–100）。
- `album_photos`：相册-照片关联（复合主键），带 `sortOrder` 和章节文案（`chapterTitle/chapterText`）。

网站层只读取 `PUBLISHED` 相册和 `READY` 照片；查询封装在 `src/lib/gallery.ts` 中，页面不直接查库。

### 照片导入管线（`src/importer/import-photo.ts`）

1. `inspectPhotoFile` 校验并解析 EXIF；
2. 计算原文件 SHA-256，已存在且 READY（且非 `--force`）则跳过上传、只补标题或关联相册；
3. `ensureAlbum` 创建或复用相册（并发下用唯一冲突 23505 兜底）；
4. sharp 生成方向校正后的 480/960/1600/2400px AVIF（quality 62）+ WebP（quality 82）变体（见 `src/importer/variants.ts`、`constants.ts`），并计算 BlurHash；
5. 原图写入私有 R2 Bucket（`no-store`），变体写入公开 Bucket（`immutable` 一年缓存）；
6. 写库并标记 `READY`；任一步失败标记 `FAILED` 并记录 `failureMessage`，重跑可续传。

对象 Key 约定（`src/importer/object-key.ts`）：原图 `photos/{id}/original.{ext}`（私有），变体 `photos/{id}/{width}.{format}`（公开）。数据库只存 Key，不存域名；URL 在 `gallery.ts` 中用 `R2_PUBLIC_BASE_URL` 拼接（未配置则 url 为 null，前端显示占位）。

### 缓存与重新验证

`src/lib/gallery.ts` 中所有查询都包在 `unstable_cache` 里，统一使用 tag `gallery`、revalidate 3600。CLI 导入完成后调用 `SITE_REVALIDATE_URL`（即 `/api/revalidate`，Bearer `REVALIDATE_SECRET` 鉴权，timingSafeEqual 比较）触发 `revalidateTag`。改动缓存策略时保持这个 tag 一致。

### 相册浏览流程

相册页是服务端组件：SSR 首屏取 `viewPages × 24` 张（`?view=` 参数，上限 20 页），余下由客户端 `AlbumPhotoStream` 滚动时请求 `/api/albums/[slug]/photos?offset=&limit=` 增量加载，并在返回相册时恢复已加载范围和滚动位置。灯箱（`PhotoLightbox`）与详情页共用 `src/lib/lightbox.ts` 的 `toLightboxPhoto`。

### 环境变量（`src/config/env.ts`，Zod 校验）

- 网站运行用 `readServerEnv()`：全部可选——没有 R2 配置时网站仍可运行（图片 URL 为 null）。
- CLI/导入用 `readImportEnv()`：`DATABASE_URL`、R2 五项全部必填。
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