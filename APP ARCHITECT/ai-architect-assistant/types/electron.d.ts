interface LocalUpscaleArgs {
  dataUrl: string;
  scale: number;
  tile: number;
  model: string;
}

interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  selectFolder: () => Promise<string | null>;
  openExternal: (url: string) => Promise<boolean>;
  onAuthCode: (callback: (code: string) => void) => () => void;
  upscaleLocalAvailable: () => Promise<boolean>;
  upscaleLocal: (opts: LocalUpscaleArgs) => Promise<string>;
  onUpscaleProgress: (callback: (percent: number) => void) => () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
