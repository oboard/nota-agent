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
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import {
  GithubIcon,
  SearchIcon,
  Logo,
} from "@/components/icons";
import { getAvailableDates } from "@/app/actions";
import { Calendar, Settings } from "lucide-react";
import { useDatePanelStore } from "@/lib/stores/date-panel-store";

interface DateItem {
  date: string;
  fileName: string;
  chatCount: number;
}

export const Navbar = () => {
  const pathname = usePathname();
  const isChatPage = pathname?.startsWith('/chat');

  // 在聊天页面不渲染navbar
  if (isChatPage) {
    return null;
  }

  // navbar其他逻辑将在其他页面正常显示

  const [availableDates, setAvailableDates] = useState<DateItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLoadingDates, setIsLoadingDates] = useState(false);
  const { isDatePanelExpanded, toggleDatePanel } = useDatePanelStore();

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
  const searchInput = (
    <Input
      aria-label="Search"
      classNames={{
        inputWrapper: "bg-default-100",
        input: "text-sm",
      }}
      endContent={
        <Kbd className="hidden lg:inline-block" keys={["command"]}>
          K
        </Kbd>
      }
      labelPlacement="outside"
      placeholder="Search..."
      startContent={
        <SearchIcon className="text-base text-default-400 pointer-events-none flex-shrink-0" />
      }
      type="search"
    />
  );


  return (
    <HeroUINavbar maxWidth="xl" position="sticky" className="border-b border-default-200">
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <Logo />
            <p className="font-bold text-inherit">Nota Agent</p>
          </NextLink>
        </NavbarBrand>

        {/* 聊天页面控制 - 只在聊天页面显示 */}
        {isChatPage && (
          <div className="flex items-center gap-2">
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
            <div className="lg:hidden flex-1 max-w-[200px]">
              <Select
                size="sm"
                placeholder="选择日期"
                selectedKeys={selectedDate ? [selectedDate] : []}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  if (selected) {
                    setSelectedDate(selected);
                    // 触发日期选择事件
                    window.dispatchEvent(new CustomEvent('dateSelected', { detail: { date: selected } }));
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

        <ul className="hidden lg:flex gap-4 justify-start ml-2">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <NextLink
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium",
                )}
                color="foreground"
                href={item.href}
              >
                {item.label}
              </NextLink>
            </NavbarItem>
          ))}
        </ul>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2">
          {/* <Link isExternal aria-label="Twitter" href={siteConfig.links.twitter}>
            <TwitterIcon className="text-default-500" />
          </Link>
          <Link isExternal aria-label="Discord" href={siteConfig.links.discord}>
            <DiscordIcon className="text-default-500" />
          </Link> */}
          <NextLink href="/settings" aria-label="Settings">
            <Settings className="text-default-500 hover:text-primary transition-colors" />
          </NextLink>
          <Link isExternal aria-label="Github" href={siteConfig.links.github}>
            <GithubIcon className="text-default-500" />
          </Link>
          <ThemeSwitch />
        </NavbarItem>
        <NavbarItem className="hidden lg:flex">{searchInput}</NavbarItem>

      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <NextLink href="/settings" aria-label="Settings">
          <Settings className="text-default-500 hover:text-primary transition-colors" />
        </NextLink>
        <Link isExternal aria-label="Github" href={siteConfig.links.github}>
          <GithubIcon className="text-default-500" />
        </Link>
        <ThemeSwitch />
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        {searchInput}
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig.navMenuItems.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <Link
                color={
                  index === 2
                    ? "primary"
                    : index === siteConfig.navMenuItems.length - 1
                      ? "danger"
                      : "foreground"
                }
                href="#"
                size="lg"
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
