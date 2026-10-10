import { contextBridge, ipcRenderer } from 'electron';
import { RingConfig, AppEntry } from '../shared/types';

contextBridge.exposeInMainWorld('ringAPI', {
  loadConfig: (): Promise<RingConfig> => ipcRenderer.invoke('config:load'),
  saveConfig: (cfg: RingConfig): Promise<boolean> => ipcRenderer.invoke('config:save', cfg),
  scan: (): Promise<{ apps: AppEntry[]; warnings: string[] }> => ipcRenderer.invoke('apps:scan'),
  launch: (entry: AppEntry): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('app:launch', entry),
  hideIcons: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('desktop:hideIcons', enabled),
  onToast: (cb: (msg: string) => void): void => {
    ipcRenderer.on('config:toast', (_e, msg: string) => cb(msg));
  },
});
