"use client";

import { useState, useEffect } from "react";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { getAvailableDates } from '@/app/actions';
import { Clock, History } from 'lucide-react';
import { useDatePanelStore } from '@/lib/stores/date-panel-store';
import { DateItemButton } from '@/components/date-item-button';
import { isElectronRuntime } from "@/lib/electron-window";

interface DatePanelProps {
  onDateSelect: (date: string) => void;
  selectedDate?: string;
}

interface DateItem {
  date: string;
  fileName: string;
  chatCount: number;
}

export function DatePanel({ onDateSelect, selectedDate }: DatePanelProps) {
  const [availableDates, setAvailableDates] = useState<DateItem[]>([]);
  const { isDatePanelExpanded: isExpanded } = useDatePanelStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isElectron, setIsElectron] = useState(false);

  // 使用store中的展开状态
  const isCollapsed = !isExpanded;

  // 获取可用日期
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const dates = await getAvailableDates();
        setAvailableDates(dates);
      } catch (error) {
        console.error('获取可用日期失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDates();
  }, []);

  useEffect(() => {
    setIsElectron(isElectronRuntime());
  }, []);

  // 格式化日期显示
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 检查是否是今天
    if (date.toDateString() === today.toDateString()) {
      return '今天';
    }

    // 检查是否是昨天
    if (date.toDateString() === yesterday.toDateString()) {
      return '昨天';
    }

    // 检查是否是一周内
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (date > weekAgo) {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return weekdays[date.getDay()];
    }

    // 更早的日期
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  };

  // 获取相对日期的描述
  const getRelativeDateDescription = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    return `${Math.floor(diffDays / 30)}个月前`;
  };

  if (isLoading) {
    return (
      <div className={`${isCollapsed ? 'w-12' : 'w-80'} transition-all duration-300 flex-shrink-0 h-full`}>
        <div className="h-full border-r border-default-200/70 bg-content1/30 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-xs text-default-500">加载中...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 h-full animate-in slide-in-from-left duration-300">
      <div className="h-full border-r border-default-200/70 bg-content1/25 flex flex-col">
        <div
          className={`flex h-11 items-center border-b border-default-200/60 bg-content1/35 ${isElectron ? "pl-20 pr-3 lg:pl-24 lg:pr-3" : "px-5"}`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-default-500" />
            <h3 className="text-[12px] font-medium tracking-[0.14em] text-default-600 uppercase">History</h3>
          </div>
        </div>

        {!isCollapsed && (
          <ScrollShadow className="flex-1">
            <div className="p-2 space-y-1">

              {availableDates.length > 0 && (
                <>
                  {/* 今天和昨天 */}
                  <div className="space-y-1">
                    {availableDates
                      .filter(item => {
                        const date = new Date(item.date);
                        const today = new Date();
                        const yesterday = new Date(today);
                        yesterday.setDate(yesterday.getDate() - 1);
                        return date.toDateString() === today.toDateString() || date.toDateString() === yesterday.toDateString();
                      })
                      .map(item => (
                        <DateItemButton
                          key={item.date}
                          date={item.date}
                          label={formatDateDisplay(item.date)}
                          subtitle={`${item.chatCount} 条消息`}
                          selected={selectedDate === item.date}
                          onPress={() => onDateSelect(item.date)}
                        />
                      ))}
                  </div>

                  {/* 本周 */}
                  <div className="pt-2">
                    <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-default-400">
                      <Clock className="w-3 h-3" />
                      本周
                    </div>
                    <div className="space-y-1">
                      {availableDates
                        .filter(item => {
                          const date = new Date(item.date);
                          const today = new Date();
                          const yesterday = new Date(today);
                          yesterday.setDate(yesterday.getDate() - 1);
                          const weekAgo = new Date(today);
                          weekAgo.setDate(weekAgo.getDate() - 7);

                          // 本周内，但排除今天和昨天（已经在上面显示）
                          return date >= weekAgo && date <= yesterday &&
                            date.toDateString() !== today.toDateString() &&
                            date.toDateString() !== yesterday.toDateString();
                        })
                        .map(item => (
                          <DateItemButton
                            key={item.date}
                            date={item.date}
                            label={formatDateDisplay(item.date)}
                            subtitle={`${item.chatCount} 条消息`}
                            selected={selectedDate === item.date}
                            onPress={() => onDateSelect(item.date)}
                          />
                        ))}
                    </div>
                  </div>

                  {/* 更早 */}
                  <div className="pt-2">
                    <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-default-400">
                      <History className="w-3 h-3" />
                      更早
                    </div>
                    <div className="space-y-1">
                      {availableDates
                        .filter(item => {
                          const date = new Date(item.date);
                          const today = new Date();
                          const weekAgo = new Date(today);
                          weekAgo.setDate(weekAgo.getDate() - 7);
                          // 一周之前的日期
                          return date < weekAgo;
                        })
                        .map(item => (
                          <DateItemButton
                            key={item.date}
                            date={item.date}
                            label={formatDateDisplay(item.date)}
                            subtitle={`${getRelativeDateDescription(item.date)} • ${item.chatCount} 条消息`}
                            selected={selectedDate === item.date}
                            onPress={() => onDateSelect(item.date)}
                          />
                        ))}
                    </div>
                  </div>
                </>)}

              {availableDates.length === 0 && !isLoading && (
                <div className="text-center text-default-500 text-sm py-8 px-4">
                  <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>暂无聊天记录</p>
                  <p className="text-xs mt-1">开始新的对话吧</p>
                </div>
              )}
            </div>
          </ScrollShadow>
        )}

      </div>
    </div>
  );
}
