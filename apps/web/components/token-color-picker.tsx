"use client";

import {
  ColorPicker,
  ColorPickerAlphaSlider,
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerEyeDropper,
  ColorPickerFormatSelect,
  ColorPickerHueSlider,
  ColorPickerInput,
  ColorPickerSwatch,
  ColorPickerTrigger,
} from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function prefersRgbaFormat(value: string) {
  return /^(rgba|hsla|hsba)\(/i.test(value.trim());
}

function isCompleteColorValue(value: string) {
  const color = value.trim();

  return (
    /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(color) ||
    /^(?:rgba?|hsla?|hsba?)\(.+\)$/i.test(color)
  );
}

export function TokenColorPicker({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const normalizedValue = value.trim();

  // An absent (or incomplete) mode value is not black. Keep it visually
  // empty until the user explicitly enters or chooses a valid colour.
  if (!isCompleteColorValue(normalizedValue)) {
    return (
      <div className={cn("flex h-9 items-center gap-2", className)}>
        <button
          type="button"
          aria-label="Choose a color"
          onClick={() => onChange("#000000")}
          className="size-9 shrink-0 rounded-md border border-dashed border-border bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Input
          id={id}
          aria-label="Hex color value"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#000000"
          className="h-9 min-w-0 flex-1 font-mono"
        />
      </div>
    );
  }

  return (
    <ColorPicker
      value={normalizedValue}
      onValueChange={onChange}
      defaultFormat={prefersRgbaFormat(normalizedValue) ? "rgb" : "hex"}
      className={cn("w-full", className)}
    >
      <div className="flex h-9 items-center gap-2">
        <ColorPickerTrigger asChild>
          <ColorPickerSwatch
            asChild
            className="size-9 shrink-0 cursor-pointer rounded-md border-border/50"
          >
            <button
              type="button"
              aria-label="Open color picker"
              className="rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </ColorPickerSwatch>
        </ColorPickerTrigger>
        <ColorPickerInput id={id} className="h-9 min-w-0 flex-1 font-mono" />
      </div>
      <ColorPickerContent align="start" side="bottom">
        <ColorPickerArea />
        <div className="flex items-center gap-2">
          <ColorPickerEyeDropper
            variant="outline"
            size="icon"
            className="shrink-0"
          />
          <div className="grid flex-1 gap-2">
            <ColorPickerHueSlider />
            <ColorPickerAlphaSlider />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ColorPickerFormatSelect className="w-28 shrink-0" />
          <ColorPickerInput className="min-w-0 flex-1 font-mono" />
        </div>
      </ColorPickerContent>
    </ColorPicker>
  );
}
