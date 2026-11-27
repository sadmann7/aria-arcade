export interface AnnouncerOptions {
  say: (text: string) => void;
  gap?: number;
  limit?: number;
}

interface Pending {
  key: string;
  text: string;
}

export interface Announcer {
  push: (text: string, key?: string) => void;
  stop: () => void;
}

export function createAnnouncer({
  say,
  gap = 900,
  limit = 3,
}: AnnouncerOptions): Announcer {
  let queue: Pending[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = -Infinity;

  function flush() {
    timer = null;
    const head = queue.shift();
    if (!head) return;
    say(head.text);
    last = Date.now();
    if (queue.length > 0) timer = setTimeout(flush, gap);
  }

  function push(text: string, key = text) {
    const same = queue.find((pending) => pending.key === key);
    if (same) same.text = text;
    else queue.push({ key, text });
    if (queue.length > limit) queue = queue.slice(-limit);
    if (timer) return;
    const wait = last + gap - Date.now();
    if (wait <= 0) flush();
    else timer = setTimeout(flush, wait);
  }

  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
    queue = [];
  }

  return { push, stop };
}
