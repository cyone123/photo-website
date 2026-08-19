import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "关于 · 光的档案",
  description: "关于这个个人照片档案项目。",
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-frame about-page">
        <section className="about-hero">
          <span className="eyebrow">ABOUT / THE ARCHIVE</span>
          <h1>
            照片不是答案，<em>是留下来的问题。</em>
          </h1>
          <p>
            这是一个持续更新的个人影像档案。它不追求把所有照片都放上来，只保留那些在回看时仍然愿意停留片刻的画面。
          </p>
        </section>

        <section className="about-columns">
          <div>
            <span className="eyebrow">01 / METHOD</span>
            <h2>慢一点整理，久一点观看。</h2>
          </div>
          <div className="about-copy">
            <p>
              照片从本地导入，原图和公开展示版本分开保存。相册只展示精选内容，拍摄时间、相机和镜头信息会跟随照片一起被记录。
            </p>
            <p>
              这里的设计保持克制：留白、文字和图片各自拥有空间，让每一组照片都可以有自己的节奏。
            </p>
          </div>
        </section>

        <section className="about-note">
          <span className="eyebrow">02 / NOTE</span>
          <p>“最值得保存的，往往不是发生了什么，而是当时看见它的方式。”</p>
        </section>
      </main>
    </>
  );
}
