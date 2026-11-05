---
name: flow:list-projects
description: "Liệt kê và tìm dự án trên flow.google.com bằng API hoặc UI; dùng khi cần chọn dự án trước thao tác tiếp theo."
---

<!-- web-to-mcp:managed -->
# flow:list-projects

Website: https://flow.google.com/. Chỉ dùng cho hostname này.

## Liệt kê dự án Flow

Trạng thái kiểm chứng: RPC danh sách và UI đã quan sát; contract phân trang chưa kiểm chứng.

Đầu vào:
- `filter`: Từ khóa tên dự án nếu người dùng yêu cầu; lọc kết quả đã đọc, chưa xác minh tham số lọc phía server.

Chuẩn bị: [flow:auth](../flow-auth/SKILL.md). Nếu người dùng chọn UI, dùng nhánh UI bên dưới.

## API
- `POST https://flow.google.com/_/AiSandboxAngularFrontend/data/batchexecute`, RPC `UpteDb`; schema ID `6445f9493e1d` trong [hợp đồng API](../flow-project/references/api.json).
- POST endpoint batchexecute với query rpcids=UpteDb. Xem query/form/body schema theo RPC trong api.json; các trường at, f.sid và cookie lấy từ phiên local mới.
- f.req là chuỗi JSON; envelope[0][0][0] là RPC ID và envelope[0][0][1] là chuỗi JSON args. Không gán ý nghĩa cho các phần tử args chưa kiểm chứng; lấy mẫu cấu trúc hiện hành khi mở danh sách trên UI.
- Response có thể có prefix chống XSSI và khung nhiều dòng. Đọc các dòng JSON chứa wrb.fr, tìm phần tử có RPC ID UpteDb rồi JSON.parse payload string. Không coi HTTP 200 là đủ.
- Chưa xác minh contract phân trang. Nếu kết quả chưa đủ, dùng UI cuộn danh sách để quan sát request trang tiếp theo trước khi tuyên bố đã lấy toàn bộ.

## UI
1. Đi tới https://flow.google.com/ và inspect; nếu ở trang đăng nhập thì thực hiện flow:auth.
2. Đọc các card/link dự án hiện có, lấy tên và href bằng studio_extract với selector vừa quan sát. Không click Dự án mới khi chỉ yêu cầu liệt kê.
3. Nếu danh sách tải dần, cuộn từng đợt và gộp theo ID/link; dừng khi không còn dự án mới hoặc đã đủ phạm vi yêu cầu.
4. Muốn mở dự án: chọn đúng tên/ID người dùng chỉ định từ danh sách; inspect lại sau khi click.

## Kiểm tra kết quả
- Trả danh sách tên và link dự án cùng phạm vi đã đọc; không tiết lộ cookie/token.
- Phân biệt danh sách rỗng hợp lệ với lỗi xác thực hoặc UI chưa tải.

Nguồn mô tả đã rà soát: [tasks.json](../flow-project/references/tasks.json). Không tự ghi đè file này khi cào bổ sung.
