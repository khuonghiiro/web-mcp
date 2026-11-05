# Web-to-MCP Studio

CLI TypeScript biến những API quan sát được khi duyệt website thành MCP server độc lập chạy qua stdio.

**Để AI tự click, nhập liệu, cuộn và khám phá website:** dùng **MCP Studio**, xem [hướng dẫn AI tự thao tác](docs/AI-WORKFLOW.md). Chạy `setup.bat`, thêm `studio-client-config.json` vào AI client, rồi yêu cầu AI dùng các tool `studio_*`. Mục **9** trong `run.bat` tạo cấu hình và hướng dẫn. Mục 1/2 là luồng thu thập thủ công, không tự chạy AI.

MCP website sinh ra có thể gồm API tools và browser workflow tools có tham số. Tiện ích bản 0.2.0 hỗ trợ ghép nối trực tiếp để AI điều khiển tab, bên cạnh xuất file thủ công.

## Cài đặt

### Windows: chạy bằng file BAT

Sau khi clone/pull code hoặc giải nén project:

1. Nhấp đúp `setup.bat`. Script kiểm tra Node.js 22+; nếu thiếu/cũ sẽ thử cài Node.js LTS bằng winget. Sau đó dùng đúng phiên bản pnpm trong `package.json`, cài dependency theo lockfile, kiểm tra trình duyệt, kiểm tra TypeScript và build. Nếu đã có Chrome/Edge thì dùng trình duyệt đó; nếu chưa có thì tải Chromium (cần đủ dung lượng trống).
2. Nhấp đúp `run.bat`. Chọn Auto để chạy toàn bộ pipeline hoặc chọn Scout, Analyze, Generate riêng. Menu hỏi tên dự án, URL và trình duyệt; Enter chọn trình duyệt tự phát hiện, không cần nhập lệnh.

Máy cần Internet khi setup. Cài Node.js có thể hiện hộp thoại quyền quản trị của Windows. Nếu không có winget, cài Node.js LTS từ https://nodejs.org rồi mở lại `setup.bat`. pnpm được dùng qua bản đã cài đúng phiên bản hoặc npx; không thay đổi pnpm global. Sau mỗi lần pull có thay đổi dependency, chạy lại `setup.bat`.

Nếu chưa setup, `run.bat` sẽ gọi setup khi thiếu Node hoặc dependency; sau khi hoàn tất, mở lại `run.bat`. Script luôn chạy tại thư mục project kể cả khi mở từ thư mục khác. Đây là ứng dụng CLI có menu trong terminal.

Có thể dùng lệnh trực tiếp:

```bat
setup.bat -SkipBrowser
run.bat --help
run.bat auto --url https://example.com --name my-site --interactive --channel chrome
```

`-SkipBrowser` bỏ tải Chromium để dùng Chrome/Edge có sẵn. Đặt biến môi trường `WEB_MCP_NO_PAUSE=1` nếu chạy BAT trong CI/terminal và không muốn dừng chờ phím cuối chương trình. Khi setup hoặc lệnh CLI lỗi, BAT trả exit code khác 0.

### Cài thủ công

Cần Node.js 22+ và pnpm 10.

```powershell
pnpm install
pnpm exec playwright install chromium
pnpm check
pnpm test
pnpm build
```

## Chạy thử đầy đủ

```powershell
pnpm test:e2e
```

Kiểm tra riêng kết nối CDP và tiện ích bằng browser thật: `pnpm test:capture` (cần Chromium do Playwright cài). Bài kiểm tra xác nhận dùng lại tab, giữ đăng nhập, không đóng tab khác, loại cookie không liên quan, xuất/nhập file và phân tích API. Không cần dùng profile cá nhân để chạy kiểm thử.

Bài kiểm thử mở Chromium thật trên website localhost, ghi HAR, tạo OpenAPI, sinh và biên dịch MCP, kết nối bằng MCP SDK Client và gọi tool. Bao gồm API blog, tìm kiếm/phân trang, cookie đăng nhập, phát hiện phần tử CAPTCHA, validation và chặn write khi chưa bật. Đây là fixture CAPTCHA, không phải bài kiểm thử giải CAPTCHA thật. Các artifact được giữ lại để xem.

