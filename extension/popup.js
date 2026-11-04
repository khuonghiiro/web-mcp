const status = document.querySelector('#status');
const start = document.querySelector('#start');
const stop = document.querySelector('#stop');
const bridgeStatus = document.querySelector('#bridge-status');
async function send(type, args = {}) {
  const result = await chrome.runtime.sendMessage({ type, ...args });
  if (!result?.ok) throw new Error(result?.error ?? 'Không liên lạc được với tiện ích.');
  return result;
}
async function refresh() {
  const state = await send('status');
  start.disabled = state.active;
  stop.disabled = !state.active && !state.hasCapture;
  document.querySelector('#connect').disabled = state.bridgeConnected;
  document.querySelector('#disconnect').disabled = !state.bridgeConnected;
  bridgeStatus.textContent = state.bridgeConnected ? 'Đã kết nối AI. AI có thể thao tác trên tab được chọn.' : state.bridgeError || 'Chưa kết nối AI. Dán mã mới từ studio_extension_pair.';
  if (state.bridgeConnected) { start.disabled = true; stop.disabled = true; }
  status.textContent = state.active ? `Đang ghi ${state.count} yêu cầu. Tab: ${state.host}` : state.notice || 'Sẵn sàng. Mở website cần thu thập rồi nhấn Bắt đầu.';
}
start.addEventListener('click', async () => {
  start.disabled = true;
  try { await send('start'); await refresh(); }
  catch (error) { status.textContent = 'Lỗi: ' + error.message; start.disabled = false; }
});
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
      await chrome.downloads.download({ url, filename, saveAs: true });
      status.textContent = 'Đã gửi file tới trình tải xuống. Mở run.bat, chọn 7 để nhập file .web-mcp.json vừa lưu.';
    } finally { setTimeout(() => URL.revokeObjectURL(url), 60000); }
    start.disabled = false;
    stop.disabled = false;
  } catch (error) { status.textContent = 'Lỗi: ' + error.message; start.disabled = false; stop.disabled = false; }
});
refresh().catch(error => { status.textContent = 'Lỗi: ' + error.message; });
