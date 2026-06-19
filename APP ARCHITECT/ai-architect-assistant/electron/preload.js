const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  // Mở URL bằng trình duyệt mặc định của hệ thống (dùng cho đăng nhập Google).
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  // Nhận lại "code" khi trình duyệt quay về app qua deep link aiarchitect://
  onAuthCode: (callback) => {
    const handler = (_e, code) => callback(code);
    ipcRenderer.on("auth-code", handler);
    return () => ipcRenderer.removeListener("auth-code", handler);
  },
});
