"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Two-thumb price range built from two native `input[type=range]`.
 *
 * Written by hand instead of pulling Radix Slider: native range inputs are
 * keyboard accessible and screen-reader friendly out of the box, and the dual
 * overlay keeps the thumbs from crossing. No extra dependency needed.
 */
export function DualRangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  label,
  className,
}: {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onValueChange: (next: [number, number]) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  const [low, high] = value;

  return (
    <div className={cn("relative h-8 w-full", className)}>
      {/* Track */}
      <div aria-hidden="true" className="bg-muted absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" />
      <div
        aria-hidden="true"
        className="bg-brand absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
        style={{
          left: `${((low - min) / (max - min)) * 100}%`,
          right: `${100 - ((high - min) / (max - min)) * 100}%`,
        }}
      />

      <input
        type="range"
        id={`${id}-low`}
        aria-label={`${label} — minimum`}
        min={min}
        max={max}
        step={step}
        value={low}
        onChange={(event) => {
          const next = Math.min(Number(event.target.value), high);
          onValueChange([next, high]);
        }}
        className="pointer-events-none absolute inset-x-0 top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-brand"
      />
      <input
        type="range"
        id={`${id}-high`}
        aria-label={`${label} — maximum`}
        min={min}
        max={max}
        step={step}
        value={high}
        onChange={(event) => {
          const next = Math.max(Number(event.target.value), low);
          onValueChange([low, next]);
        }}
        className="pointer-events-none absolute inset-x-0 top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-brand"
      />
    </div>
  );
}