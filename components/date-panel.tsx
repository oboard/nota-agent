"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/button";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { getAvailableDates } from '@/app/actions';
import { Calendar, ChevronRight, ChevronLeft, Clock, History } from 'lucide-react';
import { useDatePanelStore } from '@/lib/stores/date-panel-store';

interface DatePanelProps {
  chatId: string;
  onDateSelect: (date: string) => void;
  selectedDate?: string;
}

interface DateItem {
  date: string;
  fileName: string;
  chatCount: number;
}

export function DatePanel({ chatId, onDateSelect, selectedDate }: DatePanelProps) {
  const [availableDates, setAvailableDates] = useState<DateItem[]>([]);
  const { isDatePanelExpanded: isExpanded, toggleDatePanel } = useDatePanelStore();
  const [isLoading, setIsLoading] = useState(true);

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
        <div className="h-full bg-default-50 border-r border-default-200 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-sm text-default-500">加载中...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 flex-shrink-0 h-full animate-in slide-in-from-left duration-300">
      <div className="h-full bg-default-50 border-r border-default-200 flex flex-col">
        {/* Header - 移除收起按钮，使用统一的悬浮按钮 */}
        <div className="flex items-center p-4 border-b border-default-200 bg-default-100">
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">历史记录</h3>
          </div>
        </div>

        {!isCollapsed && (
          <ScrollShadow className="flex-1">
            <div className="p-3 space-y-1">

              {availableDates.length > 0 && (
                <>
                  {/* 今天和昨天 */}
                  <div className="space-y-1">
                    {availableDates.filter(item => {
                      const date = new Date(item.date);
                      const today = new Date();
                      const yesterday = new Date(today);
                      yesterday.setDate(yesterday.getDate() - 1);
                      return date.toDateString() === today.toDateString() || date.toDateString() === yesterday.toDateString();
                    }).map(item => (
                      <Button
                        key={item.date}
                        variant={selectedDate === item.date ? "solid" : "light"}
                        color={selectedDate === item.date ? "primary" : "default"}
                        className={`w-full justify-start px-3 py-3 h-auto min-h-0 transition-all ${selectedDate === item.date ? 'bg-primary-50 border-primary-200' : 'hover:bg-default-100'} rounded-lg`}
                        onPress={() => onDateSelect(item.date)}
                        size="sm"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${selectedDate === item.date ? 'bg-primary' : 'bg-default-300'}`} />
                            <div className="flex flex-col items-start">
                              <span className="text-sm font-medium">{formatDateDisplay(item.date)}</span>
                              <span className="text-xs text-default-500">{item.chatCount} 条消息</span>
                            </div>
                          </div>
                          {selectedDate === item.date && (
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>

                  {/* 本周 */}
                  <div className="pt-3">
                    <div className="text-xs font-semibold text-default-500 mb-2 px-3 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      本周
                    </div>
                    <div className="space-y-1">
                      {availableDates.filter(item => {
                        const date = new Date(item.date);
                        const today = new Date();
                        const weekAgo = new Date(today);
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return date < today && date > weekAgo && date.toDateString() !== today.toDateString() && date.toDateString() !== new Date(today.getTime() - 86400000).toDateString();
                      }).map(item => (
                        <Button
                          key={item.date}
                          variant={selectedDate === item.date ? "solid" : "light"}
                          color={selectedDate === item.date ? "primary" : "default"}
                          className={`w-full justify-start px-3 py-3 h-auto min-h-0 transition-all ${selectedDate === item.date ? 'bg-primary-50 border-primary-200' : 'hover:bg-default-100'} rounded-lg`}
                          onPress={() => onDateSelect(item.date)}
                          size="sm"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${selectedDate === item.date ? 'bg-primary' : 'bg-default-300'}`} />
                              <div className="flex flex-col items-start">
                                <span className="text-sm font-medium">{formatDateDisplay(item.date)}</span>
                                <span className="text-xs text-default-500">{item.chatCount} 条消息</span>
                              </div>
                            </div>
                            {selectedDate === item.date && (
                              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            )}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* 更早 */}
                  <div className="pt-3">
                    <div className="text-xs font-semibold text-default-500 mb-2 px-3 flex items-center gap-2">
                      <History className="w-3 h-3" />
                      更早
                    </div>
                    <div className="space-y-1">
                      {availableDates.filter(item => {
                        const date = new Date(item.date);
                        const today = new Date();
                        const weekAgo = new Date(today);
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return date <= weekAgo;
                      }).map(item => (
                        <Button
                          key={item.date}
                          variant={selectedDate === item.date ? "solid" : "light"}
                          color={selectedDate === item.date ? "primary" : "default"}
                          className={`w-full justify-start px-3 py-3 h-auto min-h-0 transition-all ${selectedDate === item.date ? 'bg-primary-50 border-primary-200' : 'hover:bg-default-100'} rounded-lg`}
                          onPress={() => onDateSelect(item.date)}
                          size="sm"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${selectedDate === item.date ? 'bg-primary' : 'bg-default-300'}`} />
                              <div className="flex flex-col items-start">
                                <span className="text-sm font-medium">{formatDateDisplay(item.date)}</span>
                                <span className="text-xs text-default-500">{getRelativeDateDescription(item.date)} • {item.chatCount} 条消息</span>
                              </div>
                            </div>
                            {selectedDate === item.date && (
                              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            )}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                </>)}

              {availableDates.length === 0 && !isLoading && (
                <div className="text-center text-default-500 text-sm py-8 px-4">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
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