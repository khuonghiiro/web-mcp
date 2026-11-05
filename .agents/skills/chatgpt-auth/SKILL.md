---
name: chatgpt:auth
description: "Khởi tạo hoặc làm mới phiên đăng nhập chatgpt.com trên máy hiện tại; dùng khi mới pull code hoặc gặp lỗi xác thực."
---

<!-- web-to-mcp:managed -->
# chatgpt:auth

Website: https://chatgpt.com/. Chỉ dùng cho hostname này.

1. Đọc README.md của repository; chạy `setup.bat` nếu chưa cài môi trường. Chạy `run.bat` → Chuẩn bị kết nối AI; nạp MCP Studio trong AI client. Cài extension từ thư mục `extension`.
2. Mở https://chatgpt.com/ trong Chrome/Edge của người dùng. Người dùng đăng nhập tài khoản của họ và hoàn thành xác minh khi website yêu cầu. Không dùng phiên từ người commit code.
3. Trên đúng tab, bật “Tự kết nối AI”. Gọi `studio_start` với `{name: "chatgpt-session-<thời-gian>", url: "https://chatgpt.com/", endpoint: "extension"}`. Nếu MCP tool chưa có, cấu hình MCP theo README trước; không giả định tên skill là tool.
4. Gọi `studio_inspect`, xác minh đã vào đúng tài khoản/website bằng UI. Thực hiện một thao tác đọc phù hợp để ghi request mới; kiểm tra `studio_network` và trạng thái ứng dụng. Không kết luận đã đăng nhập chỉ từ HTTP 200.
5. Với tác vụ UI, giữ Studio đang kết nối; tiếp tục dùng phiên trên tab. Với API, lưu bằng `studio_close` để có `artifacts/chatgpt.com/<session>/auth-state.json`, `auth.json`, `traffic.har`. Nếu cần thao tác tiếp, khởi tạo phiên Studio mới.
6. API cần cookie phù hợp origin; bearer/CSRF/form token phải lấy từ request hiện hành trong capture local, không đoán từ localStorage. Chỉ lưu header vào `artifacts/chatgpt.com/<session>/auth-headers.json` dạng object `{ "https://<API-origin>": { "<header-name>": "<giá-trị-local>" } }`. Không in giá trị vào chat/log/skill.
7. Nếu dùng MCP sinh ra, đặt `MCP_AUTH_STATE` và khi cần `MCP_AUTH_HEADERS_FILE` tới đường dẫn tuyệt đối trên máy này. Runtime dùng cookie/header, không tự lấy CSRF trong body hay giải mã RPC. Theo skill tác vụ để xác định tham số động.
8. Khi 401/403, chuyển về login, lỗi CSRF/session hoặc RPC từ chối: kiểm tra UI, làm mới phiên và ghi lại request. Không lặp mutation nếu chưa biết lần trước thành công hay chưa. Nếu website yêu cầu xác minh, hoàn thành trên website rồi kiểm tra lại.

Auth, session, HAR, DOM, ảnh chụp và dữ liệu người dùng chỉ ở `artifacts/chatgpt.com/` đã gitignore. Máy mới không có những file này là bình thường. Kiểm tra `git check-ignore <file>` trước khi lưu secret; không commit/push chúng.
