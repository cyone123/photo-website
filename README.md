<div align="center">

# 📷 Photo Website

**专为摄影师与视觉创作者打造的现代高性能个人摄影相册展示与管理系统**

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2_Storage-F38020?style=flat-square&logo=cloudflare)](https://developers.cloudflare.com/r2/)
[![Better Auth](https://img.shields.io/badge/Auth-Better--Auth-orange?style=flat-square)](https://www.better-auth.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](#-许可证)

<p align="center">
  <a href="#-核心特性">核心特性</a> •
  <a href="#-技术架构">技术架构</a> •
  <a href="#-技术栈">技术栈</a> •
  <a href="#-快速上手">快速上手</a> •
  <a href="#-配置说明">配置说明</a> •
  <a href="#-使用指南">使用指南</a> •
  <a href="#-常用命令">常用命令</a> •
  <a href="#-部署说明">部署说明</a>
</p>

</div>

---

## 📖 项目简介

**Photo Website** 是一个兼具极致前台视觉呈现与强大后台管理能力的个人摄影作品展示系统。

系统采用 **BMW M 极简暗黑设计语言**，针对高分辨率摄影作品进行了端到端性能调优。无论是通过本地 CLI 工具极速批量导入上千张照片，还是在 Web 后台拖拽上传，系统都会全自动完成 EXIF 提取、智能方向矫正、多尺寸现代格式（AVIF）转码、BlurHash 占位图计算、地理位置反解及双桶云存储分发。

---

## ✨ 核心特性

### 🖼️ 高性能图片处理管线

- **现代格式转码**：基于 `sharp` 自动识别 EXIF 方向并生成 480px / 960px / 1600px / 2400px 四种尺寸的 **AVIF** 格式变体（Quality 62），大幅节省带宽并提升加载速度。
- **秒级占位防抖**：自动提取并内嵌 **BlurHash**，在图片加载前渲染柔和模糊占位，消除页面排版抖动（CLS）。
- **SHA-256 哈希去重**：自动计算原图内容散列，防止相同照片重复导入与存储浪费。
- **双桶存储架构**：原图安全归档于私有 Bucket，衍生变体发布于公开 Bucket 并配置为期 1 年的 `immutable` CDN 缓存。

### 🎨 沉浸式前台画廊

- **极简暗黑美学**：基于深邃近黑底色、高对比排版与平滑过渡动画，让焦点始终停留在摄影作品本身。
- **动态无限滚动流**：采用 React 19 服务端组件（RSC）加速首屏呈现，客户端自动按需追加分页（24 张/批次），支持路由返回时**精准恢复已加载位置与滚动进度**。
- **全功能沉浸灯箱**：支持触控手势滑动、键盘快捷键导航、全屏模式以及完整的拍摄参数面板（相机型号、镜头、焦段、光圈、快门、ISO、拍摄时间、地点等）。

### 📖 叙事性相册与章节编排

- **相册故事背景**：为每个相册设定专属叙事背景（Context），并在画廊前优雅展示。
- **封面焦点控制**：支持自定义封面横纵焦点坐标（0%–100%），确保各种屏幕比例下均能居中呈现构图重心。
- **多章节划分**：相册内支持在指定照片前插入章节标题与导言，打造画册般的连贯叙事感。
- **友好 URL**：原生支持中文字符 Slug 及 URL 自动安全编码。

### 📥 灵活的双模导入工作流

- **CLI 批量导入**：支持递归扫描本地目录、多线程并发处理（`--concurrency`）、`--dry-run` 预览与 `--force` 变体/参数补齐。
- **Web 端直传 R2**：后台支持多图批量拖拽上传，通过 S3 预签名 URL（Presigned PUT）直接上传至私有存储，结合 CAS 状态机进行后端异步认领与转码。

### 📍 智能地理位置反解

- 自动提取照片 EXIF GPS 信息，结合 Nominatim 服务反解并结构化存储拍摄城市与区县信息，内置防限速（1.1s/次）与进程内缓存。

### 🔒 完备的管理员认证体系

- 基于 Better Auth 实现安全的邮箱密码登录，支持密码复杂度校验与防暴力破解速率限制。
- Next.js 中间件轻量守卫 + 服务端 Action / API 双重强校验，全面保障管理端安全性。

---

## 🏗️ 技术架构

### 系统数据流与管线

```mermaid
flowchart TD
    subgraph Ingestion ["📥 导入渠道 (Dual-Mode Ingestion)"]
        CLI["💻 本地 CLI 导入<br/>(pnpm photo import)"]
        WebAdmin["🌐 Web 管理后台直传<br/>(Presigned PUT URL)"]
    end

    subgraph Pipeline ["⚙️ 核心处理管线 (src/server/photos)"]
        ExifParser["1. EXIF 解析 & 方向校验<br/>(exifr)"]
        Hasher["2. SHA-256 散列去重"]
        Transcode["3. AVIF 多变体生成<br/>480 / 960 / 1600 / 2400px (sharp)"]
        BlurhashGen["4. BlurHash 占位计算"]
        GeoRev["5. GPS 逆地理编码<br/>(Nominatim)"]
    end

    subgraph StorageLayer ["☁️ 存储与数据库"]
        R2Private[("🔒 Cloudflare R2 (私有桶)<br/>原图归档")]
        R2Public[("🌐 Cloudflare R2 (公开桶)<br/>AVIF 变体 (CDN 缓存)")]
        DB[("🗄️ PostgreSQL (Neon)<br/>Drizzle ORM")]
    end

    subgraph Frontend ["🚀 公开展示前台 (Next.js 16 App Router)"]
        RSC["SSR / RSC 首屏直出<br/>(unstable_cache: tag 'gallery')"]
        InfiniteScroll["客户端无限滚动流<br/>(AlbumPhotoStream)"]
        Lightbox["沉浸式 EXIF 灯箱<br/>(PhotoLightbox)"]
    end

    CLI --> ExifParser
    WebAdmin --> ExifParser
    ExifParser --> Hasher
    Hasher --> Transcode
    Transcode --> BlurhashGen
    BlurhashGen --> GeoRev

    GeoRev --> R2Private
    GeoRev --> R2Public
    GeoRev --> DB

    DB --> RSC
    R2Public --> InfiniteScroll
    R2Public --> Lightbox
```

### 目录结构

```text
photo-website/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (site)/          # 公开展示前台 (首页、相册、单图详情、关于)
│   │   ├── admin/           # 管理后台 (仪表盘、相册管理、上传、登录)
│   │   └── api/             # API 端点 (better-auth、admin 上传/解析、分页 JSON、缓存重刷)
│   ├── cli/                 # 本地 CLI 工具 (导入、修改、管理员初始化)
│   ├── components/          # 共享 UI 组件 (画廊流、灯箱、卡片、后台表单等)
│   ├── config/              # 环境变量加载与 Zod 模式校验
│   ├── db/                  # 数据库 Schema、Neon HTTP 客户端、迁移配置
│   ├── importer/            # CLI 侧薄封装与批量扫描工具
│   ├── lib/                 # 网站数据读取层 (gallery.ts)、路由与通用辅助工具
│   ├── server/              # 核心服务端领域层 (图片处理管线、认证、后台数据服务)
│   ├── storage/             # Cloudflare R2 (S3 API) 客户端与预签名封装
│   └── proxy.ts             # Next.js 16 路由代理中间件
├── docs/                    # 补充文档与 CORS 示例配置
├── photos/                  # 本地待导入照片默认放置目录 (已忽略 Git)
└── drizzle.config.ts        # Drizzle Kit 配置文件
```

---

## 🛠️ 技术栈

| 领域           | 技术选型                            | 说明                                                      |
| :------------- | :---------------------------------- | :-------------------------------------------------------- |
| **核心框架**   | **Next.js 16** (App Router)         | 全面拥抱 React Server Components 与现代路由机制           |
| **视图层**     | **React 19** / **TypeScript**       | 现代 UI 开发范式与全链路严格类型检查                      |
| **数据持久化** | **PostgreSQL (Neon Serverless)**    | 无服务器高可用 Postgres 数据库                            |
| **ORM 工具**   | **Drizzle ORM** & **Drizzle Kit**   | 轻量、类型安全、高性能的 SQL-like ORM                     |
| **对象存储**   | **Cloudflare R2**                   | 兼容 S3 API 的零出口费对象存储，支持 CDN 边缘分发         |
| **身份认证**   | **Better Auth**                     | 现代全栈认证库（Drizzle 适配器）                          |
| **图像转码**   | **Sharp**                           | 高性能 Node.js 图像处理内核（AVIF / 尺寸裁剪 / 色彩校正） |
| **元数据提取** | **exifr** / **blurhash**            | EXIF / GPS / 镜头信息解析与占位散列生成                   |
| **样式系统**   | **Custom CSS Design System**        | 基于 BMW M 极简暗黑美学构建的专属样式库                   |
| **代码规范**   | **ESLint** / **Prettier** / **tsc** | 严格的代码风格检查与静态类型校验                          |

---

## 🚀 快速上手

### 1. 环境准备

确保您的本地环境满足以下最低版本要求：

- **Node.js** `>= 20.9.0`
- **pnpm** `>= 9.0.0`
- 一个 PostgreSQL 数据库实例（推荐 [Neon](https://neon.tech/)）
- 一个 [Cloudflare](https://www.cloudflare.com/) 账户并创建两个 R2 Bucket（私有桶 + 公开桶）

### 2. 克隆项目与安装依赖

```bash
git clone https://github.com/your-username/photo-website.git
cd photo-website
pnpm install
```

### 3. 配置环境变量

复制环境变量模板文件并填写相关配置：

```bash
# Windows PowerShell
Copy-Item .env.example .env.local

# macOS / Linux
cp .env.example .env.local
```

编辑 `.env.local` 文件，配置数据库连接、Better Auth 密钥及 Cloudflare R2 凭证（详细参数参见[配置说明](#-配置说明)）。

### 4. 初始化数据库 Schema

```bash
# 推送数据表结构到数据库
pnpm db:push

# 或者生成并应用标准迁移文件：
# pnpm db:generate
# pnpm db:migrate
```

### 5. 初始化首个管理员账号

系统禁用了公开注册通道，请通过交互式命令行初始化第一个超级管理员账号：

```bash
pnpm admin:init
```

> **说明**：将提示您输入管理员密码（需满足 ≥12 位等安全规范）。邮箱缺省读取 `.env.local` 中的 `ADMIN_EMAIL`。

### 6. 启动开发服务器

```bash
pnpm dev
```

打开浏览器访问：

- **公开画廊前台**：<http://localhost:3000>
- **管理后台面板**：<http://localhost:3000/admin>

---

## ⚙️ 配置说明

在 `.env.local` 中配置以下环境变量：

| 变量名                   |  必填   | 默认值 / 示例                                   | 说明                                        |
| :----------------------- | :-----: | :---------------------------------------------- | :------------------------------------------ |
| `DATABASE_URL`           | **是**  | `postgresql://user:pass@host/db`                | PostgreSQL / Neon 数据库连接串              |
| `BETTER_AUTH_SECRET`     | **是**  | `openssl rand -base64 32`                       | Better Auth 签名密钥（长度需 ≥ 32 位）      |
| `BETTER_AUTH_URL`        | **是**  | `http://localhost:3000`                         | 网站访问根域名（生产环境填完整 HTTPS 地址） |
| `ADMIN_EMAIL`            |   否    | `admin@example.com`                             | 管理员默认邮箱（CLI 初始化时使用）          |
| `R2_ENDPOINT`            | CLI必选 | `https://<account-id>.r2.cloudflarestorage.com` | Cloudflare S3 兼容 API 端点                 |
| `R2_ACCESS_KEY_ID`       | CLI必选 | `your_r2_access_key_id`                         | R2 API Token Access Key                     |
| `R2_SECRET_ACCESS_KEY`   | CLI必选 | `your_r2_secret_access_key`                     | R2 API Token Secret Access Key              |
| `R2_PUBLIC_BUCKET`       | CLI必选 | `photo-public`                                  | 用于存放 AVIF 变体的公开 Bucket 名称        |
| `R2_PRIVATE_BUCKET`      | CLI必选 | `photo-private`                                 | 用于存放原图归档的私有 Bucket 名称          |
| `R2_PUBLIC_BASE_URL`     | **是**  | `https://photos-cdn.example.com`                | 公开 Bucket 绑定的自定义域名或 CDN 根 URL   |
| `PHOTO_LOCATION_ENABLED` |   否    | `true`                                          | 是否启用 GPS 逆地理编码反解城市/区县        |
| `SITE_REVALIDATE_URL`    |   否    | `https://photos.example.com/api/revalidate`     | CLI 导入后自动触发在线站点缓存刷新的接口    |
| `REVALIDATE_SECRET`      |   否    | `your_random_secret`                            | 重新验证接口调用的 Bearer 鉴权密钥          |

---

## 📖 使用指南

### 方式一：CLI 命令行工作流（推荐本地大批量导入）

CLI 具备断点续传、并发控制、本地预检等优势，适合将电脑上的摄影原片直接整理入库。

#### 1. 照片预检（Inspect）

在不写入数据库和存储的情况下，预先读取照片的尺寸与 EXIF 参数：

```bash
pnpm photo inspect ./photos/sample.jpg
```

#### 2. 批量导入照片（Import）

```bash
# 试运行（Dry Run）：仅在本地解析、压缩，不写入 R2 和数据库
pnpm photo import ./photos --album japan-2026 --dry-run

# 正式导入整个目录（相册不存在时会自动创建并发布）
pnpm photo import ./photos --album japan-2026 --album-title "日本冬季之旅"

# 导入单张照片并指定自定义标题
pnpm photo import ./photos/sunset.jpg --album japan-2026 --title "雪场日落"

# 设置导入并发数（1-4，默认 2）
pnpm photo import ./photos --album japan-2026 --concurrency 3

# 强制重跑：为已存在且为 READY 的照片重新生成 AVIF 变体及 BlurHash
pnpm photo import ./photos --album japan-2026 --force
```

#### 3. 编辑单张照片信息（Update）

```bash
pnpm photo update <photo-id> --title "雪场日落" --description "摄于将军山滑雪场山顶。"
```

#### 4. 相册叙事与封面焦点调整（Album Update）

```bash
# 设置相册故事背景、封面照片及封面裁切焦点（0–100 整数）
pnpm photo album update japan-2026 \
  --context "雨季的东京，从清晨到最后一班电车。" \
  --cover <photo-id> \
  --focus-x 42 \
  --focus-y 30
```

#### 5. 插入相册章节（Album Chapter）

```bash
# 在指定照片前面插入章节标题与说明文字
pnpm photo album chapter japan-2026 \
  --photo <photo-id> \
  --title "第一章：晨光" \
  --text "从第一班电车开始记录城市的苏醒。"
```

---

### 方式二：Web 管理后台工作流

1. 登录后台 `<your-domain>/admin`；
2. **相册管理**：创建新相册，设定相册名称、Slug、故事背景，或通过交互式画廊选择封面并直观拖动设定聚焦点；
3. **网页直传**：进入「上传照片」页面，拖拽本地多张高分辨率图片，系统将并发直传至 Cloudflare R2，并在上传完成后自动流式触发后台转码与入库；
4. **在线编排**：在相册详情中，拖拽调整照片排序、批量发布/下架、编辑照片标题与章节导言。

---

## 🌐 Cloudflare R2 与 CORS 设置

为了支持 Web 管理后台在浏览器中通过预签名 PUT URL 直传至 Cloudflare R2，必须在 **私有 Bucket (`R2_PRIVATE_BUCKET`)** 的设置中添加 CORS 跨域策略。

进入 **Cloudflare 控制台 -> R2 -> 选择私有桶 -> Settings -> CORS Policy**，添加如下配置（参考 [`docs/r2-upload-cors.example.json`](docs/r2-upload-cors.example.json)）：

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-production-domain.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "Cache-Control"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

> **注意**：公开 Bucket (`R2_PUBLIC_BUCKET`) 需在 Cloudflare 中配置 **Custom Domain**（如 `https://photos-cdn.example.com`），并将该域名填入 `R2_PUBLIC_BASE_URL`。

---

## 📋 常用命令

| 命令                | 说明                                                               |
| :------------------ | :----------------------------------------------------------------- |
| `pnpm dev`          | 启动本地 Next.js 开发服务器 (`http://localhost:3000`)              |
| `pnpm build`        | 编译构建生产版本                                                   |
| `pnpm start`        | 启动生产环境 Node.js 服务                                          |
| `pnpm check`        | **本地质量关卡**（依次执行 `typecheck` + `lint` + `format:check`） |
| `pnpm typecheck`    | 执行 TypeScript 类型静态检查 (`tsc --noEmit`)                      |
| `pnpm lint`         | 执行 ESLint 代码规范检查                                           |
| `pnpm format`       | 使用 Prettier 自动格式化项目代码                                   |
| `pnpm db:generate`  | 基于 `src/db/schema.ts` 生成 SQL 迁移脚本                          |
| `pnpm db:migrate`   | 应用未执行的数据库迁移文件                                         |
| `pnpm db:push`      | 将当前 Schema 定义直接同步至数据库                                 |
| `pnpm admin:init`   | 命令行交互式初始化首位管理员账号                                   |
| `pnpm photo --help` | 查看本地照片导入与相册管理 CLI 帮助信息                            |

---

## 🚢 部署说明

### Vercel 部署

1. 将代码推送到 GitHub / GitLab 仓库；
2. 在 Vercel 中导入项目，Framework Preset 选择 **Next.js**；
3. 在 Project Settings -> **Environment Variables** 中配置所需的所有生产环境变量；
4. 部署完成后，在管理后台或 CLI 中即可配合 `SITE_REVALIDATE_URL` 实现发布后的自动缓存更新。

### 自托管 / Docker / Node.js 部署

项目基于标准的 Node.js 运行环境：

```bash
# 1. 构建
pnpm build

# 2. 运行
NODE_ENV=production pnpm start
```

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源授权。
