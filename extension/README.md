# Tiện ích Web-to-MCP Studio

Tiện ích riêng của project, không phải Playwright Extension trên Chrome Web Store. Toàn bộ source có trong thư mục này; không cần npm install hoặc build extension.

## Cài vào trình duyệt đang dùng

1. Chrome: mở `chrome://extensions`. Edge: mở `edge://extensions`.
2. Bật **Developer mode / Chế độ dành cho nhà phát triển**.
3. Bấm **Load unpacked / Tải tiện ích đã giải nén**.
4. Chọn thư mục `extension` của project (thư mục chứa `manifest.json`, không chọn thư mục gốc).
5. Ghim biểu tượng Web-to-MCP Studio lên thanh công cụ nếu muốn.

Cần Chrome/Edge dựa trên Chromium 118 trở lên. Trình duyệt do tổ chức quản lý có thể chặn Developer mode hoặc quyền debugger. Không cần bật remote debugging khi dùng tiện ích.

## Thu thập ngay trên tab đã đăng nhập

1. Mở tab website đang đăng nhập.
2. Bấm tiện ích → **Bắt đầu ghi tab này**. Trình duyệt hiển thị thông báo gỡ lỗi, đây là quyền dùng để đọc traffic của tab bạn chọn.
3. Đóng popup tiện ích, tải lại website hoặc thực hiện các thao tác muốn thu thập (tìm kiếm, phân trang…). Dữ liệu trước lúc bấm bắt đầu không được ghi lại.
4. Mở lại tiện ích → **Dừng và tải file dữ liệu**. Giữ popup mở đến khi chọn nơi lưu file `.web-mcp.json` xong.
5. Mở `run.bat` → **7. Nhập dữ liệu từ tiện ích**, nhập tên dự án mới và đường dẫn file.
6. Chọn **3. Phân tích** rồi **4. Tạo MCP**, dùng cùng tên dự án. Nếu API nằm ở domain khác, nhập địa chỉ API khi phân tích.

Extension không đóng tab, không đăng xuất và không mở phiên trình duyệt mới. Dữ liệu chỉ tải về máy, không gửi tới dịch vụ bên ngoài. File xuất chứa HAR, DOM, thông tin CAPTCHA, cookie cho URL website và localStorage của website; giữ riêng tư và không commit file. Không xuất cookie của các website khác đang mở.

## Giới hạn

- Ghi một tab tại một thời điểm; không thu thập tab mới tự bật lên, worker riêng hoặc WebSocket. Không mở DevTools khi ghi vì có thể làm mất kết nối debugger.
- Tối đa 500 yêu cầu hoàn tất, 2 MB mỗi response body và 15 MB traffic. Có thể thiếu redirect trung gian hoặc body đã bị trình duyệt xóa khỏi bộ đệm. Cảnh báo nằm trong file xuất.
- Dữ liệu đang ghi nằm trong bộ nhớ. Nếu đóng tab/trình duyệt hoặc ngắt debugger trước khi xuất, bắt đầu lại. Nếu tải xuống lỗi, có thể bấm xuất lại ngay khi popup còn mở; không bảo đảm giữ bản xuất sau khi service worker ngủ.
- Cookie phiên và token có thể hết hạn. Tiện ích không giải CAPTCHA hoặc tự làm mới token.
- Không có screenshot trong gói extension. CDP / Scout thông thường vẫn có screenshot.

Sau khi pull code có thay đổi extension, vào trang quản lý tiện ích và bấm **Reload / Tải lại**.
