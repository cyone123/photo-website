import Link from "next/link";

export function Breadcrumbs({ current, parent }: { current: string; parent?: string }) {
  return (
    <nav className="breadcrumbs" aria-label="面包屑导航">
      <Link href="/">首页</Link>
      <span>/</span>
      {parent ? (
        <>
          <Link href="/albums">相册</Link>
          <span>/</span>
        </>
      ) : null}
      <span className="breadcrumbs-current">{current}</span>
    </nav>
  );
}