Hoặc mở terminal thứ nhất:

```powershell
pnpm demo
```

Terminal thứ hai:

```powershell
pnpm auto --url http://127.0.0.1:4173 --name demo --actions examples/actions.json
cd generated-mcps/demo
npm install
npm run build
```

File `client-config.json` trong dự án sinh ra chứa đường dẫn tuyệt đối để cấu hình client MCP hỗ trợ stdio.

## Website của bạn

### Dùng Chrome / Edge đang mở, giữ nguyên đăng nhập

**Tiện ích đã có trong source tại `extension/`.** Xem [hướng dẫn cài tiện ích](extension/README.md). Nạp bằng Load unpacked trong `chrome://extensions` hoặc `edge://extensions`, ghi tab hiện tại rồi tải file `.web-mcp.json`. Trong `run.bat`, chọn **7** để nhập file, sau đó **3** để phân tích và **4** để tạo MCP. Mục **8** hiển thị đường dẫn thư mục và cách cài. Đây là tiện ích riêng của Studio; không cần cài thêm Playwright Extension.

Hoặc kết nối trực tiếp bằng **CDP**: ở trình duyệt có hỗ trợ, mở `chrome://inspect/#remote-debugging` (Edge: `edge://inspect/#remote-debugging`) và bật cho phép gỡ lỗi phiên hiện tại. Chọn Auto/Scout trong menu rồi chọn Chrome/Edge đang mở, chấp nhận hộp thoại kết nối của trình duyệt. Phiên bản cũ không có tùy chọn này có thể dùng tiện ích ở trên hoặc một CDP endpoint đã được cấu hình.

```powershell
run.bat auto --url https://example.com --name my-site --interactive --cdp chrome
run.bat scout --url https://example.com --name edge-site --interactive --cdp msedge
run.bat scout --url https://example.com --name cdp-site --interactive --cdp http://127.0.0.1:9222
run.bat import --name imported-site --file "D:\Downloads\capture.web-mcp.json"
```

CDP dùng lại tab có URL trùng chính xác; nếu chưa có sẽ mở tab mới **trong cùng phiên đã đăng nhập**. Không tự tải lại tab có sẵn để tránh mất nội dung đang nhập: hãy tải lại hoặc thao tác sau khi kết nối để có traffic mới. Kết thúc chỉ ngắt kết nối Studio, không đóng trình duyệt hoặc tab. Không dùng cùng `--storage-state`. Cookie/localStorage xuất ra chỉ thuộc website mục tiêu; header/token cho API ở origin khác cần cấu hình riêng.

Recorder CDP giữ tối đa 2000 yêu cầu hoàn tất, 2 MB mỗi response và khoảng 20 MB response text; không ghi lịch sử trước lúc kết nối hoặc yêu cầu chưa hoàn tất lúc dừng. Xem cảnh báo/giới hạn trong HAR. File nhập từ extension không có screenshot.

### Mở phiên trình duyệt mới

```powershell
pnpm scout --url https://example.com --name example --interactive
pnpm analyze --name example
pnpm generate --name example
```

Trong cửa sổ trình duyệt, đăng nhập, hoàn thành challenge nếu có và thực hiện các thao tác muốn thu thập. Quay lại terminal nhấn Enter để lưu. Chế độ tự động chỉ truy cập trang đầu và các thao tác khai báo; không tự khám phá mọi chức năng.

- `--headed`: hiện browser khi chạy tự động.
- `--channel chrome` hoặc `--channel msedge`: dùng trình duyệt có sẵn, không cần `playwright install chromium`. E2E cũng hỗ trợ `$env:PLAYWRIGHT_CHANNEL = 'chrome'`.
- `--duration 5000`: chờ ghi nhận thêm traffic, đơn vị ms, tối đa 300000.
- `--actions examples/actions.json`: chuỗi `click`, `fill`, `wait`; thao tác cách nhau 300–800 ms.
- `--storage-state <file>`: sử dụng phiên Playwright đã lưu.
- `--artifacts <dir>`: thay thư mục artifact (mặc định `artifacts`).
- `analyze --origin https://api.example.com`: chọn riêng API origin nếu khác website. Mỗi MCP chỉ có một origin.
- `generate --output <dir>`: thay thư mục đầu ra; tên đã tồn tại sẽ bị từ chối để tránh ghi đè.

