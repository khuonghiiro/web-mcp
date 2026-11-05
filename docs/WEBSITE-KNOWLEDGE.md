# Dữ liệu và skill theo website

Studio và CLI lưu capture mới tại `artifacts/<hostname>/<tên-phiên>/`. Ví dụ `artifacts/flow.google.com/tao-anh-01/` chứa HAR, DOM, auth, workflow và kết quả phân tích. Domain lấy từ URL website, không lấy từ máy chủ API/CDN. Các cổng dùng chung nhóm hostname; session.json vẫn giữ origin đầy đủ. Không ghi đè phiên đã tồn tại.

Sau khi lưu qua `studio_close`, `studio_finish`, CLI `scout`, `auto` hoặc `import`, bộ sinh cập nhật:

- `.agents/sites.json`: ánh xạ hostname → namespace cố định.
- `.agents/skills/fgc-project/SKILL.md`: `name: fgc:fix` cho `flow.google.com`.
- `.agents/rules/sites/fgc.md`: phạm vi và quy tắc của website.
- `references/observations.json`: endpoint, mã trạng thái, RPC ID và tên workflow quan sát ở từng phiên; không chứa body hoặc giá trị xác thực.
- `references/notes.md`: ghi chú do người/AI kiểm chứng, không bị bộ sinh ghi đè.

Domain từ ba phần lấy chữ đầu mỗi phần (`flow.google.com` → `fgc`). Domain hai phần lấy chữ đầu tên và tối đa hai chữ đầu đuôi (`claude.ai` → `cai`). Nếu trùng namespace hoặc thư mục đã có, thêm hậu tố hash ổn định. Không chọn ngẫu nhiên lại mỗi lần cào. Subdomain là website riêng.

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
