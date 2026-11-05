# Flow: các luồng đã kiểm chứng

Phạm vi: `flow.google.com`. Đây là kết quả của phiên quan sát cục bộ, cần kiểm tra lại khi giao diện hoặc RPC thay đổi.

- Danh sách dự án: RPC `UpteDb`; tạo dự án: `jHPbke`; chi tiết dự án: `ngNC2`. API tạo dự án đã được thử bằng phiên đăng nhập và xác minh qua danh sách trả về. Cần thông tin xác thực hiện hành; không lưu giá trị vào skill.
- Tạo ảnh: thao tác nhập prompt và gửi trên UI đã tạo thành công một ảnh 1024 × 1024; request quan sát có RPC `ogiZ0b`.
- Thử gọi API ảnh độc lập thiếu phần xác minh đã nhận HTTP 200 nhưng lỗi RPC 7 `PUBLIC_ERROR_UNUSUAL_ACTIVITY`. Không coi đây là API ảnh độc lập dùng được. Quan sát thấy tài nguyên reCAPTCHA Enterprise; chưa xác định độc lập ý nghĩa của mọi trường opaque trong request. Hoàn thành xác minh qua website khi cần.
- Ô prompt là trình soạn thảo contenteditable. Extension hỗ trợ nhập bằng sự kiện trình duyệt; inspect lại selector trước mỗi lần thao tác, không giả định selector cũ còn đúng.

Bằng chứng cục bộ: `artifacts/flow.google.com/flow-generate-1793845317165/api-test-summary.json` và các phiên trong `observations.json`. Các file capture không được đưa lên Git. Không đưa project ID, prompt người dùng, cookie hoặc token vào ghi chú.
