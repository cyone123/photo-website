# 照片足迹（V1）

公开入口 `/map`，按城市级地点聚合已发布相册中的 READY 照片。重复相册关联只计数一次；无地点的照片不进入地图。

## 初始化

1. `pnpm db:migrate`：新增 `photo_places`、`photos.place_id` 和查询索引。
2. `pnpm photo:places --dry-run`：只统计 READY 照片及待补全 GPS 照片，不请求地理编码或更新照片。
3. `pnpm photo:places`：按 UUID 分批补全地点。已有关联的照片自动跳过，可中断后重跑；失败或没有结果的照片保持未关联。

需要 DATABASE_URL 和 PHOTO_LOCATION_ENABLED=true。现有 CLI 站点缓存刷新沿用 SITE_REVALIDATE_URL / REVALIDATE_SECRET 配置。补全不上传 R2，也不重新生成照片变体。没有 GPS 的旧照片不会根据城市文字猜测位置，后续可通过后台手动地点功能补齐。

新上传和 CLI 导入均通过共享管线补全地点。后台在 after 任务完成时刷新 gallery 标签，CLI 等待位置补全后再刷新站点缓存。第三方解析失败不改变照片 READY 状态。

## 地点与查询

- Nominatim reverse 的 zoom=10 返回城市级对象，使用 OSM 对象类型与 ID 作为来源键；显示名称和国家/省份独立存储。部分地区只能得到县或区域级对象，所以界面统一称“拍摄地点”。
- 复用现有 1.1 秒进程内限速器。历史批量补全应单进程运行，不要在多个实例同时补全；较大图库宜配置自建地理编码服务后再扩展。
- 光点采用来源对象代表坐标，不是照片精确 GPS；原始 EXIF 保留。
- 聚合、分页统一使用 READY + EXISTS 已发布相册条件，缓存标签 gallery、TTL 3600。
- `/api/map/photos?place=<uuid>&offset=0&limit=24`；place 可省略，limit 上限 48。无公开照片的地点返回 404，非法参数返回 400，失败返回 500。HTTP no-store，服务端数据查询缓存可由 gallery 标签失效。
- 分页按 takenAt DESC NULLS LAST、createdAt DESC、id ASC；导入/取消发布期间 offset 分页并非数据库快照，前端会按照片 ID 去重。

## 浏览

- `/map?place=<uuid>&view=2` 支持分享、刷新与返回；view 恢复最多 20 页，继续加载不受该限制。
- 地球动态加载，仅地图路由引入 Three.js。底图来自本站 public/map，地点解析只在导入/补全时发生。
- 地点列表支持键盘和搜索，也是 WebGL 不可用时的完整筛选入口。
- 页面隐藏或地球离开视口时暂停渲染；像素比上限 1.5；减少动态效果时取消镜头过渡和光环动画。
- 点击照片在当前地点的已加载照片中打开灯箱，加载更多后扩充范围。查看照片详情后提供“返回拍摄足迹”，恢复筛选、已加载页数和滚动位置。

## 验收

`pnpm check`、`pnpm build`。手工检查地点切换/连续点击、搜索无结果、分页、灯箱详情返回、前进后退、无 WebGL、窄屏和空图库。数据检查包括草稿不可见、重复关联计数一致、反向地理编码失败可重试。
