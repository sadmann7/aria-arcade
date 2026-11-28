"use client";

import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import * as React from "react";

interface SettingSwitchProps {
  label: string;
  isChecked: boolean;
  isDisabled?: boolean;
  description?: string;
  onCheckedChange: (isChecked: boolean) => void;
}

export function SettingSwitch({
  label,
  isChecked,
  isDisabled,
  description,
  onCheckedChange,
}: SettingSwitchProps) {
  const descriptionId = React.useId();
  return (
    <div className="flex flex-col gap-1 border-b border-divider py-2.5">
      <label className="flex items-center justify-between gap-4 text-[15px] leading-5">
        {label}
        <Switch
          checked={isChecked}
          disabled={isDisabled}
          aria-describedby={description ? descriptionId : undefined}
          onCheckedChange={(checked) => onCheckedChange(checked)}
          className="inline-flex h-5 w-10 shrink-0 items-center border-[1.5px] border-muted-foreground p-[1.5px] data-checked:border-foreground data-checked:bg-foreground data-disabled:opacity-50"
        >
          <SwitchThumb className="size-3.5 bg-muted-foreground transition-transform data-checked:translate-x-5 data-checked:bg-background motion-reduce:transition-none" />
        </Switch>
      </label>
      {description ? (
        <span id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </span>
      ) : null}
    </div>
  );
}
