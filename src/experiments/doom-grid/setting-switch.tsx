"use client";

import { Switch, SwitchThumb } from "@ui-sdk/react/switch";

interface SettingSwitchProps {
  label: string;
  isChecked: boolean;
  onCheckedChange: (isChecked: boolean) => void;
}

export function SettingSwitch({
  label,
  isChecked,
  onCheckedChange,
}: SettingSwitchProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch
        checked={isChecked}
        onCheckedChange={(checked) => onCheckedChange(checked)}
        className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-checked:border-primary data-checked:bg-primary"
      >
        <SwitchThumb className="ml-0.5 size-3.5 rounded-full bg-foreground transition-transform data-checked:translate-x-4 data-checked:bg-primary-foreground" />
      </Switch>
      {label}
    </label>
  );
}
