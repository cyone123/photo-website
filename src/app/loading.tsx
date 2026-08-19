export default function Loading() {
  return (
    <main className="page-frame loading-page" aria-busy="true">
      <div className="loading-line loading-line-wide" />
      <div className="loading-grid">
        <div className="loading-card" />
        <div className="loading-card" />
        <div className="loading-card" />
      </div>
    </main>
  );
}
