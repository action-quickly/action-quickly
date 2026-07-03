import { onMounted, onUnmounted } from "vue";

export function useShortcut() {
  const handlers = new Map<string, () => void>();

  function onKeyDown(e: KeyboardEvent) {
    // Esc: 隐藏窗口或返回搜索
    if (e.key === "Escape") {
      const handler = handlers.get("escape");
      if (handler) handler();
    }
  }

  function register(key: string, handler: () => void) {
    handlers.set(key, handler);
  }

  onMounted(() => {
    window.addEventListener("keydown", onKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", onKeyDown);
  });

  return { register };
}