`pnpm build-mcp` là alias của `pnpm generate`. Sau build có thể chạy `node dist/src/cli/index.js --help`.

## Artifact và xác thực

`artifacts/<name>/` chứa `traffic.har` (response nhúng trực tiếp), `dom.html`, `page.png`, `session.json`, `auth.json`, `auth-state.json`, `api-spec.json` và `analysis.json`. HAR, DOM và storage state có thể chứa thông tin đăng nhập hoặc dữ liệu cá nhân; toàn bộ thư mục được gitignore. Các file này chỉ lưu cục bộ và không được đưa vào mã MCP.

MCP được sinh đọc biến môi trường:

| Biến | Công dụng |
| --- | --- |
| `MCP_AUTH_STATE` | Đường dẫn tuyệt đối đến storage-state; chọn cookie đúng domain, path, thời hạn và HTTPS |
| `MCP_AUTH_HEADERS_FILE` | Đường dẫn JSON có dạng `{ "https://api.example.com": { "Authorization": "Bearer ...", "X-CSRF-Token": "..." } }` |
| `MCP_ALLOW_WRITES` | Đặt `true` để cho phép POST/PUT/PATCH/DELETE |

Thêm `env` vào cấu hình client tương ứng nếu cần. Cookie tự được chọn, nhưng token Bearer/CSRF cần được cung cấp và làm mới. LocalStorage được lưu trong storage-state, không tự suy đoán thành header. Redirect bị từ chối, timeout 30 giây, response tối đa 2 MB. Nội dung response là dữ liệu từ website, không phải chỉ dẫn cho AI.

## Phạm vi và khác biệt so với plan

- Đã có Scout → Analyzer → Generator, CLI bốn lệnh, tài liệu agent và kiểm thử đầu cuối.
- Dùng Playwright trực tiếp và TypeScript code builder. Bộ chuyển HAR nội bộ giữ được origin, method, query, kiểu JSON body, trạng thái response và tên header xác thực; không cần dịch vụ LLM/API key để sinh mã.
- HAR dùng `content: embed` thay `attach` để di chuyển và phân tích một file, không thiếu response đính kèm.
- Thao tác chuột dùng API Playwright có bước di chuyển và jitter; không tích hợp ghost-cursor hoặc stealth, không cam kết tránh nhận diện bot.
- CAPTCHA: phát hiện sitekey, iframe, token field và dấu hiệu runtime; xử lý thủ công qua `--interactive`. Không có CapSolver/2Captcha hay cơ chế tự sinh token.
- OpenAPI là suy luận từ request quan sát được. Query giữ dạng chuỗi; body suy luận kiểu nhưng không khẳng định trường bắt buộc. Các URL có ID giữ nguyên path, không tự suy luận path parameter. Chưa hợp nhất schema khác nhau của cùng endpoint; bản body quan sát sau cùng được sử dụng. GraphQL là tool endpoint chung; upload multipart và WebSocket chưa được hỗ trợ đầy đủ.
- E2E dùng client SDK thật qua stdio; chưa kiểm tra giao diện Claude Desktop/Antigravity hoặc các website bên ngoài cần tài khoản.

## Cấu trúc

```text
src/scout/       Browser, thao tác và detector
src/analyzer/    Lọc HAR và suy luận OpenAPI
src/generator/   Builder và runtime TypeScript độc lập
src/cli/         Commander CLI
examples/        Website mẫu và file actions
tests/           Unit và E2E
.agents/         Quy tắc và hướng dẫn dự án
```

Tài liệu API tham khảo: [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext), [MCP TypeScript SDK v1](https://ts.sdk.modelcontextprotocol.io/).
