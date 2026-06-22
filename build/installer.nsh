; build/installer.nsh — tuỳ biến trình cài NSIS (electron-builder tự nạp qua nsis.include).
;
; ============================================================================
;  NGUYÊN NHÂN GỐC (xác nhận bằng thực nghiệm 2026-06-21) của lỗi
;  "Failed to uninstall old application files. Please try running the installer again.: 2"
; ----------------------------------------------------------------------------
;  App chạy server Next.js đóng gói trong $INSTDIR\resources\standalone. Lúc chạy,
;  Next.js GHI CACHE ẢNH TỐI ƯU vào ...\.next\cache\images\<hash 43 ký tự>\<tên file rất dài>.
;  Đường dẫn cài + tên file này VƯỢT 260 ký tự (MAX_PATH của Windows).
;
;  Khi cập nhật, trình cài chạy trình GỠ-CÀI bản cũ; nó xoá thư mục cài bằng "atomic
;  move" (Rename từng file qua temp) dùng Win32 API CŨ → KHÔNG xử lý được path > 260
;  → atomicRMDir abort → uninstaller trả exit code 2 → đúng hộp thoại trên.
;  => TẤT ĐỊNH cho mọi khách đã dùng app đủ để Next cache ảnh. KHÔNG liên quan khoá
;     file / tiến trình đang chạy.
;
;  VÁ: TRƯỚC khi gỡ-cài bản cũ, XOÁ sạch thư mục .next\cache bằng robocopy /MIR — công
;  cụ này xử lý được path > 260 (RMDir của NSIS thì KHÔNG). Cache chỉ là dữ liệu tạm,
;  xoá đi Next tự tạo lại. Vì đoạn này nằm trong trình cài MỚI (chạy trên máy khách lúc
;  update) nên áp dụng NGAY cho mọi bản nguồn có auto-update (>= v0.3.0), không bị
;  "độ trễ một phiên bản".
; ============================================================================

!macro customInit
  ; $INSTDIR đã được initMultiUser đặt (chạy trước customInit) = thư mục cài hiện có.

  ; 1) Ép tắt app + server (cùng tên ảnh exe) để chắc chắn không khoá file lúc gỡ-cài.
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /T /IM "AI Architect Assistant.exe"'
  Pop $0

  ; 2) XOÁ .next\cache (thủ phạm long-path) bằng robocopy /MIR từ một thư mục rỗng.
  ;    robocopy chịu được đường dẫn > 260 ký tự; RMDir /r của NSIS thì không.
  InitPluginsDir
  CreateDirectory "$PLUGINSDIR\emptymirror"
  nsExec::Exec '"$SYSDIR\robocopy.exe" "$PLUGINSDIR\emptymirror" "$INSTDIR\resources\standalone\.next\cache" /MIR /R:0 /W:0 /NJH /NJS /NFL /NDL'
  Pop $0
  ; Sau khi robocopy đã dọn rỗng, thư mục cache không còn path dài → RMDir gỡ nốt vỏ.
  RMDir /r "$INSTDIR\resources\standalone\.next\cache"

  ; 3) Chờ một nhịp cho Windows nhả handle trước khi NSIS gỡ-cài bản cũ.
  Sleep 1500
!macroend
