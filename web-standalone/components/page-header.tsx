import { CircleHelp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  tabs,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  tabs?: Array<{ href: string; label: string; active?: boolean }>;
}) {
  return (
    <header className="page-header">
      <div className="page-header-context">
        <span>Local project</span>
      </div>
      <div className="page-header-title-row">
        <div className="page-header-title">
          <h1>{title}</h1>
          {description ? (
            <span className="page-help" title={description}>
              <CircleHelp aria-hidden="true" size={15} />
              <span className="sr-only">{description}</span>
            </span>
          ) : null}
        </div>
        {actions ? <div className="actions">{actions}</div> : null}
      </div>
      {tabs?.length ? (
        <nav aria-label={`${title} sections`} className="page-tabs">
          {tabs.map((tab) => (
            <Link
              aria-current={tab.active ? "page" : undefined}
              className={`page-tab${tab.active ? " active" : ""}`}
              href={tab.href}
              key={tab.href}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
