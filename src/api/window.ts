import { invoke } from "@tauri-apps/api/core";

export async function hideWindow() {
  await invoke("hide_window");
}

export async function showWindow() {
  // 通过 Tauri 窗口 API 显示
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  await win.show();
  await win.setFocus();
}
