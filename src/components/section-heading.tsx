import Link from "next/link";

export function SectionHeading({
  eyebrow,
  title,
  href,
  action = "查看全部",
}: {
  eyebrow: string;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {href ? (
        <Link className="text-link" href={href}>
          {action} <span>↗</span>
        </Link>
      ) : null}
    </div>
  );
}
