import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const cli = resolve(root, 'src/cli/index.ts');
function defaultBrowser() {
  if (existsSync(chromium.executablePath())) return '';
  for (const [channel, suffix] of [['chrome', 'Google/Chrome/Application/chrome.exe'], ['msedge', 'Microsoft/Edge/Application/msedge.exe']]) {
    if (['PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'].some(key => process.env[key] && existsSync(resolve(process.env[key], suffix)))) return channel;
  }
  return '';
}
function execute(file, args = []) {
  return new Promise((resolveExit) => {
    // Pass arguments directly to Node, never through a command shell.
    const child = spawn(process.execPath, ['--import', 'tsx', file, ...args], { cwd: root, stdio: 'inherit' });
    child.on('error', error => { console.error(error.message); resolveExit(1); });
    child.on('exit', code => resolveExit(code ?? 1));
  });
}
async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Cần Node.js 22 trở lên. Vui lòng chạy setup.bat.');
  if (!existsSync(resolve(root, 'node_modules/tsx/package.json'))) throw new Error('Chưa cài đủ thư viện. Vui lòng chạy setup.bat.');
  const args = process.argv.slice(2);
  if (args.length) return execute(cli, args);
  while (true) {
    console.log('\n=== Web-to-MCP Studio ===\n1. Tự động: thu thập → phân tích → tạo MCP\n2. Thu thập dữ liệu website\n3. Phân tích dữ liệu đã thu thập\n4. Tạo MCP từ dữ liệu đã phân tích\n5. Chạy website mẫu\n6. Xem hướng dẫn sử dụng\n7. Nhập dữ liệu từ tiện ích trình duyệt\n8. Hướng dẫn cài tiện ích Chrome / Edge\n0. Thoát');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let file = cli;
    let parameters = [];
    try {
      const choice = (await rl.question('Chọn chức năng [0-8]: ')).trim();
      if (choice === '0') return 0;
      if (choice === '8') {
        console.log(`\nTIỆN ÍCH ĐÃ CÓ TRONG SOURCE\nThư mục: ${resolve(root, 'extension')}\n1. Mở chrome://extensions hoặc edge://extensions.\n2. Bật Chế độ dành cho nhà phát triển (Developer mode).\n3. Chọn Tải tiện ích đã giải nén (Load unpacked), chọn đúng thư mục extension ở trên.\n4. Mở tab đã đăng nhập, bấm tiện ích → Bắt đầu ghi tab này.\n5. Tải lại trang / thao tác, rồi bấm Dừng và tải file dữ liệu.\n6. Chọn mục 7 tại đây để nhập file, rồi mục 3 và 4.\nKhông cần bật gỡ lỗi từ xa khi dùng tiện ích. Xem extension/README.md.`);
        continue;
      } else if (choice === '7') {
        const name = (await rl.question('Tên dự án mới (chữ thường không dấu, số, - hoặc _): ')).trim();
        if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)) { console.error('Tên dự án không hợp lệ.'); continue; }
        const path = (await rl.question('Đường dẫn file .web-mcp.json (có thể kéo file vào cửa sổ này): ')).trim().replace(/^"(.*)"$/, '$1');
        parameters = ['import', '--name', name, '--file', path];
      } else if (choice === '5') {
        console.log('Website mẫu chạy tại http://127.0.0.1:4173. Mở thêm run.bat để thu thập dữ liệu. Nhấn Ctrl+C để dừng website mẫu.');
        file = resolve(root, 'examples/demo.ts');
      } else if (choice === '6') {
        console.log('\nHƯỚNG DẪN SỬ DỤNG\n• Chọn 1 để chạy toàn bộ quy trình, hoặc chọn 2, 3, 4 để chạy từng bước.\n• Nhập tên dự án và địa chỉ website. Nhấn Enter để dùng trình duyệt được gợi ý.\n• Trong trình duyệt, đăng nhập và thực hiện các thao tác cần thu thập.\n• Quay lại cửa sổ này, nhấn Enter để lưu và tiếp tục.\n• Dữ liệu lưu tại artifacts/<tên-dự-án>; mã MCP lưu tại generated-mcps/<tên-dự-án>.\n• Khi thu thập phiên mới, dùng tên dự án mới để tránh ghi đè.\n• Xem README.md để biết cách cài và kết nối MCP vừa tạo.');
        continue;
      }
      else {
        const command = { 1: 'auto', 2: 'scout', 3: 'analyze', 4: 'generate' }[choice];
        if (!command) { console.error('Vui lòng chọn một số từ 0 đến 8.'); continue; }
        const name = (await rl.question('Tên dự án (chữ thường không dấu, số, dấu - hoặc _): ')).trim();
        if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)) { console.error('Tên dự án cần 1–64 ký tự, bắt đầu bằng chữ thường không dấu hoặc số.'); continue; }
        parameters = [command, '--name', name];
        if (command === 'auto' || command === 'scout') {
          const url = (await rl.question('Địa chỉ website (http:// hoặc https://): ')).trim();
          try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(); }
          catch { console.error('Vui lòng nhập địa chỉ HTTP(S) hợp lệ, không chứa tên đăng nhập hoặc mật khẩu.'); continue; }
          parameters.push('--url', url, '--interactive');
          const mode = (await rl.question('Kết nối: 1 = Chrome đang mở (mặc định), 2 = Edge đang mở, 3 = phiên mới, 4 = địa chỉ CDP: ')).trim() || '1';
          if (mode === '1' || mode === '2') {
            parameters.push('--cdp', mode === '1' ? 'chrome' : 'msedge');
            console.log(`Bật cho phép gỡ lỗi tại ${mode === '1' ? 'chrome' : 'edge'}://inspect/#remote-debugging và chấp nhận hộp thoại kết nối. Nếu phiên bản không hỗ trợ, dùng tiện ích (mục 8).`);
          } else if (mode === '4') {
            parameters.push('--cdp', (await rl.question('Địa chỉ CDP (ví dụ http://127.0.0.1:9222): ')).trim());
          } else if (mode === '3') {
            const preferred = defaultBrowser();
            const channel = (await rl.question(`Trình duyệt: Enter = ${preferred || 'Chromium'}, hoặc nhập chrome / msedge: `)).trim() || preferred;
            if (channel && !['chrome', 'msedge'].includes(channel)) { console.error('Trình duyệt không hợp lệ.'); continue; }
            if (channel) parameters.push('--channel', channel);
          } else { console.error('Chọn chế độ từ 1 đến 4.'); continue; }
          console.log('Duyệt website / đăng nhập, sau đó quay lại cửa sổ này và nhấn Enter để lưu.');
        }
        if (command === 'auto' || command === 'analyze') {
          const origin = (await rl.question('Địa chỉ máy chủ API riêng (nhấn Enter nếu cùng địa chỉ website): ')).trim();
          if (origin) parameters.push('--origin', origin);
        }
      }
    } finally { rl.close(); }
    const code = await execute(file, parameters);
    if (code) console.error(`Thao tác thất bại (mã lỗi ${code}). Vui lòng xem thông báo phía trên.`);
  }
}
main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
