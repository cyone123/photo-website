import { SiteHeader } from "@/components/site-header";

export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main className="page-frame loading-page" aria-busy="true">
        <div className="loading-line loading-line-wide" />
        <div className="loading-grid">
          <div className="loading-card" />
          <div className="loading-card" />
          <div className="loading-card" />
        </div>
      </main>
    </>
  );
}
