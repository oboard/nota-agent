"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { getAvailableDates } from '@/app/actions';

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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
      <div className={`${isCollapsed ? 'w-12' : 'w-64'} transition-all duration-300`}>
        <Card className="h-full">
          <CardBody className="p-4">
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-default-500">加载中...</div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${isCollapsed ? 'w-12' : 'w-64'} transition-all duration-300 flex-shrink-0`}>
      <Card className="h-full">
        <CardHeader className="flex justify-between items-center p-4 border-b border-divider">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <h3 className="text-sm font-medium">日期选择</h3>
            </div>
          )}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => setIsCollapsed(!isCollapsed)}
            className="min-w-0"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </CardHeader>

        {!isCollapsed && (
          <CardBody className="p-0">
            <ScrollShadow className="h-[calc(100%-60px)]">
              <div className="p-4">
              </>
                )}

              {availableDates.length > 0 && (
                <>
                  {/* 今天和昨天 */}
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
                      className="w-full justify-start mb-2"
                      onPress={() => onDateSelect(item.date)}
                      size="sm"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{formatDateDisplay(item.date)}</span>
                        <span className="text-xs text-default-500">{item.chatCount} 个聊天</span>
                      </div>
                    </Button>
                  ))}

                  {/* 本周 */}
                  <div className="mt-4">
                    <div className="text-xs text-default-500 mb-2">本周</div>
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
                        className="w-full justify-start mb-2"
                        onPress={() => onDateSelect(item.date)}
                        size="sm"
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{formatDateDisplay(item.date)}</span>
                          <span className="text-xs text-default-500">{item.chatCount} 个聊天</span>
                        </div>
                      </Button>
                    ))}
                  </div>

                  {/* 更早 */}
                  <div className="mt-4">
                    <div className="text-xs text-default-500 mb-2">更早</div>
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
                        className="w-full justify-start mb-2"
                        onPress={() => onDateSelect(item.date)}
                        size="sm"
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{formatDateDisplay(item.date)}</span>
                          <span className="text-xs text-default-400">{getRelativeDateDescription(item.date)}</span>
                        </div>
                      </Button>
                    ))}
                  </div>

                  {availableDates.length === 0 && (
                    <div className="text-center text-default-500 text-sm py-8">
                      暂无聊天记录
                    </div>
                  )}
                </div>
            </ScrollShadow>
          </CardBody>
        )}

        {isCollapsed && (
          <CardBody className="p-4">
            <div className="flex flex-col items-center gap-2">
              <Calendar className="w-5 h-5 text-default-400" />
              <span className="text-xs text-default-500 vertical-text">
                日期
              </span>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}