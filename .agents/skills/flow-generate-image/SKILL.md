---
name: flow:generate-image
description: "Nhập prompt và tạo ảnh trên flow.google.com; hỗ trợ thao tác UI đã quan sát, giải thích RPC ảnh và giới hạn xác minh của API."
---

<!-- web-to-mcp:managed -->
# flow:generate-image

Website: https://flow.google.com/. Chỉ dùng cho hostname này.

## Tạo ảnh trong dự án Flow

Trạng thái kiểm chứng: Tạo qua UI từng thành công 1 ảnh 1024×1024; API độc lập thiếu xác minh thất bại. Workflow selector cần inspect lại trước khi replay.

Đầu vào:
- `project`: Dự án người dùng chọn; nếu chưa có thì dùng flow:list-projects hoặc flow:create-project khi được yêu cầu.
- `prompt`: Nội dung ảnh do người dùng yêu cầu; vị trí quan sát trong payload RPC: args[1][0][8][0][0][0].
- `options`: Model, số ảnh và tỉ lệ nếu người dùng chỉ định. Đọc lựa chọn hiện hành trên UI; chưa xác minh đầy đủ ánh xạ API.

Chuẩn bị: [flow:auth](../flow-auth/SKILL.md). Nếu người dùng chọn UI, dùng nhánh UI bên dưới.

## API
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `ogiZ0b`; schema ID `d16e4c6d8d70` trong [hợp đồng API](../flow-project/references/api.json).
- POST batchexecute với rpcids=ogiZ0b. Xem schema form f.req/at và tuple JSON trong api.json; payload args là JSON nằm ở envelope[0][0][1]. Vị trí prompt nêu trên đã đối chiếu kiểu string trong capture.
- Các UUID, seed, model/config và context khác phải lấy từ thao tác hiện hành; chưa đủ bằng chứng gán tên cho mọi vị trí tuple. Không gửi ID của tài khoản đã cào trước.
- API ảnh độc lập chưa được xác nhận dùng được: thử thiếu dữ liệu xác minh trả HTTP 200 nhưng lỗi RPC 7 PUBLIC_ERROR_UNUSUAL_ACTIVITY. Không tự tạo/giả token, không xem token dài là cấu hình cố định.
- Nếu người dùng muốn API, ghi một lần tạo hợp lệ qua website rồi đối chiếu request/response. Khi còn phụ thuộc xác minh website, báo giới hạn và dùng UI nếu phù hợp yêu cầu.

## UI
1. Mở đúng dự án và inspect, chọn chế độ ảnh thay vì video khi UI có lựa chọn. Không bắt đầu nhập prompt ở trang danh sách.
2. Tìm trình soạn thảo contenteditable trong flow-rich-text-editor bằng studio_inspect. Dùng selector được trả về và studio_fill với parameter=prompt; kiểm tra nội dung đã nhập. Không dùng textarea giả định.
3. Chọn model/tỉ lệ/số ảnh từ các control quan sát được theo yêu cầu, sau đó tìm nút bắt đầu tạo. Selector từng ghi: button[aria-label='Bắt đầu tạo']; kiểm tra lại ngôn ngữ và trạng thái enabled.
4. Click gửi một lần, theo dõi tiến trình và lỗi bằng inspect. Nếu yêu cầu xác minh, để người dùng hoàn thành trên website rồi kiểm tra lại trạng thái; không bấm tạo liên tục.
5. Chờ card ảnh hoàn tất; đọc kết quả thực tế và link nếu có. Selector img[alt*='generated'], div.image-result trong bản ghi cũ chưa được chứng minh ổn định, không dùng làm điều kiện thành công duy nhất.

## Kiểm tra kết quả
- UI hiển thị ảnh hoàn tất trong đúng dự án, không còn pending hoặc lỗi.
- Đối chiếu số ảnh/kích thước nếu UI cung cấp. HTTP 200 hoặc một ảnh thumbnail cũ không chứng minh tạo ảnh mới thành công.

Nguồn mô tả đã rà soát: [tasks.json](../flow-project/references/tasks.json). Không tự ghi đè file này khi cào bổ sung.
