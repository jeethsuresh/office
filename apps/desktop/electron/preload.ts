import { contextBridge } from "electron";
contextBridge.exposeInMainWorld("office", {
  platform: process.platform,
  desktop: true,
});
