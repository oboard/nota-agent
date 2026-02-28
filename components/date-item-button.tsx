"use client";

import { Button } from "@heroui/button";
import { memo } from "react";

interface DateItemButtonProps {
  date: string;
  label: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}

function DateItemButtonImpl({ date, label, subtitle, selected, onPress }: DateItemButtonProps) {
  return (
    <Button
      key={date}
      variant={selected ? "solid" : "light"}
      className={`w-full justify-start px-3 py-3 h-auto min-h-0 transition-all ${selected ? 'bg-primary-50 border-primary-200' : 'hover:bg-default-100'} rounded-lg`}
      onPress={onPress}
      size="sm"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${selected ? 'bg-primary' : 'bg-default-300'}`} />
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-default-500">{subtitle}</span>
          </div>
        </div>
        {selected && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
      </div>
    </Button>
  );
}

export const DateItemButton = memo(DateItemButtonImpl, (prev, next) =>
  prev.date === next.date &&
  prev.label === next.label &&
  prev.subtitle === next.subtitle &&
  prev.selected === next.selected &&
  prev.onPress === next.onPress
);

export type { DateItemButtonProps };