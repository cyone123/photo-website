const architecture = [
  ["Web", "Next.js App Router", "网站页面和只读展示接口"],
  ["Data", "PostgreSQL + Drizzle", "照片、相册和 EXIF 元数据"],
  ["Storage", "Cloudflare R2", "私有原图和公开图片变体"],
  ["Import", "Local TypeScript CLI", "本地导入、去重和图片处理"],
] as const;

export default function Home() {
  return (
    <main className="site-shell">
      <section className="hero">
        <p className="eyebrow">PHOTO WEBSITE · V1</p>
        <h1>把值得记住的照片，安静地放在网上。</h1>
        <p className="hero-copy">
          这是个人相册项目的初始页面。照片由本地 CLI
          导入，原图和展示图片分开存储，网站只负责快速、清晰地展示精选照片。
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="#architecture">
            查看架构
          </a>
          <a className="button button-secondary" href="/api/health">
            健康检查
          </a>
        </div>
      </section>

      <section className="architecture" id="architecture">
        <div className="section-heading">
          <p className="eyebrow">FOUNDATION</p>
          <h2>项目基础已经就位</h2>
        </div>
        <div className="architecture-grid">
          {architecture.map(([label, name, description]) => (
            <article className="architecture-card" key={label}>
              <p className="card-label">{label}</p>
              <h3>{name}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
