// Settings layout primitives.
//
// SettingSection: a titled group with an icon + title header and a divider,
// wrapping one or more SettingRows.
// SettingRow: a horizontal card — label + description on the left, the
// control on the right. The visual unit of the redesigned Settings screen.

import { ReactNode } from "react";
import { Icon, IconName } from "./Icon";
import "./Setting.css";

interface SettingSectionProps {
  title: string;
  icon?: IconName;
  /** Optional small grey caption shown beside the title. */
  caption?: string;
  children: ReactNode;
}

export function SettingSection({ title, icon, caption, children }: SettingSectionProps) {
  return (
    <section className="settingSection">
      <div className="settingSectionHeader">
        {icon && <Icon name={icon} size={18} className="settingSectionIcon" />}
        <h2 className="settingSectionTitle">{title}</h2>
        {caption && <span className="settingSectionCaption">{caption}</span>}
      </div>
      <div className="settingSectionBody">{children}</div>
    </section>
  );
}

interface SettingRowProps {
  title: string;
  desc?: string;
  /** Show a "Coming soon" tag and disable the row. */
  comingSoon?: boolean;
  children?: ReactNode;
}

export function SettingRow({ title, desc, comingSoon, children }: SettingRowProps) {
  return (
    <div className={`settingRow ${comingSoon ? "comingSoon" : ""}`}>
      <div className="settingRowText">
        <div className="settingRowTitleLine">
          <span className="settingRowTitle">{title}</span>
          {comingSoon && <span className="comingSoonTag">Coming soon</span>}
        </div>
        {desc && <p className="settingRowDesc">{desc}</p>}
      </div>
      {children && <div className="settingRowControl">{children}</div>}
    </div>
  );
}
