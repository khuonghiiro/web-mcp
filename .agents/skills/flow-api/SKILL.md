---
name: flow:api
description: "Tra endpoint và schema tham số của flow.google.com; dùng khi cần chọn hoặc bổ sung API cho tác vụ."
---

<!-- web-to-mcp:managed -->
# flow:api

Website: https://flow.google.com/. Chỉ dùng cho hostname này.

Đọc [flow:auth](../flow-auth/SKILL.md) nếu máy này chưa có phiên hợp lệ. Đọc [hợp đồng API](../flow-project/references/api.json); mỗi entry có origin, method, path, rpcId (nếu có), parameters theo query/header/form, schema body và trạng thái quan sát.

- `localOnly` / `local-credential`: giá trị phải lấy từ phiên hiện hành, không lấy từ Git.
- `tuple` là vị trí trong array; `decodedJson` là JSON nằm bên trong một chuỗi. Không gửi schema thay cho payload.
- `required: unknown`: một lần quan sát không chứng minh trường bắt buộc. Không có example/default từ dữ liệu người dùng.
- Tìm skill tác vụ trong [danh mục](../flow-project/references/skills.json) để biết ý nghĩa tham số và kiểm tra thành công. Không tự gán ý nghĩa cho tuple chưa xác minh.
- Đọc evidence local khi còn thiếu giá trị cấu hình/runtime hoặc cấu trúc request. Nếu mới pull code chưa có evidence, dùng [flow:auth](../flow-auth/SKILL.md), ghi thao tác UI tương ứng rồi phân tích. Chọn API origin chính xác; không gửi cookie website sang origin khác.
- Kiểm tra payload lỗi RPC và UI sau thao tác. Không tự retry yêu cầu tạo/xóa nếu kết quả chưa rõ. Người dùng yêu cầu dùng UI thì đi theo flow:browse hoặc nhánh browser của skill tác vụ, không bắt buộc API.
