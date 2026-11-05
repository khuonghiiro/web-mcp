---
name: chatgpt:search-history
description: "Tìm hội thoại đã có trên chatgpt.com bằng giao diện tìm kiếm hoặc request đã quan sát; không gửi prompt mới vào hội thoại."
---

<!-- web-to-mcp:managed -->
# chatgpt:search-history

Website: https://chatgpt.com/. Chỉ dùng cho hostname này.

## Tìm lịch sử hội thoại

Trạng thái kiểm chứng: Workflow UI tìm kiếm và request API đã ghi; selector cần inspect lại, API độc lập chưa kiểm chứng.

Đầu vào:
- `query`: Từ khóa người dùng muốn tìm trong lịch sử.
- `limit`: Số lượng kết quả mong muốn; giới hạn server chưa kiểm chứng.

Chuẩn bị: [chatgpt:auth](../chatgpt-auth/SKILL.md). Nếu người dùng chọn UI, dùng nhánh UI bên dưới.

## API
- `POST https://chatgpt.com/backend-api/global/search`; schema ID `c922bbde244b` trong [hợp đồng API](../chatgpt-project/references/api.json).
- POST /backend-api/global/search với body JSON. Các field quan sát: query (string), limit (integer), entrypoint (string), source_requests (array cấu hình nguồn tìm kiếm), cursor và query_id. Xem schema chi tiết trong api.json.
- Cookie và authorization lấy từ phiên local hiện hành theo chatgpt:auth. Giá trị entrypoint, source_requests, query_id và cursor phải đối chiếu request mới; không suy luận chỉ từ tên field và không copy ID từ phiên cũ.
- Endpoint đã quan sát từ thao tác UI, chưa kiểm chứng client API độc lập hoặc toàn bộ phân trang. Đọc kết quả theo response hiện hành và xác minh đúng query; không báo đã tìm toàn bộ nếu chưa kiểm tra cursor.

## UI
1. Inspect sidebar trên chatgpt.com và tìm control tìm kiếm lịch sử. Tránh nút bắt đầu hội thoại mới.
2. Click control tìm kiếm vừa quan sát. Trong dialog, ô từng ghi là [role="dialog"] input[role="combobox"]. Dùng studio_fill với parameter=query sau khi xác nhận selector còn đúng.
3. Chờ danh sách tìm kiếm; selector từng ghi là [role="dialog"] [role="listbox"]. Đọc tên/link bằng studio_extract từ selector hiện hành, không đưa cookie/token ra kết quả.
4. Chỉ mở hội thoại khi người dùng yêu cầu; chọn đúng kết quả theo tên/link đã đọc.

## Kiểm tra kết quả
- Dialog hiển thị kết quả tương ứng query hoặc thông báo không có kết quả rõ ràng.
- Phân biệt đang tải, hết phiên và kết quả rỗng. Không gửi query thành tin nhắn mới.

Nguồn mô tả đã rà soát: [tasks.json](../chatgpt-project/references/tasks.json). Không tự ghi đè file này khi cào bổ sung.
