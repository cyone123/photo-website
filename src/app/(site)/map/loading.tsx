export default function MapLoading() {
  return (
    <main className="page-frame page-frame-main">
      <header className="page-head">
        <span className="label">Places / 光的坐标</span>
        <h1>足迹</h1>
      </header>
      <div className="map-globe map-globe-message" role="status">
        正在载入拍摄足迹…
      </div>
    </main>
  );
}
