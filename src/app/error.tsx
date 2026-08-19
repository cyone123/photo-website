"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Gallery page render failed.", error);
  }, [error]);

  return (
    <main className="page-frame page-frame-main error-page">
      <span className="label">Service unavailable</span>
      <h1>照片暂时无法加载。</h1>
      <p>这通常是短暂的数据库或网络故障，并不表示相册为空。请稍后重试。</p>
      <button className="button-outline" type="button" onClick={() => retry()}>
        重新加载
      </button>
    </main>
  );
}
