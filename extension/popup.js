const status = document.querySelector('#status');
const start = document.querySelector('#start');
const stop = document.querySelector('#stop');
const bridgeStatus = document.querySelector('#bridge-status');
async function send(type, args = {}) {
  const result = await chrome.runtime.sendMessage({ type, ...args });
  if (!result?.ok) throw new Error(result?.error ?? 'Không liên lạc được với tiện ích.');
  return result;
}
function waitForDownload(id) {
  return new Promise((resolve, reject) => {
    const finish = (error) => { clearTimeout(timer); chrome.downloads.onChanged.removeListener(listener); error ? reject(error) : resolve(); };
    const check = async () => {
      try {
        const [item] = await chrome.downloads.search({ id });
        if (item?.state === 'complete') finish();
        else if (item?.state === 'interrupted') finish(new Error(item.error === 'FILE_NO_SPACE' ? 'Ổ đĩa lưu file hoặc thư mục tạm đã hết dung lượng. Giải phóng dung lượng rồi xuất lại.' : 'Tải file bị gián đoạn: ' + (item.error || 'không rõ nguyên nhân')));
      } catch (error) { finish(error); }
    };
    const listener = delta => { if (delta.id === id) void check(); };
    const timer = setTimeout(() => finish(new Error('File chưa tải xong. Kiểm tra mục Tải xuống của trình duyệt.')), 120000);
    chrome.downloads.onChanged.addListener(listener);
    void check();
  });
}
async function refresh() {
  const state = await send('status');
  document.querySelector('#auto-connect').checked = !!state.autoTarget;
  document.querySelector('#auto-status').textContent = state.autoTarget ? 'Tự kết nối đã bật cho ' + state.autoTarget.origin + '. Chỉ tab đã chọn được điều khiển.' : 'Bật một lần trên tab cần thao tác. Đóng tab hoặc trình duyệt sẽ kết thúc chế độ tự động.';
  start.disabled = state.active;
  stop.disabled = !state.active && !state.hasCapture;
  document.querySelector('#connect').disabled = state.bridgeConnected;
  document.querySelector('#disconnect').disabled = !state.bridgeConnected;
  bridgeStatus.textContent = state.bridgeConnected ? 'Đã kết nối AI. AI có thể thao tác trên tab được chọn.' : state.bridgeError || 'Bấm Kết nối AI để tự tìm MCP Studio trên máy.';
  if (state.bridgeConnected) { start.disabled = true; stop.disabled = true; }
  status.textContent = state.active ? `Đang ghi ${state.count} yêu cầu. Tab: ${state.host}` : state.notice || 'Sẵn sàng. Mở website cần thu thập rồi nhấn Bắt đầu.';
}
start.addEventListener('click', async () => {
  start.disabled = true;
  try { await send('start'); await refresh(); }
  catch (error) { status.textContent = 'Lỗi: ' + error.message; start.disabled = false; }
});
document.querySelector('#auto-connect').addEventListener('change', async event => {
  try { await send('auto', { enabled: event.target.checked }); await refresh(); }
  catch (error) { event.target.checked = false; bridgeStatus.textContent = error.message; }
});
setInterval(() => refresh().catch(() => {}), 2000);
document.querySelector('#connect').addEventListener('click', async () => {
  bridgeStatus.textContent = 'Đang kết nối…';
  try { await send('pair', { pairingUrl: document.querySelector('#pairing').value.trim() }); document.querySelector('#pairing').value = ''; await refresh(); }
  catch (error) { bridgeStatus.textContent = 'Lỗi: ' + error.message; }
});
document.querySelector('#disconnect').addEventListener('click', async () => {
  try { await send('disconnect'); await refresh(); } catch (error) { bridgeStatus.textContent = 'Lỗi: ' + error.message; }
});
stop.addEventListener('click', async () => {
  stop.disabled = true;
  status.textContent = 'Đang hoàn tất và xuất dữ liệu…';
  try {
    const { capture } = await send('stop');
    const blob = new Blob([JSON.stringify(capture, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const filename = new URL(capture.targetUrl).hostname.replace(/[^a-zA-Z0-9_-]/g, '-') + '-' + Date.now() + '.web-mcp.json';
      const id = await chrome.downloads.download({ url, filename, saveAs: true });
      status.textContent = 'Đang tải file. Giữ popup mở cho đến khi hoàn tất…';
      await waitForDownload(id);
      status.textContent = 'Đã tải file thành công. Mở run.bat, chọn 7 để nhập file .web-mcp.json vừa lưu.';
    } finally { URL.revokeObjectURL(url); }
    start.disabled = false;
    stop.disabled = false;
  } catch (error) { status.textContent = 'Lỗi: ' + error.message; start.disabled = false; stop.disabled = false; }
});
refresh().catch(error => { status.textContent = 'Lỗi: ' + error.message; });
