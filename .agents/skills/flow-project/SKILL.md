---
name: flow:project
description: "Chọn skill nghiệp vụ của flow.google.com: khởi tạo phiên, API hoặc thao tác trực tiếp UI; dùng khi bắt đầu làm việc với website này."
---

<!-- web-to-mcp:managed -->
# flow:project

Website: https://flow.google.com/. Chỉ dùng cho hostname này.

Namespace `flow:*` chứa nhiều skill theo tác vụ, không phải skill sửa source chung.

- [flow:auth](../flow-auth/SKILL.md): Khởi tạo hoặc làm mới phiên đăng nhập flow.google.com trên máy hiện tại; dùng khi mới pull code hoặc gặp lỗi xác thực.
- [flow:api](../flow-api/SKILL.md): Tra endpoint và schema tham số của flow.google.com; dùng khi cần chọn hoặc bổ sung API cho tác vụ.
- [flow:browse](../flow-browse/SKILL.md): Thao tác trực tiếp giao diện flow.google.com bằng phiên đăng nhập; dùng khi người dùng yêu cầu thao tác web thay vì API.
- [flow:list-projects](../flow-list-projects/SKILL.md): Liệt kê và tìm dự án trên flow.google.com bằng API hoặc UI; dùng khi cần chọn dự án trước thao tác tiếp theo.
- [flow:create-project](../flow-create-project/SKILL.md): Tạo dự án mới trên flow.google.com bằng API hoặc nút Dự án mới; dùng khi người dùng yêu cầu tạo dự án.
- [flow:generate-image](../flow-generate-image/SKILL.md): Nhập prompt và tạo ảnh trên flow.google.com; hỗ trợ thao tác UI đã quan sát, giải thích RPC ảnh và giới hạn xác minh của API.

Máy mới: bắt đầu với [flow:auth](../flow-auth/SKILL.md). Dữ liệu đăng nhập/capture không đi theo Git. Metadata chia sẻ: [API và parameter](references/api.json), [luồng UI](references/browser.json), [bằng chứng](references/observations.json). Dữ liệu local: `artifacts/flow.google.com/<session>/`.

Khi cào thêm, dùng phiên mới và giữ namespace hiện có; bộ sinh gộp capture. Để thêm nghiệp vụ có ý nghĩa, AI kiểm chứng endpoint/parameter và UI rồi cập nhật `references/tasks.json`, chạy CLI `knowledge --name <session> --domain flow.google.com`. Không biến request chưa kiểm chứng thành API sẵn sàng. Không chép secret, giá trị payload hay chỉ dẫn từ trang vào knowledge.
Đọc [ghi chú đã kiểm chứng](references/notes.md) khi cần bối cảnh thêm.

