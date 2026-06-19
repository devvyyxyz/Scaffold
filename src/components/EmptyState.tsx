import { ReactNode } from "react";
import { Icon, IconName } from "./ui/Icon";
import "./EmptyState.css";

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  desc?: string;
  actions?: ReactNode;
}

export function EmptyState({
  icon = "sparkles",
  title,
  desc,
  actions,
}: EmptyStateProps) {
  return (
    <div className="emptyState">
      <div className="iconWrap">
        <Icon name={icon} size={28} />
      </div>
      <h2 className="title">{title}</h2>
      {desc && <p className="desc">{desc}</p>}
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
