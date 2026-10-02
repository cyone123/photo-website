# 照片足迹（Mapbox 第一阶段）

公开入口 `/map`。全球球形地图、底图行政边界和中文优先地名、已拍摄国家高亮、国家与地点筛选。地图外的照片列表、分页、灯箱和详情返回沿用现有实现。

## Mapbox 配置

在 `.env.local` 添加 `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.…`，然后重启开发服务器；生产环境必须在构建前配置并重新构建。这是浏览器公共 Token，不应使用 `sk.` 秘密 Token。建议单独创建网站 Token，并在 Mapbox 控制台限制允许来源（正式域名及本地预览地址）。

- SDK：`mapbox-gl`，只在地图客户端组件动态加载。
- 底图：`mapbox://styles/mapbox/dark-v11`；投影 `globe`。
- 国家多边形：`mapbox://mapbox.country-boundaries-v1` 的 `country_boundaries` 图层，按 `iso_3166_1` 关联已有地点国家代码。
- 国家多边形使用 `worldview=all/US`，与当前底图默认展示口径保持一致，排除重复争议区面。更换底图展示口径时，必须同时调整多边形过滤。
- 底图提供行政边界线与地名，按其覆盖和缩放层级展示；本阶段不包含省州市区域填色和点击筛选，不依赖付费的完整 Mapbox Boundaries。
- 保留 SDK 内置 Mapbox / OpenStreetMap 署名。地点名称仍由 Nominatim 提供。
- 不上传照片或 EXIF 到 Mapbox。公开地点代表坐标作为浏览器本地 GeoJSON 图层；浏览器向 Mapbox 请求底图、国家瓦片和字体。
- 每个页面挂载只初始化一次地图，筛选更新图层，离开页面销毁实例。Mapbox 按地图加载计费，实际用量和价格以账号控制台为准。

没有 Token 时显示“地图暂未启用”；无 WebGL、鉴权失败或初始加载超时则提供提示和重试。国家/地点列表及照片仍可浏览。完整地图验收需要有效 Token、国家瓦片权限和网络可达性。

## 地点初始化

1. `pnpm db:migrate`：应用 `photo_places`、`photos.place_id` 和查询索引的既有迁移。Mapbox 升级不新增数据库迁移。
2. `pnpm photo:places --dry-run`：统计 READY 照片及待补全 GPS 照片。
3. `pnpm photo:places`：按 UUID 分批补全地点，可中断后重跑。需要 DATABASE_URL 和 PHOTO_LOCATION_ENABLED=true；不重新上传原图或生成变体。

新上传与 CLI 导入使用共享管线补全地点。无 GPS 照片不会按文字猜测位置；第三方位置解析失败不改变 READY 状态。后台 after 完成后刷新 gallery，CLI 等待位置补全后刷新站点缓存。

Nominatim reverse zoom=10 的城市级对象作为地点，部分国家可能返回县或区域。地图标记使用地点代表坐标而非照片精确 GPS。位置服务限速 1.1 秒/次，历史补全应单进程运行。

## 筛选与查询

- `/map`：全部公开足迹；`/map?country=MY`：国家；`/map?country=MY&place=<uuid>`：地点。
- 旧 `/map?place=<uuid>` 自动识别所属国家，保持兼容。
- 国家代码大小写兼容；格式为两位字母。无照片的国家显示空状态；地点与国家不匹配不回退到全部照片。
- `/api/map/photos?country=MY&place=<uuid>&offset=0&limit=24`；country、place 均可省略，组合使用取交集。limit 上限 48，非法参数 400，无公开地点或归属不匹配 404。
- 数据层统一 READY + EXISTS 已发布相册，只按照片计数，避免多个相册关联重复。国家统计由相同公开地点统计汇总。缓存标签 gallery，TTL 3600；API HTTP no-store。
- 排序 takenAt DESC NULLS LAST、createdAt DESC、id ASC；offset 分页不是快照，客户端按照片 ID 去重。
- `view` 最多恢复 20 页，每页 24 张；详情返回、浏览器前进后退保留国家、地点和分页，滚动位置按国家/地点分别保存。
- 多地点聚合标记显示照片总数，点击展开；地点光点优先于底下国家响应点击。
- 镜头尊重减少动画偏好；国家列表、地点列表支持键盘操作，也是地图不可用时的筛选入口。

## 验收

本地质量关卡：`pnpm check`、`pnpm build`。

交互检查：初始球形地图、拖动/缩放、国家高亮、国家悬停名称与数量、点击国家及地点、聚合展开、层级返回、空国家、搜索、灯箱详情返回、前进后退、手机宽度、Token 缺失/失效回退。选中筛选时应保留原地图 canvas 实例。

数据检查：国家代码大小写、组合筛选归属不匹配、分页偏移和上限、公开照片计数去重、草稿与失败照片不可见。跨日期变更线旅行的镜头范围需覆盖两侧地点。
