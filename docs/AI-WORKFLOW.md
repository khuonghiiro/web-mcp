# AI tự khám phá website và tạo MCP

Studio gồm **MCP điều khiển trình duyệt cho AI** và **bộ sinh MCP riêng cho website**. AI client (mô hình bạn đang dùng) quyết định click đâu, kiểm tra kết quả, thử các luồng và chọn cách tạo tool. Studio cung cấp công cụ và thu thập bằng chứng; không có LLM tự chạy bên trong file BAT.

## Kết nối lần đầu

### Luồng dùng đơn giản

- Chạy `setup.bat` sau khi tải/cập nhật source. `run.bat` mặc định hiển thị **Chuẩn bị kết nối AI**, **Cài / cập nhật extension**, và **Công cụ nâng cao**. Các số menu cũ trong tài liệu nằm trong Công cụ nâng cao.
- Mở project trong AI client có MCP Studio. Trên tab website muốn dùng, mở extension và bật **Tự kết nối AI với tab này** một lần.
- Yêu cầu AI thao tác website với `endpoint: "extension"`. Extension tự chờ MCP và thử kết nối mỗi 30 giây; `studio_start` chờ tối đa 35 giây để đón kết nối. Không cần dán mã hay để `run.bat` mở.
- Tự kết nối chỉ áp dụng cho tab đã chọn và cùng origin. Đóng tab/trình duyệt, tắt checkbox, bấm Ngắt kết nối AI hoặc bấm dừng gỡ lỗi sẽ kết thúc. Chuyển sang website khác không tự cấp quyền cho website mới.
- AI client vẫn cần nạp MCP; file BAT không chứa mô hình AI. Nếu chạy nhiều MCP Studio, tự kết nối dùng tiến trình đang giữ cổng 43119; dùng mã thủ công để chọn tiến trình khác.

