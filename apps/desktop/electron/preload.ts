import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("office", {
  platform: process.platform,
  desktop: true,
  waitForFullscreen: () => ipcRenderer.invoke("office:fullscreen-ready"),
});
