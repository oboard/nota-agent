"use client";

import {
  Navbar as HeroUINavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@heroui/navbar";
import { Button } from "@heroui/button";
import { Kbd } from "@heroui/kbd";
import { Select, SelectItem } from "@heroui/select";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { getAvailableDates } from "@/app/actions";
import { ThemeSwitch } from "@/components/theme-switch";
import { GithubIcon, Logo, SearchIcon } from "@/components/icons";
import { RecentContextPopup } from "@/components/recent-context-popup";
import { SearchPopup } from "@/components/search-popup";
import { buildInternalNoteUrl } from "@/lib/note-window";
import { useDatePanelStore } from "@/lib/stores/date-panel-store";
import { useTodoPanelStore } from "@/lib/stores/todo-panel-store";
import { getAlwaysOnTop, isElectronRuntime, openNotesBoardWindow, toggleAlwaysOnTop } from "@/lib/electron-window";
import {
  Brain,
  Calendar,
  ChevronLeft,
  Github,
  ListTodo,
  PanelLeft,
  PanelRight,
  Pin,
  PinOff,
  StickyNote,
} from "lucide-react";

const dragRegionStyle = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDragRegionStyle = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

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

const iconButtonClass =
  "h-7 min-h-7 w-7 min-w-7 border border-default-200/70 bg-transparent text-default-500 transition-colors hover:bg-default-100 hover:text-foreground";

const panelButtonClass =
  "h-7 min-h-7 w-7 min-w-7 border border-default-200/70 bg-transparent text-default-500 transition-colors hover:bg-default-100 hover:text-foreground";

export const Navbar = ({
  onDateSelect,
  showChatControls = false,
  memories = [],
}: NavbarProps) => {
  const pathname = usePathname();
  const isChatPage = pathname?.startsWith("/chat");

  const [availableDates, setAvailableDates] = useState<DateItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [isLoadingDates, setIsLoadingDates] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [isRecentContextOpen, setIsRecentContextOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { isDatePanelExpanded, toggleDatePanel, setExpanded: setDatePanelExpanded } = useDatePanelStore();
  const { isTodoPanelExpanded, toggleTodoPanel, setExpanded: setTodoPanelExpanded } = useTodoPanelStore();

  const titlebarInsetClass = isElectron ? "pl-20 pr-3 lg:pl-24 lg:pr-3" : "";

  const selectedDateLabel = useMemo(() => {
    const current = availableDates.find((item) => item.date === selectedDate);
    if (current) return formatDateDisplay(current.date);
    return "今天";
  }, [availableDates, selectedDate]);

  useEffect(() => {
    const fetchDates = async () => {
      setIsLoadingDates(true);
      try {
        setAvailableDates(await getAvailableDates());
      } catch (error) {
        console.error("获取可用日期失败:", error);
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
    const mq = window.matchMedia("(max-width: 1024px)");
    const update = () => {
      setIsMobile(mq.matches);
      setTodoPanelExpanded(!mq.matches);
    };

    update();
    if ((mq as any).addEventListener) {
      mq.addEventListener("change", update);
    } else {
      (mq as any).addListener(update);
    }

    return () => {
      if ((mq as any).removeEventListener) {
        mq.removeEventListener("change", update);
      } else {
        (mq as any).removeListener(update);
      }
    };
  }, [setTodoPanelExpanded]);

  const openSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  const handleToggleAlwaysOnTop = useCallback(async () => {
    const next = await toggleAlwaysOnTop();
    setIsAlwaysOnTop(next);
  }, []);

  const handleOpenNotesBoard = useCallback(() => {
    if (typeof window === "undefined") return;
    if (isElectronRuntime()) {
      openNotesBoardWindow();
      return;
    }

    window.open(buildInternalNoteUrl("/notes"), "_blank", "popup=yes,width=980,height=760");
  }, []);

  const handleDateSelect = useCallback(
    (date: string) => {
      setSelectedDate(date);

      if (isMobile) {
        setDatePanelExpanded(false);
      }

      onDateSelect?.(date);
    },
    [isMobile, onDateSelect, setDatePanelExpanded],
  );

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearchOpen(true);
    setIsSearching(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, types: ["memory", "note", "chat"] }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("搜索失败:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  if (isChatPage && !showChatControls) {
    return null;
  }

  return (
    <>
      <HeroUINavbar
        maxWidth="xl"
        position="sticky"
        className={`h-11 border-b border-default-200/70 bg-background/85 backdrop-blur ${titlebarInsetClass}`}
        style={isElectron ? dragRegionStyle : undefined}
      >
        <NavbarContent justify="start" className="min-w-0 gap-2">
          <NavbarBrand className="hidden min-w-0 items-center gap-2 lg:flex">
            <Logo />
            <div className="truncate text-[13px] font-semibold tracking-[0.14em] text-foreground uppercase">
              Nota Agent
            </div>
          </NavbarBrand>

          {isChatPage && showChatControls && (
            <>
              <NavbarItem className="hidden lg:flex" style={isElectron ? noDragRegionStyle : undefined}>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={toggleDatePanel}
                  className="h-7 min-h-7 rounded-full border border-default-200/70 bg-default-50 px-2.5 text-[11px] text-default-600"
                  startContent={isDatePanelExpanded ? <ChevronLeft className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                >
                  {selectedDateLabel}
                </Button>
              </NavbarItem>

              <NavbarItem className="lg:hidden min-w-[8rem] flex-1" style={isElectron ? noDragRegionStyle : undefined}>
                <Select
                  size="sm"
                  aria-label="选择聊天日期"
                  placeholder="选择日期"
                  selectedKeys={selectedDate ? [selectedDate] : []}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) handleDateSelect(selected);
                  }}
                  classNames={{
                    trigger:
                      "h-8 min-h-8 border border-default-200/70 bg-default-50 text-default-700 shadow-none",
                    value: "text-[11px]",
                  }}
                  startContent={<Calendar className="h-4 w-4" />}
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
              </NavbarItem>
            </>
          )}
        </NavbarContent>

        <NavbarContent justify="end" className="gap-1.5" style={isElectron ? noDragRegionStyle : undefined}>
          <NavbarItem className="hidden lg:flex">
            <Button
              size="sm"
              variant="flat"
              onPress={openSearch}
              className="h-7 min-h-7 rounded-full border border-default-200/70 bg-default-50 px-2.5 text-[11px] text-default-500"
              startContent={<SearchIcon className="h-4 w-4 text-default-400" />}
            >
              搜索
            </Button>
          </NavbarItem>

          <NavbarItem className="lg:hidden">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              onPress={openSearch}
              className={iconButtonClass}
              title="搜索"
            >
              <SearchIcon className="h-4 w-4" />
            </Button>
          </NavbarItem>

          {isElectron && (
            <NavbarItem>
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={handleToggleAlwaysOnTop}
                className={iconButtonClass}
                title={isAlwaysOnTop ? "取消置顶" : "置顶窗口"}
              >
                {isAlwaysOnTop ? <PinOff className="h-4 w-4 text-primary" /> : <Pin className="h-4 w-4" />}
              </Button>
            </NavbarItem>
          )}

          {showChatControls && (
            <>
              <NavbarItem>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  onPress={handleOpenNotesBoard}
                  className={iconButtonClass}
                  title="便笺"
                >
                  <StickyNote className="h-4 w-4" />
                </Button>
              </NavbarItem>

              <NavbarItem>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  onPress={() => setIsRecentContextOpen(true)}
                  className={iconButtonClass}
                  title="Recent Context"
                >
                  <Brain className="h-4 w-4" />
                </Button>
              </NavbarItem>
              
              <NavbarItem>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  onPress={toggleTodoPanel}
                  className={`${panelButtonClass} ${isTodoPanelExpanded ? "bg-default-100 text-foreground" : ""}`}
                  title={isTodoPanelExpanded ? "收起待办面板" : "展开待办面板"}
                >
                  {isTodoPanelExpanded ? <PanelRight className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
                </Button>
              </NavbarItem>
            </>
          )}

          {!showChatControls && (
            <NavbarItem className="hidden sm:flex">
              <a
                aria-label="Github"
                href="https://github.com/oboard/nota-agent"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-default-200/70 text-default-500 transition-colors hover:bg-default-100 hover:text-foreground"
              >
                <GithubIcon className="h-4 w-4" />
              </a>
            </NavbarItem>
          )}

          <NavbarItem>
            <ThemeSwitch />
          </NavbarItem>
        </NavbarContent>
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
        onQueryChange={handleSearch}
        results={searchResults}
        isLoading={isSearching}
      />
    </>
  );
};

function formatDateDisplay(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "今天";
  if (date.toDateString() === yesterday.toDateString()) return "昨天";

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (date > weekAgo) {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return weekdays[date.getDay()];
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
