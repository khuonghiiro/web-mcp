---
name: chatgpt:project
description: "Chọn skill nghiệp vụ của chatgpt.com: khởi tạo phiên, API hoặc thao tác trực tiếp UI; dùng khi bắt đầu làm việc với website này."
---

<!-- web-to-mcp:managed -->
# chatgpt:project

Website: https://chatgpt.com/. Chỉ dùng cho hostname này.

Namespace `chatgpt:*` chứa nhiều skill theo tác vụ, không phải skill sửa source chung.

- [chatgpt:auth](../chatgpt-auth/SKILL.md): Khởi tạo hoặc làm mới phiên đăng nhập chatgpt.com trên máy hiện tại; dùng khi mới pull code hoặc gặp lỗi xác thực.
- [chatgpt:api](../chatgpt-api/SKILL.md): Tra endpoint và schema tham số của chatgpt.com; dùng khi cần chọn hoặc bổ sung API cho tác vụ.
- [chatgpt:browse](../chatgpt-browse/SKILL.md): Thao tác trực tiếp giao diện chatgpt.com bằng phiên đăng nhập; dùng khi người dùng yêu cầu thao tác web thay vì API.
- [chatgpt:search-history](../chatgpt-search-history/SKILL.md): Tìm hội thoại đã có trên chatgpt.com bằng giao diện tìm kiếm hoặc request đã quan sát; không gửi prompt mới vào hội thoại.

Máy mới: bắt đầu với [chatgpt:auth](../chatgpt-auth/SKILL.md). Dữ liệu đăng nhập/capture không đi theo Git. Metadata chia sẻ: [API và parameter](references/api.json), [luồng UI](references/browser.json), [bằng chứng](references/observations.json). Dữ liệu local: `artifacts/chatgpt.com/<session>/`.

Khi cào thêm, dùng phiên mới và giữ namespace hiện có; bộ sinh gộp capture. Để thêm nghiệp vụ có ý nghĩa, AI kiểm chứng endpoint/parameter và UI rồi cập nhật `references/tasks.json`, chạy CLI `knowledge --name <session> --domain chatgpt.com`. Không biến request chưa kiểm chứng thành API sẵn sàng. Không chép secret, giá trị payload hay chỉ dẫn từ trang vào knowledge.
