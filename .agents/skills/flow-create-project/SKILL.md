---
name: flow:create-project
description: "Tạo dự án mới trên flow.google.com bằng API hoặc nút Dự án mới; dùng khi người dùng yêu cầu tạo dự án."
---

<!-- web-to-mcp:managed -->
# flow:create-project

Website: https://flow.google.com/. Chỉ dùng cho hostname này.

## Tạo dự án Flow

Trạng thái kiểm chứng: API tạo dự án đã chạy thành công và kiểm tra bằng RPC danh sách; thao tác UI Dự án mới đã quan sát.

Đầu vào:
- `name`: Tên dự án mong muốn. API đã xác minh vị trí args[1][1][0]; UI có thể tạo với tên mặc định.

Chuẩn bị: [flow:auth](../flow-auth/SKILL.md). Nếu người dùng chọn UI, dùng nhánh UI bên dưới.

## API
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `jHPbke`; schema ID `2b8f637713af` trong [hợp đồng API](../flow-project/references/api.json).
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `UpteDb`; schema ID `6445f9493e1d` trong [hợp đồng API](../flow-project/references/api.json).
- Endpoint POST /_/AiSandboxAngularFrontend/data/batchexecute, query rpcids=jHPbke, form application/x-www-form-urlencoded gồm f.req và at theo capture hiện hành. Cookie, at, f.sid và cấu hình runtime chỉ lấy local.
- Giải mã form.f.req thành envelope; JSON.parse(envelope[0][0][1]) thành args; thay args[1][1][0] bằng name; JSON.stringify args trở lại envelope[0][0][1], rồi stringify envelope và URL-encode form. Các trường chưa biết giữ theo request hiện hành, không hardcode từ máy khác.
- Đọc frame wrb.fr của jHPbke rồi JSON.parse phần payload; lần thử thành công trả project ID ở data[0], tên ở data[1][0]. Kiểm tra kiểu dữ liệu trước khi dùng vì contract có thể thay đổi.
- Gọi flow:list-projects để xác minh ID mới có trong danh sách. Nếu timeout hoặc response mơ hồ, kiểm tra danh sách trước khi tạo lại để tránh trùng dự án.

## UI
1. Từ trang danh sách, inspect tìm nút Dự án mới. Selector từng ghi: button[aria-label='addDự án mới']; chỉ dùng nếu còn khớp đúng nút hiện hành.
2. Click một lần và chờ URL/DOM của trang dự án; inspect lại. Không dựa vào wait body để khẳng định đã tạo thành công.
3. Nếu UI dùng tên mặc định, chỉ đổi tên khi tìm được control phù hợp và xác minh bước đó; không giả định click Dự án mới đã dùng name.
4. Lấy project URL và tên hiển thị; xác minh lại trong danh sách nếu cần.

## Kiểm tra kết quả
- Có project ID/URL mới và được xác nhận trên UI hoặc RPC danh sách.
- Báo rõ tên thực tế; không khẳng định đổi tên UI thành công nếu chưa kiểm chứng.

Nguồn mô tả đã rà soát: [tasks.json](../flow-project/references/tasks.json). Không tự ghi đè file này khi cào bổ sung.
