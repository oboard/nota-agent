"use client";

import { Accordion, AccordionItem } from "@heroui/accordion";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";

interface AccordionTabsProps {
  items: {
    key: string;
    title: string;
    subtitle?: string;
    count?: number;
    content: React.ReactNode;
  }[];
  defaultExpandedKey?: string;
  onExpandChange?: (expandedKeys: string[]) => void;
}

export function AccordionTabs({
  items,
  defaultExpandedKey,
  onExpandChange
}: AccordionTabsProps) {
  return (
    <Accordion
      variant="splitted"
      defaultExpandedKeys={defaultExpandedKey ? [defaultExpandedKey] : undefined}
      onSelectionChange={(keys) => {
        const expandedKeys = Array.from(keys).map(String);
        onExpandChange?.(expandedKeys);
      }}
    >
      {items.map((item) => (
        <AccordionItem
          key={item.key}
          aria-label={item.title}
          title={
            <div className="flex justify-between items-center w-full pr-2">
              <div>
                <span className="font-semibold">{item.title}</span>
                {item.subtitle && (
                  <p className="text-xs text-default-500 mt-0.5">{item.subtitle}</p>
                )}
              </div>
              {item.count !== undefined && (
                <Chip size="sm" variant="solid" color="primary">
                  {item.count}
                </Chip>
              )}
            </div>
          }
          className="group-[.is-splitted]:px-3 group-[.is-splitted]:bg-default-50 group-[.is-splitted]:shadow-none"
        >
          <div className="flex flex-col gap-4">
            {item.content}
          </div>
        </AccordionItem>
      ))}
    </Accordion>
  );
}