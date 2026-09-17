"use client";

export default function MapError({ reset }: { reset: () => void }) {
  return (
    <main className="page-frame page-frame-main">
      <div className="empty-state">
        <h1>足迹暂时无法载入。</h1>
        <p>请稍后重试。</p>
        <button className="map-clear" onClick={reset}>
          重试
        </button>
      </div>
    </main>
  );
}
