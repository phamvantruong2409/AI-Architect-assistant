interface ElectronAPI {
  selectFolder: () => Promise<string | null>;
  openExternal: (url: string) => Promise<boolean>;
  onAuthCode: (callback: (code: string) => void) => () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
