import Link from "next/link";

export function EmptyState({
  label = "Archive / 00",
  title = "这里还没有照片。",
  description = "相册会从本地导入第一组照片开始慢慢生长。",
  href,
  action,
}: {
  label?: string;
  title?: string;
  description?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="empty-state">
      <span className="label">{label}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {href && action ? (
        <Link className="text-link" href={href}>
          {action} <span className="text-link-arrow">→</span>
        </Link>
      ) : null}
    </div>
  );
}
