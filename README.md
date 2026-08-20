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
pnpm photo import path/to/photos --album japan-2026 --album-title "Japan 2026"
pnpm photo import path/to/photos --album japan-2026 --dry-run
pnpm photo album update japan-2026 --context "雨季的东京" --focus-x 42 --focus-y 30
pnpm photo album chapter japan-2026 --photo <photo-id> --title "清晨" --text "从第一班电车开始。"
```

## 照片导入

导入 CLI 支持单个文件或目录递归扫描。它会：

1. 校验图片并读取 EXIF；
2. 计算原文件 SHA-256，避免重复照片；
3. 创建或复用相册；
4. 生成方向校正后的 480、960、1600、2400px AVIF 与 WebP 变体，并计算 BlurHash；
5. 把原图写入私有 R2 Bucket，把变体写入公开 R2 Bucket；
6. 写入 PostgreSQL，并将照片状态从 `PROCESSING` 更新为 `READY`；
7. 发生失败时标记为 `FAILED`，下次重复运行可以继续导入。

```bash
# 先只在本地解析、压缩，不写数据库和 R2
pnpm photo import ./photos --album japan-2026 --dry-run

# 正式导入；相册不存在时会自动创建并发布
pnpm photo import ./photos --album japan-2026 --album-title "Japan 2026"

# 强制重新上传已经 READY 的照片
pnpm photo import ./photos --album japan-2026 --force
```

`--force` 也可用于为旧照片补齐 AVIF 变体和 BlurHash。相册页每次加载 24 张照片，滚动接近底部时会继续加载，并在返回相册时恢复已加载范围和滚动位置。

## 相册叙事与封面焦点

```bash
# 设置拍摄背景、封面照片和裁切焦点（0–100）
pnpm photo album update japan-2026 --context "雨季的东京，从清晨到最后一班电车。" --cover <photo-id> --focus-x 42 --focus-y 30

# 在指定照片之前插入章节标题与文字
pnpm photo album chapter japan-2026 --photo <photo-id> --title "清晨" --text "从第一班电车开始。"
```

原图和公开图片变体不会提交到 Git；导入流程只保存对象 Key，不依赖域名。域名配置完成后，网站层再用公开 Bucket 的自定义域名拼接图片 URL。
