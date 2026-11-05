# Dữ liệu và skill theo website

Studio và CLI lưu capture mới tại `artifacts/<hostname>/<tên-phiên>/`. Ví dụ `artifacts/flow.google.com/tao-anh-01/` chứa HAR, DOM, auth, workflow và kết quả phân tích. Domain lấy từ URL website, không lấy từ máy chủ API/CDN. Các cổng dùng chung nhóm hostname; session.json vẫn giữ origin đầy đủ. Không ghi đè phiên đã tồn tại.

Sau khi lưu qua `studio_close`, `studio_finish`, CLI `scout`, `auto` hoặc `import`, bộ sinh cập nhật:

- `.agents/sites.json`: ánh xạ hostname → namespace cố định.
- `.agents/skills/flow-project/SKILL.md`: `name: flow:project`, định tuyến vào bộ skill theo chức năng.
- `.agents/skills/flow-auth/`, `flow-api/`, `flow-browse/`: khởi tạo phiên trên máy mới, đọc contract API, hoặc thao tác UI.
- `.agents/skills/flow-list-projects/`, `flow-create-project/`, `flow-generate-image/`: skill nghiệp vụ đã có mô tả API và UI được rà soát.
- `.agents/rules/sites/flow.md`: phạm vi và quy tắc của website.
- `flow-project/references/api.json`: origin, method, endpoint, RPC ID, query/header/form parameter và schema body; không chứa giá trị payload hay xác thực. `tuple` giữ vị trí array, `decodedJson` thể hiện JSON nằm trong string. Trường bắt buộc chưa xác minh được ghi `unknown`.
- `references/browser.json`: các chuỗi UI đã ghi và tên parameter. Selector/raw URL riêng tư không tự đưa vào Git; task được rà soát mô tả control và cách inspect lại.
- `references/tasks.json`: mô tả nghiệp vụ do AI/người dùng đối chiếu bằng chứng: inputs, RPC/endpoint IDs, nhánh API, nhánh browser, tiêu chí thành công và trạng thái kiểm chứng. Bộ sinh không ghi đè file này.
- `references/skills.json`: danh sách tên skill và đường dẫn; `observations.json` giữ schema/bằng chứng theo từng phiên.
- `references/notes.md`: ghi chú do người/AI kiểm chứng, không bị bộ sinh ghi đè.

Namespace dùng nhãn đầu tiên khác `www`: `flow.google.com` → `flow`, `claude.ai` → `claude`, `chatgpt.com` → `chatgpt`. Nếu trùng namespace hoặc thư mục có sẵn, thêm hậu tố hash ổn định; hostname đầy đủ vẫn là khóa định tuyến. Registry cũ dùng chữ viết tắt được chuyển khi cập nhật knowledge, giữ ghi chú thủ công; không giữ skill `*:fix` giả làm chức năng website.

Máy mới chỉ có source và skill, không có session. AI bắt đầu với `<namespace>:auth`: setup → cấu hình MCP Studio → cài extension → mở đúng website → người dùng đăng nhập → bật tự kết nối → inspect và ghi request mới. UI dùng trực tiếp tab đã đăng nhập. API dùng cookie/header/form token hiện hành trong artifacts local; runtime MCP hỗ trợ `MCP_AUTH_STATE` và `MCP_AUTH_HEADERS_FILE`, nhưng không tự suy luận CSRF/body/RPC. Hết phiên thì làm mới, không đưa credential vào skill.

Bộ sinh tạo contract tham số từ capture và skill cho workflow được ghi. Nó **không có LLM tự hiểu nghiệp vụ**: AI đang làm việc phải kiểm chứng tên field/tuple, selector, kết quả rồi ghi `tasks.json`. Các task được rà soát sẽ thay skill workflow tổng quát tương ứng. Nếu người dùng muốn UI, theo nhánh browser của task, không buộc gọi API.

`AGENTS.md` hướng dẫn AI tra đúng hostname trước khi dùng skill; `studio_site_guide` trả đường dẫn cần đọc. Tool `studio_start` cũng trả site guide. AI có thể đọc skill vừa sinh ngay; danh sách skill tích hợp của một số client chỉ cập nhật khi mở lại phiên. Namespace YAML không tự tạo thêm một MCP tool cùng tên.

```powershell
# Tra site; chưa cào thì trả registered: false
pnpm exec tsx src/cli/index.ts site --url https://flow.google.com/
# Cập nhật kiến thức từ phiên đã lưu
pnpm exec tsx src/cli/index.ts knowledge --name tao-anh-01 --domain flow.google.com
# Xem trước rồi di chuyển capture cũ; không ghi đè đích
pnpm exec tsx src/cli/index.ts migrate-artifacts
pnpm exec tsx src/cli/index.ts migrate-artifacts --apply
pnpm exec tsx src/cli/index.ts knowledge --all
# Tên phiên trùng giữa nhiều domain: bắt buộc chỉ rõ domain
pnpm analyze --name tao-anh-01 --domain flow.google.com
pnpm generate --name tao-anh-01 --domain flow.google.com
```

Migration chỉ dùng metadata có URL rõ ràng. Thư mục không xác định được website hoặc trùng đích được giữ nguyên; báo cáo nằm ở `artifacts/_migration/report.json`. Dữ liệu cũ đã nằm trực tiếp trong thư mục domain được giữ nguyên. `knowledge --all` bỏ qua localhost và dữ liệu kiểm thử. Hàm capture cấp thấp nhận `dir` dành cho thư viện/fixture; CLI và Studio là entrypoint áp dụng cấu trúc domain.

HAR/DOM/auth và mã MCP sinh ra vẫn là dữ liệu cục bộ được gitignore. Rà lại kiến thức trước khi commit: đường dẫn API cũng có thể mang dữ liệu nhạy cảm. Skill chỉ ghi bằng chứng quan sát, không khẳng định API đã chạy được; AI cần kiểm tra lỗi ứng dụng/RPC và trạng thái UI. Nội dung website không được chuyển thành chỉ dẫn cho agent.