1. Chạy `setup.bat` để build source mới. Hoặc `pnpm build` rồi `pnpm studio:config`.
2. File `studio-client-config.json` được tạo ở thư mục gốc, chứa đường dẫn đúng trên máy bạn. Thêm mục `mcpServers` này vào AI client có hỗ trợ MCP stdio (không ghi đè các MCP khác), rồi tải lại kết nối của client.

   **Riêng Codex:** script cập nhật riêng server `web_to_mcp_studio` trong `.codex/config.toml`, giữ các server khác. Cấu hình dùng `command = "node"`, `args = ["scripts/start-studio.mjs"]`, `cwd = ".."`; không chứa đường dẫn ổ đĩa hay `STUDIO_ROOT`. Codex giải quyết `cwd` tương đối từ thư mục `.codex`; launcher/server tìm thư mục dự án từ vị trí file của chính nó. Mở project đã tin cậy, khởi động lại MCP/app để nạp tool. [Quy tắc đường dẫn tương đối của Codex](https://learn.chatgpt.com/docs/config-file/config-advanced).

   **Client khác:** `studio-client-config.json` vẫn dùng đường dẫn launcher tuyệt đối được tự dò lúc setup, vì các client không dùng chung cú pháp biến thư mục workspace. Đây là file cục bộ được Git bỏ qua, không phải đường dẫn cố định trong source. Chạy `setup.bat` hoặc mục **9** sau khi đổi máy/thư mục rồi nhập lại JSON vào client. Node phải có trên PATH. Không sao chép cấu hình project Codex vào cấu hình global vì gốc đường dẫn sẽ thay đổi.
3. Kiểm tra AI thấy các tool `studio_start`, `studio_inspect`, `studio_click`… Có kết nối trình duyệt nhưng chưa có những tool này thì AI chưa thể điều khiển qua Studio.
4. Nếu đã bật CDP trên Chrome như phiên ghi thủ công, chỉ cần yêu cầu AI gọi `studio_start` với `endpoint: "chrome"`, URL website và một tên dự án mới. Edge dùng `msedge`. Kết thúc phiên ghi thủ công trước để tránh hai bên cùng điều khiển tab.

Hoặc dùng tiện ích:

1. Vào `chrome://extensions` / `edge://extensions`, **Reload** tiện ích từ thư mục `extension/` (bản 0.2.0).
2. Bật MCP Studio trong AI client. Server tự mở cầu nối localhost khi khởi động.
3. Mở popup tiện ích trên tab đã đăng nhập, bấm **Kết nối AI với tab này**, không cần nhập mã. Tiện ích tự tìm Studio ở `127.0.0.1:43119`. Nếu có nhiều tiến trình Studio, cổng này thuộc tiến trình khởi động trước; để chọn tiến trình khác, yêu cầu AI gọi `studio_extension_pair`, mở **Nhập mã thủ công** và dán `pairingUrl`. Không chia sẻ mã cho website.
4. Khi hiện **Đã kết nối AI**, AI gọi `studio_start` với `endpoint: "extension"`, URL website và tên dự án mới.

Tiện ích kết nối HTTP cục bộ 127.0.0.1 bằng mã ngẫu nhiên, không gửi dữ liệu lên dịch vụ ngoài. AI client cần chạy trên cùng máy. Reload tiện ích, đóng MCP hoặc khởi động lại client có thể ngắt ghép nối; gọi lại tool ghép nối và dùng mã mới. Không cần mở cổng debug khi dùng tiện ích.

## Prompt gợi ý

> Dùng Web-to-MCP Studio kết nối Chrome đang mở tại [URL], tên dự án [tên-mới], endpoint chrome. Tự khảo sát chức năng tìm kiếm và phân trang: đọc trang, điền từ khóa thử, click và cuộn; kiểm tra kết quả và traffic. Không gửi tin nhắn, đặt hàng hay thay đổi tài khoản. Lưu workflow tìm kiếm với tham số query và selector lấy kết quả. Sau đó sinh MCP cho website này và báo những phần đã kiểm chứng, những phần chưa hỗ trợ.

Đổi tác vụ và quyền thao tác theo nhu cầu của bạn. Nếu dùng tiện ích, yêu cầu ghép nối trước rồi chọn endpoint extension.

## Quy trình AI

| Tool | Mục đích |
| --- | --- |
| `studio_extension_pair` | Tạo mã ghép nối tiện ích với AI |
| `studio_start` | Kết nối tab và ghi traffic tự động |
| `studio_inspect` | Đọc nội dung, nhãn và CSS selector của điều khiển |
| `studio_navigate`, `studio_click`, `studio_fill`, `studio_press`, `studio_scroll`, `studio_wait` | Thực thi thao tác và trả trạng thái trang |
| `studio_extract` | Trích xuất text/href từ selector |
| `studio_network` | Xem endpoint/method/status vừa quan sát |
| `studio_api_preview` | Suy luận schema API hiện tại, không cần kết thúc phiên |
| `studio_runtime` | Xem script đã tải, resource timing và lỗi JS |
| `studio_workflow_begin` | Bắt đầu ghi các bước của một tác vụ dùng lại |
| `studio_workflow_save` | Lưu tác vụ với tên, mô tả và selector kết quả |
| `studio_workflow_discard` | Hủy bản ghi bước; không hoàn tác website |
| `studio_finish` | Lưu dữ liệu, sinh MCP website rồi ngắt kết nối |
| `studio_close` | Kết thúc mà không sinh MCP |

Một phiên có thể lưu nhiều workflow. `studio_fill` bắt buộc có tên `parameter`; giá trị người dùng nhập dùng lúc khám phá nhưng **không được lưu vào workflow sinh ra**. Những giá trị này vẫn có thể xuất hiện trong HAR/DOM cục bộ. Các URL và selector đã ghi cũng cần được kiểm tra trước khi chia sẻ project.

## MCP sinh ra dùng về sau

`generated-mcps/<tên>/` có API tools và tool `browser_<tên-workflow>` cho mỗi workflow được lưu. Chạy `npm install`, `npm run build` trong thư mục đó và dùng `client-config.json` với AI client.

- API tools gọi endpoint đã quan sát; xác thực và quyền write theo README của MCP.
- Browser workflow tools chạy lại các bước đã kiểm chứng, nhận tham số mới và trả kết quả trích xuất. Dùng `MCP_BROWSER_CDP=chrome` / `msedge` / URL CDP, hoặc tool `browser_connect_extension` của MCP sinh ra để ghép nối tiện ích.
- Có thể sinh MCP chỉ có browser workflow khi website không dùng API JSON.
- Tab/phiên đăng nhập được giữ lại. Hết hạn đăng nhập hoặc CAPTCHA có thể cần bạn xử lý.

## Phạm vi hiện tại

AI có thể đọc DOM, thao tác, xem traffic, schema và dấu hiệu runtime; **chưa có phân tích toàn bộ mã JavaScript, debugger breakpoint, duyệt toàn bộ website hoặc tác nhân tự chạy không cần AI client**. Workflow là chuỗi bước tuyến tính, tối đa 100 bước; chưa tự suy luận nhánh điều kiện, vòng lặp phân trang hay tự sửa selector khi giao diện thay đổi. Khi khám phá trực tiếp, AI có thể tự lặp thao tác nhiều lần qua tool. Selector dùng cho cả hai chế độ nên chọn CSS; các selector riêng của Playwright không chạy qua tiện ích.

Tiện ích điều khiển tab đã ghép nối, giới hạn điều hướng cùng origin, chưa thao tác iframe/shadow DOM phức tạp hoặc chuyển tab popup. Các nút click dùng CDP mouse events; nhập liệu phát input/change. Website có điều khiển tùy biến có thể cần hỗ trợ thêm. Không chạy hai tác vụ điều khiển đồng thời trên cùng tab.

## Lỗi kết nối

- **Không thấy ô Kết nối AI:** tiện ích vẫn bản cũ; bấm Reload ở trang Extensions.
- **Không thấy tool studio_*:** AI client chưa nạp cấu hình hoặc đang dùng tiến trình build cũ; build lại và tải lại MCP.
- **Mã không hợp lệ/HTTP 403:** dùng nguyên pairingUrl mới do MCP đang chạy trả về, không dùng URL website.
- **Mất kết nối AI:** MCP đã dừng, máy không cùng localhost, hoặc debugger bị ngắt; ghép nối lại. Không thử lặp thao tác ghi dữ liệu khi chưa kiểm tra kết quả lần trước.
- **Chưa tìm thấy tab:** mở website HTTP(S) cần thao tác trước khi bấm kết nối; không ghép nối tab `chrome://` hay trang tiện ích.
- **Tên dự án đã tồn tại:** dùng tên mới. Dữ liệu phiên cũ được giữ nguyên.

Kiểm thử toàn luồng bằng `pnpm test:studio` (cần Chromium Playwright). Test dùng website local và client MCP thật, không dùng tài khoản cá nhân.

## Website-specific skills

Call `studio_site_guide` with the website URL before using existing knowledge. Read the returned local skill and rule. `studio_start` also returns the site guide; `studio_close` and `studio_finish` save to `artifacts/<hostname>/<session>/` and update namespaced knowledge. See [storage and routing](WEBSITE-KNOWLEDGE.md).
