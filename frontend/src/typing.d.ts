// src/typing.d.ts
export interface ElectronAPI { saveState(key: string, data: any): Promise<boolean>; }
declare global { interface Window { electronAPI?: ElectronAPI; } }
