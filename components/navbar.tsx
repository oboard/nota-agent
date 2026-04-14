"use client"
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/navbar";
import { Button } from "@heroui/button";
import { Kbd } from "@heroui/kbd";
import { Link } from "@heroui/link";
import { Select, SelectItem } from "@heroui/select";
import { Input } from "@heroui/input";
import { link as linkStyles } from "@heroui/theme";
import NextLink from "next/link";
import clsx from "clsx";
import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

import { getAlwaysOnTop, isElectronRuntime, toggleAlwaysOnTop, openNotesBoardWindow } from "@/lib/electron-window";
import { ThemeSwitch } from "@/components/theme-switch";
import {
  GithubIcon,
  SearchIcon,
  Logo,
} from "@/components/icons";
import { getAvailableDates, getTodos } from "@/app/actions";
import { Calendar, Pin, PinOff, Brain, ListTodo, PanelLeft, PanelRight, ChevronLeft, StickyNote } from "lucide-react";
import { useDatePanelStore } from "@/lib/stores/date-panel-store";
import { useTodoPanelStore } from "@/lib/stores/todo-panel-store";
import { RecentContextPopup } from "@/components/recent-context-popup";
import { SearchPopup } from "@/components/search-popup";
import { buildInternalNoteUrl } from "@/lib/note-window";

const dragRegionStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

interface DateItem {
  date: string;
  fileName: string;
  chatCount: number;
}

interface NavbarProps {
  onDateSelect?: (date: string) => void;
  onRefreshTodos?: () => void;
  showChatControls?: boolean;
  memories?: any[];
}

