# Photo Website

个人相册照片展示网站的 V1 基础项目。

## 当前结构

- `src/app`：Next.js 网站页面和 API Route
- `src/db`：Drizzle ORM Schema、数据库客户端和迁移文件
- `src/importer`：照片检查、EXIF 解析、图片处理和对象存储相关代码
- `src/storage`：Cloudflare R2 访问封装
- `src/cli`：本地照片 CLI 入口

## 开始使用

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

打开 <http://localhost:3000> 查看网站。

## 常用命令

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm check
pnpm db:generate
pnpm photo --help
pnpm photo inspect path/to/photo.jpg
```

原图和公开图片变体不会提交到 Git；它们将在后续导入流程中分别写入私有和公开 R2 Bucket。
