"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PrefOption<T extends string> = {
  value: T;
  label: string;
  /** A second, smaller line shown only in the open list. */
  detail?: string;
  /** A small picture shown before the label, in the list and on the button. */
  swatch?: ReactNode;
};

/**
 * One Preferences setting as a labelled drop-down: the label on the left, the
 * current choice on a button to its right, and the choices in a pop-up list.
 *
 * `<T extends string>` makes this a generic component, much like a C++
 * template: T is the setting's own string union (for example
 * "button" | "tap"), so `onChange` hands back that type, not a plain string.
 *
 * Base UI's Select handles the keyboard (arrows, Enter, typing a letter to
 * jump), focus, and screen-reader roles, so this only adds layout and styling.
 */
export function PrefSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  inset = false,
  disabled = false,
}: {
  label: string;
  value: T;
  options: readonly PrefOption<T>[];
  onChange: (value: T) => void;
  /** Shown as a row inside a group (indented, plain label), not as a section. */
  inset?: boolean;
  /** Grayed out and unclickable, keeping its value. */
  disabled?: boolean;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <Select.Root
      value={value}
      disabled={disabled}
      // The Select can report null (nothing chosen); every setting here always
      // has a value, so null is ignored.
      onValueChange={(next) => {
        if (next !== null) onChange(next as T);
      }}
      items={options.map((option) => ({ value: option.value, label: option.label }))}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          inset ? "py-1.5 pl-4" : "mt-3",
          disabled && "opacity-50",
        )}
      >
        <Select.Label
          className={
            inset ? "text-sm" : "text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase"
          }
        >
          {label}
        </Select.Label>
        <Select.Trigger className="flex h-10 min-w-[11rem] cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="flex min-w-0 items-center gap-2">
            {current?.swatch}
            <Select.Value className="truncate" />
          </span>
          <Select.Icon className="text-muted-foreground">
            <ChevronsUpDown className="size-4" />
          </Select.Icon>
        </Select.Trigger>
      </div>
      <Select.Portal>
        {/* z-40 puts the list above the Preferences dialog, which is z-30. */}
        <Select.Positioner className="z-40 outline-none" sideOffset={4} alignItemWithTrigger={false}>
          <Select.Popup className="max-h-[var(--available-height)] min-w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
            <Select.List>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none select-none data-[highlighted]:bg-muted"
                >
                  {option.swatch}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Select.ItemText>{option.label}</Select.ItemText>
                    {option.detail ? (
                      <span className="max-w-[16rem] text-xs text-muted-foreground">{option.detail}</span>
                    ) : null}
                  </span>
                  <Select.ItemIndicator>
                    <Check className="size-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
