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
import { cn } from "@/lib/utils";

function prefersRgbaFormat(value: string) {
  return /^(rgba|hsla|hsba)\(/i.test(value.trim());
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
  const normalizedValue = value.trim() || "#000000";

  return (
    <ColorPicker
      value={normalizedValue}
      onValueChange={onChange}
      defaultFormat={prefersRgbaFormat(normalizedValue) ? "rgb" : "hex"}
      className={cn("w-full", className)}
    >
      <div className="flex items-center gap-2">
        <ColorPickerTrigger asChild>
          <ColorPickerSwatch
            asChild
            className="size-8 shrink-0 cursor-pointer rounded-md border-border/50"
          >
            <button
              type="button"
              aria-label="Open color picker"
              className="rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </ColorPickerSwatch>
        </ColorPickerTrigger>
        <ColorPickerInput id={id} className="min-w-0 flex-1 font-mono" />
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
