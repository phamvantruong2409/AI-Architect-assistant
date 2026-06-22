# Hướng dẫn cài đặt AI Architect Assistant

App cần **kết nối internet** để hoạt động.

## 1. Cài đặt

1. Tải file `AI Architect Assistant Setup x.x.x.exe`.
2. Nếu Windows hiện **SmartScreen** (màn hình xanh "Windows protected your PC"):
   - Bấm **More info** (Thêm thông tin)
   - Bấm **Run anyway** (Vẫn chạy)
3. Làm theo trình cài đặt → app tạo shortcut ngoài Desktop.

> Cảnh báo SmartScreen chỉ xuất hiện vì app chưa mua chứng chỉ ký số — đây là
> app an toàn, mọi khoá bí mật nằm trên server, không đóng gói vào file cài.

## 2. Nếu double-click shortcut KHÔNG mở app

Đây là do Windows "khoá" file tải từ internet. Bỏ khoá 1 lần là xong:

1. Chuột phải vào file `.exe` (hoặc shortcut) → **Properties** (Thuộc tính)
2. Ở thẻ **General**, dưới cùng có dòng *Security* → tick **Unblock** (Bỏ chặn)
3. Bấm **OK**, rồi mở lại app bình thường.

Không cần bấm "Run as administrator" nữa.

## 3. Nếu app báo "Không kết nối được"

- Kiểm tra mạng (mở trình duyệt vào https://ai-architect-assistant.vercel.app
  thử — nếu trang lên là mạng OK).
- Bấm nút **Thử lại** trong app.
- Nếu vẫn lỗi, đóng hẳn app rồi mở lại.
