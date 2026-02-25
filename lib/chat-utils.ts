import { UIMessage } from 'ai';

/**
 * 判断两条消息之间是否需要显示时间分隔符（类似微信）
 * @param prevTime 前一条消息的时间戳
 * @param currTime 当前消息的时间戳
 * @param thresholdMinutes 时间阈值（分钟），默认5分钟
 * @returns 是否需要显示时间分隔符
 */
export function shouldShowTimestamp(prevTime: string | undefined, currTime: string, thresholdMinutes: number = 5): boolean {
  if (!prevTime) return true; // 第一条消息总是显示时间

  const prev = new Date(prevTime);
  const curr = new Date(currTime);
  const diffMinutes = (curr.getTime() - prev.getTime()) / (1000 * 60);

  return diffMinutes > thresholdMinutes;
}

/**
 * 格式化时间显示（类似微信）
 * @param timestamp 时间戳字符串
 * @returns 格式化的时间字符串
 */
export function formatChatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));

  // 今天
  if (diffDays === 0) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? '下午' : '上午';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${period} ${displayHours}:${String(minutes).padStart(2, '0')}`;
  }

  // 昨天
  if (diffDays === 1) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? '下午' : '上午';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `昨天 ${period} ${displayHours}:${String(minutes).padStart(2, '0')}`;
  }

  // 本周内
  if (diffDays < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? '下午' : '上午';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${weekday} ${period} ${displayHours}:${String(minutes).padStart(2, '0')}`;
  }

  // 更早
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? '下午' : '上午';
  const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);

  return `${month}月${day}日 ${period} ${displayHours}:${String(minutes).padStart(2, '0')}`;
}

/**
 * 为消息列表添加时间戳分隔符
 * @param messages 原始消息列表
 * @returns 添加了时间戳分隔符的消息列表
 */
export function addTimestampSeparators(messages: UIMessage[]): Array<UIMessage | { type: 'timestamp'; timestamp: string; displayTime: string }> {
  const result: Array<UIMessage | { type: 'timestamp'; timestamp: string; displayTime: string }> = [];
  let lastTimestamp: string | undefined;

  messages.forEach((message) => {
    const messageTime = message.createdAt || new Date().toISOString();

    // 检查是否需要添加时间分隔符
    if (shouldShowTimestamp(lastTimestamp, messageTime)) {
      result.push({
        type: 'timestamp',
        timestamp: messageTime,
        displayTime: formatChatTime(messageTime)
      });
    }

    result.push(message);
    lastTimestamp = messageTime;
  });

  return result;
}

/**
 * 滚动到顶部时加载更多历史消息的钩子
 */
export function useInfiniteScroll(loadMore: () => void, threshold: number = 100) {
  let isLoading = false;

  const handleScroll = (element: HTMLElement) => {
    if (isLoading) return;

    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    // 当滚动到顶部附近时触发加载
    if (scrollTop < threshold && scrollHeight > clientHeight) {
      isLoading = true;
      loadMore();

      // 重置加载状态
      setTimeout(() => {
        isLoading = false;
      }, 1000);
    }
  };

  return handleScroll;
}