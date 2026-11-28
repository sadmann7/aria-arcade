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
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-[15px] leading-5 whitespace-nowrap">
        <Switch
          checked={isChecked}
          disabled={isDisabled}
          aria-describedby={description ? descriptionId : undefined}
          onCheckedChange={(checked) => onCheckedChange(checked)}
          className="inline-flex h-5 w-10 shrink-0 items-center border-[1.5px] border-muted-foreground p-[1.5px] data-checked:border-foreground data-checked:bg-foreground data-disabled:opacity-50"
        >
          <SwitchThumb className="size-3.5 bg-muted-foreground transition-transform data-checked:translate-x-5 data-checked:bg-background motion-reduce:transition-none" />
        </Switch>
        {label}
      </label>
      {description ? (
        <span id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </span>
      ) : null}
    </div>
  );
}