export const Navbar = ({
  onDateSelect,
  onRefreshTodos,
  showChatControls = false,
  memories = []
}: NavbarProps) => {
  const pathname = usePathname();
  const isChatPage = pathname?.startsWith('/chat');

  const [availableDates, setAvailableDates] = useState<DateItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLoadingDates, setIsLoadingDates] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [isRecentContextOpen, setIsRecentContextOpen] = useState(false);
  const [todos, setTodos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { isDatePanelExpanded, toggleDatePanel, setExpanded: setDatePanelExpanded } = useDatePanelStore();
  const { isTodoPanelExpanded, toggleTodoPanel, setExpanded: setTodoPanelExpanded } = useTodoPanelStore();
  const [isMobile, setIsMobile] = useState(false);
  const titlebarInsetClass = isElectron ? "pl-20 pr-3 lg:pl-24 lg:pr-3" : "";

  // 获取可用日期
  useEffect(() => {
    const fetchDates = async () => {
      setIsLoadingDates(true);
      try {
        const dates = await getAvailableDates();
        setAvailableDates(dates);
      } catch (error) {
        console.error('获取可用日期失败:', error);
      } finally {
        setIsLoadingDates(false);
      }
    };

    fetchDates();
  }, []);

  useEffect(() => {
    const inElectron = isElectronRuntime();
    setIsElectron(inElectron);

    if (!inElectron) return;

    getAlwaysOnTop().then(setIsAlwaysOnTop).catch(() => setIsAlwaysOnTop(false));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const update = () => {
      setIsMobile(mq.matches);
      // 移动端默认收起，桌面端默认展开
      if (mq.matches) {
        setTodoPanelExpanded(false);
      } else {
        setTodoPanelExpanded(true);
      }
    }
    update();
    // 兼容较老的浏览器事件API
    if ((mq as any).addEventListener) {
      mq.addEventListener('change', update);
    } else {
      (mq as any).addListener(update);
    }
    return () => {
      if ((mq as any).removeEventListener) {
        mq.removeEventListener('change', update);
      } else {
        (mq as any).removeListener(update);
      }
    };
  }, [setTodoPanelExpanded]);

  const refreshData = useCallback(async () => {
    setTodos(await getTodos());
    if (onRefreshTodos) {
      onRefreshTodos();
    }
  }, [onRefreshTodos]);

  const handleToggleAlwaysOnTop = async () => {
    const next = await toggleAlwaysOnTop();
    setIsAlwaysOnTop(next);
  };

  const handleOpenNotesBoard = useCallback(() => {
    if (typeof window === "undefined") return;
    if (isElectronRuntime()) {
      openNotesBoardWindow();
      return;
    }

    window.open(buildInternalNoteUrl("/notes"), "_blank", "popup=yes,width=980,height=760");
  }, []);

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);

    if (isMobile) {
      setDatePanelExpanded(false);
    }

    if (onDateSelect) {
      onDateSelect(date);
    }
  };

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

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    setIsSearchOpen(true);
    setIsSearching(true);
    try {
      // 这里应该调用实际的搜索 API
      // 暂时模拟搜索结果
      const results = await searchMessages(query);
      setSearchResults(results);
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const searchMessages = async (query: string) => {
    // 模拟搜索功能 - 实际应该从 API 获取
    // 这里可以调用后端 API 来搜索全局聊天记录
    return [];
  };

  const searchInput = (
    <Input
      aria-label="Search"
      classNames={{
        inputWrapper: "bg-default-100",
        input: "text-sm",
      }}
      value={searchQuery}
      onValueChange={handleSearch}
      endContent={
        <Kbd className="hidden lg:inline-block" keys={["command"]}>
          K
        </Kbd>
      }
      labelPlacement="outside"
      placeholder="Search messages..."
      startContent={
        <SearchIcon className="text-base text-default-400 pointer-events-none flex-shrink-0" />
      }
      type="search"
      style={isElectron ? noDragRegionStyle : undefined}
      onFocus={() => setIsSearchOpen(true)}
    />
  );

  // 在聊天页面不渲染标准navbar
  if (isChatPage && !showChatControls) {
    return null;
  }

  return (
    <>
      <HeroUINavbar
        maxWidth="xl"
        position="sticky"
        className={`h-11 border-b border-default-200 ${titlebarInsetClass}`}
        style={isElectron ? dragRegionStyle : undefined}
      >
        <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
          <NavbarBrand as="li" className="gap-3 max-w-fit">

            <Logo />
            <p className="font-bold text-inherit">Nota Agent</p>

          </NavbarBrand>

          {/* 聊天页面控制 - 只在聊天页面显示 */}
          {isChatPage && showChatControls && (
            <div className="flex items-center gap-2" style={isElectron ? noDragRegionStyle : undefined}>
              {/* 桌面端日期面板展开/收起按钮 */}
              <div className="hidden lg:flex items-center gap-2">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={toggleDatePanel}
                  className="min-w-0"
                  title={isDatePanelExpanded ? "收起历史面板" : "展开历史面板"}
                >
                  <Calendar className={`w-4 h-4 transition-transform ${isDatePanelExpanded ? 'rotate-0' : 'rotate-180'}`} />
                </Button>
              </div>

              {/* 移动端日期选择器 */}
              <div className="lg:hidden flex-1 max-w-[200px]" style={isElectron ? noDragRegionStyle : undefined}>
                <Select
                  size="sm"
                  placeholder="选择日期"
                  selectedKeys={selectedDate ? [selectedDate] : []}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) {
                      setSelectedDate(selected);
                      handleDateSelect(selected);
                    }
                  }}
                  classNames={{
                    trigger: "bg-default-100",
                  }}
                  startContent={<Calendar className="w-4 h-4" />}
                  isLoading={isLoadingDates}
                >
                  {availableDates.map((item) => (
                    <SelectItem key={item.date} textValue={formatDateDisplay(item.date)}>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{formatDateDisplay(item.date)}</span>
                        <span className="text-xs text-default-500">{item.chatCount} 条消息</span>
                      </div>
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </div>
          )}

        </NavbarContent>

        <NavbarContent
          className="hidden sm:flex basis-1/5 sm:basis-full"
          justify="end"
        >
          <NavbarItem className="hidden sm:flex gap-2" style={isElectron ? noDragRegionStyle : undefined}>
            {isElectron && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={handleToggleAlwaysOnTop}
                className="min-w-0"
                title={isAlwaysOnTop ? "取消置顶" : "置顶窗口"}
              >
                {isAlwaysOnTop ? <PinOff className="w-4 h-4 text-primary" /> : <Pin className="w-4 h-4 text-default-500" />}
              </Button>
            )}
            {showChatControls && (
              <>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={handleOpenNotesBoard}
                  className="min-w-0"
                  title="便笺"
                >
                  <StickyNote className="w-4 h-4" />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => setIsRecentContextOpen(true)}
                  className="min-w-0"
                  title="Recent Context"
                >
                  <Brain className="w-4 h-4 text-default-500" />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={toggleDatePanel}
                  className={`min-w-0 ${isDatePanelExpanded ? 'bg-default-100 text-foreground' : ''}`}
                  title={isDatePanelExpanded ? "收起历史面板" : "展开历史面板"}
                >
                  {isDatePanelExpanded ? <ChevronLeft className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={toggleTodoPanel}
                  className={`min-w-0 ${isTodoPanelExpanded ? 'bg-default-100 text-foreground' : ''}`}
                  title={isTodoPanelExpanded ? "收起待办面板" : "展开待办面板"}
                >
                  {isTodoPanelExpanded ? <PanelRight className="w-4 h-4" /> : <ListTodo className="w-4 h-4" />}
                </Button>
              </>
            )}

            <ThemeSwitch />
          </NavbarItem>
          <NavbarItem className="hidden lg:flex">{searchInput}</NavbarItem>
        </NavbarContent>

        <NavbarContent className="sm:hidden basis-1 pl-4" justify="end" style={isElectron ? noDragRegionStyle : undefined}>
          {isElectron && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleToggleAlwaysOnTop}
              className="min-w-0"
              title={isAlwaysOnTop ? "取消置顶" : "置顶窗口"}
            >
              {isAlwaysOnTop ? <PinOff className="w-4 h-4 text-primary" /> : <Pin className="w-4 h-4 text-default-500" />}
            </Button>
          )}
          {showChatControls && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => setIsRecentContextOpen(true)}
              className="min-w-0"
              title="Recent Context"
            >
              <Brain className="w-4 h-4 text-default-500" />
            </Button>
          )}
          <Link isExternal aria-label="Github" href={"https://github.com/oboard/nota-agent"}>
            <GithubIcon className="text-default-500" />
          </Link>
          <ThemeSwitch />
          <NavbarMenuToggle />
        </NavbarContent>

        <NavbarMenu style={isElectron ? noDragRegionStyle : undefined}>
          <div className="mx-4 mt-2">
            {searchInput}
          </div>
        </NavbarMenu>

      </HeroUINavbar>

      <RecentContextPopup
        isOpen={isRecentContextOpen}
        onClose={() => setIsRecentContextOpen(false)}
        memories={memories}
      />
      
      <SearchPopup
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        query={searchQuery}
        results={searchResults}
        isLoading={isSearching}
      />
    </>
  );
};