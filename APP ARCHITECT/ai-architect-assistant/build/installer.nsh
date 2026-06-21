; build/installer.nsh — tuỳ biến trình cài NSIS (electron-builder tự nạp file này).
;
; VÁ PHỔ QUÁT cho lỗi "Failed to uninstall old application files / cannot be closed":
; Trước khi gỡ-cài bản cũ, ép tắt MỌI tiến trình còn giữ file .exe — kể cả server
; Next.js chạy nền dưới dạng ELECTRON_RUN_AS_NODE (cùng tên ảnh
; "AI Architect Assistant.exe"). Nếu không giết, NSIS thấy file đang bị khoá →
; gỡ-cài thất bại → retry vô vọng → bản cài hỏng dở.
;
; Vì đoạn này nằm trong TRÌNH CÀI MỚI (chạy trên máy khách lúc update), nó áp dụng
; NGAY cho mọi bản nguồn — KHÔNG bị "độ trễ một phiên bản" như vá ở phía app runtime.
; Nhờ vậy bất kỳ khách nào có auto-update (>= v0.3.0) đều cài đè được lên bản mới nhất.

; CƠ CHẾ LỖI (xác nhận từ template electron-builder): trình gỡ-cài bản cũ xoá thư
; mục cài bằng kiểu "atomic move" — ĐỔI TÊN (MOVE) từng file sang temp. Chỉ cần 1
; file đang bị KHOÁ là cả bước thất bại → uninstaller trả exit code 2 →
; "Failed to uninstall old application files. Please try running the installer again.: 2".
; Vì vậy phải ép tắt MỌI tiến trình giữ file VÀ chờ OS nhả handle TRƯỚC khi gỡ-cài.

!macro customInit
  ; /F = ép buộc, /T = giết cả cây tiến trình con. Bỏ qua lỗi nếu không có tiến trình.
  ; Dùng đường dẫn tuyệt đối tới taskkill để chắc chắn chạy được trong trình cài im lặng.

  ; 1) App + server Next.js: server chạy bằng chính exe Electron qua
  ;    ELECTRON_RUN_AS_NODE → CÙNG tên ảnh "AI Architect Assistant.exe".
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /T /IM "AI Architect Assistant.exe"'
  Pop $0

  ; 2) Các exe phụ ĐÓNG GÓI KÈM có TÊN KHÁC — check mặc định của NSIS không giết,
  ;    nhưng nếu còn sống sẽ khoá file của chúng trong thư mục cài → gỡ-cài thất bại:
  ;    Real-ESRGAN (upscale) và windows-trash (module 'trash' xoá vào thùng rác).
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /T /IM "realesrgan-ncnn-vulkan.exe"'
  Pop $0
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /T /IM "windows-trash.exe"'
  Pop $0

  ; 3) Chờ Windows nhả handle: ảnh .exe + native module (sharp .node/.dll) đã nạp vào
  ;    RAM cần thời gian unmap sau khi process chết (có cả antivirus quét). 1.5s thường
  ;    KHÔNG đủ trên máy thật → nâng lên 4s. Trình cài còn retry gỡ-cài 5 lần nữa.
  Sleep 4000
!macroend
