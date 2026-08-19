import Link from "next/link";

export function SectionHeading({
  label,
  title,
  href,
  action = "查看全部",
}: {
  label: string;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <span className="label">{label}</span>
        <h2>{title}</h2>
      </div>
      {href ? (
        <Link className="text-link" href={href}>
          {action} <span className="text-link-arrow">→</span>
        </Link>
      ) : null}
    </div>
  );
}
