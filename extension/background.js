import { pageAction } from './remote.js';
import { parsePairingUrl } from './pairing.js';
let session;
let lastCapture;
let notice = '';
let busy = false;
let bridge;
let bridgeError = '';
const pairs = headers => Object.entries(headers ?? {}).map(([name, value]) => ({ name, value: String(value) }));
const command = (tabId, method, params = {}) => chrome.debugger.sendCommand({ tabId }, method, params);

async function evaluateAction(type, args = {}) {
  if (!session) throw new Error('Tab chưa được kết nối hoặc debugger đã bị ngắt.');
  const result = await command(session.tabId, 'Runtime.evaluate', { expression: '(' + pageAction.toString() + ')(' + JSON.stringify(type) + ',' + JSON.stringify(args) + ')', returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'Không thực hiện được thao tác DOM.');
  return result.result.value;
}
async function remoteAction(type, args) {
  if (!session) throw new Error('Phiên tab đã kết thúc. Kết nối lại tiện ích.');
  if (type === 'capture') return stopCapture();
  if (type === 'har') return { log: { entries: session.entries } };
  if (type === 'runtime') return { ...await evaluateAction('runtime'), errors: session.errors };
  if (type === 'network') return session.entries.map(e => { const u = new URL(e.request.url); return { method: e.request.method, origin: u.origin, path: u.pathname, status: e.response.status }; });
  if (type === 'inspect' || type === 'extract') return evaluateAction(type, args);
  if (type !== 'step') throw new Error('Lệnh cầu nối không hợp lệ.');
  const step = args.step;
  if (step.type !== 'navigate') {
    const currentPage = await evaluateAction('runtime');
    if (new URL(currentPage.url).origin !== new URL(session.targetUrl).origin) throw new Error('Tab đã chuyển website khác. Quay lại website đã ghép nối trước khi thao tác.');
  }
  if (step.type === 'navigate') {
    if (new URL(step.url).origin !== new URL(session.targetUrl).origin) throw new Error('Chỉ điều hướng trong website đã ghép nối.');
    const result = await command(session.tabId, 'Page.navigate', { url: step.url });
    if (result.errorText) throw new Error(result.errorText);
    await new Promise(resolve => setTimeout(resolve, 700));
  } else if (step.type === 'click') {
    const { x, y } = await evaluateAction('click', step);
    await command(session.tabId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.max(0, Math.round(x - 18)), y: Math.max(0, Math.round(y - 12)) });
    await new Promise(resolve => setTimeout(resolve, 45));
    await command(session.tabId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(x), y: Math.round(y) });
    await new Promise(resolve => setTimeout(resolve, 60));
    await command(session.tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
    await new Promise(resolve => setTimeout(resolve, 55));
    await command(session.tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
  } else if (step.type === 'press') {
    const keys = { Enter: 13, Tab: 9, Escape: 27, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Backspace: 8 };
    if (!keys[step.key]) throw new Error('Phím chưa hỗ trợ qua tiện ích: ' + step.key);
    await evaluateAction('press', step);
    await command(session.tabId, 'Input.dispatchKeyEvent', { type: 'keyDown', key: step.key, windowsVirtualKeyCode: keys[step.key] });
    await command(session.tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', key: step.key, windowsVirtualKeyCode: keys[step.key] });
  } else if (step.type === 'wait') {
    const deadline = Date.now() + 15000;
    while (!await evaluateAction('wait', step)) { if (Date.now() > deadline) throw new Error('Hết thời gian chờ selector.'); await new Promise(resolve => setTimeout(resolve, 200)); }
  } else if (step.type === 'fill') {
    const result = await evaluateAction('fill', { ...step, value: args.value });
    if (result?.insertText) await command(session.tabId, 'Input.insertText', { text: args.value });
  }
  else if (step.type === 'scroll') await evaluateAction('scroll', step);
  else throw new Error('Bước không được hỗ trợ.');
  await new Promise(resolve => setTimeout(resolve, 350));
  return evaluateAction('inspect');
}
async function bridgeFetch(connection, path, body) {
  const response = await fetch(connection.base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + connection.token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error('Cầu nối từ chối kết nối (HTTP ' + response.status + '). Kiểm tra mã ghép nối.');
  return response.json();
}
async function pairBridge(pairingUrl, selectedTab) {
  if (bridge) throw new Error('Đã kết nối AI. Hãy ngắt kết nối cũ trước.');
  if (!pairingUrl?.trim()) {
    let response;
    try {
      response = await fetch('http://127.0.0.1:43119/pairing', {
        headers: { 'X-Studio-Extension': chrome.runtime.id }, signal: AbortSignal.timeout(3000), cache: 'no-store'
      });
    } catch { throw new Error('Chưa tìm thấy MCP Studio đang chạy. Mở project trong AI client và bật server web_to_mcp_studio, rồi thử lại.'); }
    if (response.status === 409) throw new Error('MCP Studio đã kết nối với một tab khác. Ngắt kết nối tab đó trước, hoặc dùng mã thủ công của phiên AI cần kết nối.');
    if (!response.ok) throw new Error('Không tìm được cầu nối tự động hợp lệ. Dùng mã thủ công từ studio_extension_pair.');
    pairingUrl = (await response.json()).pairingUrl;
  }
  const url = parsePairingUrl(pairingUrl);
  const startedHere = !session;
  if (!session) await startCapture(selectedTab);
  const connection = { base: url.origin, token: url.hash.slice(1) };
  try { await bridgeFetch(connection, '/hello', { url: session.targetUrl }); }
  catch (error) {
    if (startedHere && session) { const id = session.tabId; session = undefined; await chrome.debugger.detach({ tabId: id }).catch(() => {}); }
    bridgeError = 'Không kết nối được AI. Kiểm tra MCP Studio đang chạy rồi thử lại. ' + error.message; throw new Error(bridgeError);
  }
  bridge = connection; bridgeError = '';
  void pollBridge(connection);
}
async function pollBridge(connection) {
  try {
    while (bridge === connection) {
      const message = await bridgeFetch(connection, '/next');
      if (bridge !== connection) break;
      if (message.type === 'ping') continue;
      if (message.type === 'disconnect') break;
      let result;
      if (busy) result = { id: message.id, ok: false, error: 'Tiện ích đang xử lý thao tác khác.' };
      else {
        busy = true;
        try { result = { id: message.id, ok: true, result: await remoteAction(message.type, message.args) }; }
        catch (error) { result = { id: message.id, ok: false, error: error.message }; }
        finally { busy = false; }
      }
      await bridgeFetch(connection, '/result', result);
    }
  } catch (error) { bridgeError = 'Mất kết nối AI: ' + error.message + '. Ghép nối lại bằng mã mới từ AI.'; }
  finally { if (bridge === connection) { bridge = undefined; if (session) { const id = session.tabId; session = undefined; await chrome.debugger.detach({ tabId: id }).catch(() => {}); } } }
}
async function disconnectBridge() {
  const connection = bridge; bridge = undefined;
  if (connection) await bridgeFetch(connection, '/disconnect', {}).catch(() => {});
  if (session) { const id = session.tabId; session = undefined; await chrome.debugger.detach({ tabId: id }).catch(() => {}); }
}

async function startCapture(selectedTab) {
  if (session) throw new Error('Đang ghi một tab khác. Hãy dừng phiên hiện tại trước.');
  const tab = selectedTab ? await chrome.tabs.get(selectedTab.tabId) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  const tabUrl = tab?.url ?? (await chrome.debugger.getTargets()).find(target => target.tabId === tab?.id)?.url;
  if (!tab?.id || !/^https?:\/\//.test(tabUrl ?? '')) throw new Error('Chỉ thu thập tab website HTTP(S), không thu thập trang cài đặt trình duyệt.');
  if (selectedTab && new URL(tabUrl).origin !== selectedTab.origin) throw new Error('Tab đã chuyển sang website khác. Bật lại tự kết nối trên website muốn cho AI điều khiển.');
  const next = { tabId: tab.id, targetUrl: tabUrl, requests: new Map(), entries: [], pending: new Set(), warnings: [], errors: [], bytes: 0, stopping: false };
  await chrome.debugger.attach({ tabId: tab.id }, '1.3');
  session = next;
  try { await command(tab.id, 'Network.enable', { maxTotalBufferSize: 20_000_000, maxResourceBufferSize: 2_000_000 }); await command(tab.id, 'Runtime.enable'); }
  catch (error) { session = undefined; await chrome.debugger.detach({ tabId: tab.id }); throw error; }
  lastCapture = undefined;
  notice = '';
  await chrome.action.setBadgeText({ text: 'REC' });
  await chrome.action.setBadgeBackgroundColor({ color: '#b91c1c' });
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  const current = session;
  if (!current || source.tabId !== current.tabId || current.stopping) return;
  if (method === 'Runtime.exceptionThrown' && current.errors.length < 100) current.errors.push(params.exceptionDetails.exception?.description || params.exceptionDetails.text);
  if (method === 'Network.requestWillBeSent') {
    if (!/^https?:\/\//.test(params.request.url)) return;
    if (params.documentURL && /^https?:/.test(params.documentURL) && new URL(params.documentURL).origin !== new URL(current.targetUrl).origin) return;
    if (current.entries.length + current.requests.size + current.pending.size >= 500) { current.warnings.push('Đạt giới hạn 500 yêu cầu; hãy chia thành nhiều phiên ghi.'); return; }
    current.requests.set(params.requestId, { request: params.request, startedDateTime: new Date(params.wallTime * 1000).toISOString() });
  } else if (method === 'Network.responseReceived') {
    const item = current.requests.get(params.requestId);
    if (item) item.response = params.response;
  } else if (method === 'Network.loadingFailed') {
    current.requests.delete(params.requestId);
  } else if (method === 'Network.loadingFinished') {
    const item = current.requests.get(params.requestId);
    current.requests.delete(params.requestId);
    if (!item?.response) return;
    const task = finishEntry(current, params.requestId, item, params.encodedDataLength).catch(() => { current.warnings.push('Không ghi được một yêu cầu.'); }).finally(() => current.pending.delete(task));
    current.pending.add(task);
  }
});

async function finishEntry(current, requestId, item, size) {
  const request = item.request;
  const response = item.response;
  const entry = {
    startedDateTime: item.startedDateTime, time: 0,
    request: { url: request.url, method: request.method, headers: pairs(request.headers), queryString: [...new URL(request.url).searchParams].map(([name, value]) => ({ name, value })), ...(request.postData ? { postData: { mimeType: Object.entries(request.headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1] || 'text/plain', text: request.postData } } : {}) },
    response: { status: response.status, headers: pairs(response.headers), content: { mimeType: response.mimeType || '' } }
  };
  if (/json|text|javascript|xml/i.test(response.mimeType) && size <= 2_000_000 && current.bytes < 10_000_000) {
    try {
      const body = await command(current.tabId, 'Network.getResponseBody', { requestId });
      if (body.body.length <= 2_000_000) {
        entry.response.content.text = body.body;
        if (body.base64Encoded) entry.response.content.encoding = 'base64';
      }
    } catch { current.warnings.push('Một số response body không còn trong bộ đệm của trình duyệt.'); }
  }
  const bytes = new TextEncoder().encode(JSON.stringify(entry)).length;
  if (current.bytes + bytes > 15_000_000) { current.warnings.push('Đạt giới hạn 15 MB traffic; một số yêu cầu đã bị bỏ qua.'); return; }
  current.bytes += bytes;
  current.entries.push(entry);
}

function snapshotPage() {
  return {
    url: location.href, origin: location.origin, dom: document.documentElement.outerHTML.slice(0, 5_000_000),
    localStorage: Object.keys(localStorage).map(name => ({ name, value: localStorage.getItem(name) ?? '' })),
    auth: {
      url: location.origin + location.pathname,
      sitekeys: [...document.querySelectorAll('[data-sitekey]')].map(el => ({ sitekey: el.getAttribute('data-sitekey'), kind: el.classList.contains('cf-turnstile') ? 'turnstile' : 'recaptcha-or-other' })),
      tokenFields: [...document.querySelectorAll('input,textarea,meta')].map(el => el.getAttribute('name') || '').filter(name => /csrf|xsrf|recaptcha|turnstile/i.test(name)),
      runtime: { recaptcha: 'grecaptcha' in window, turnstile: 'turnstile' in window }
    }
  };
}

async function stopCapture() {
  const current = session;
  if (!current) { if (lastCapture) return lastCapture; throw new Error('Chưa có phiên ghi để xuất.'); }
  current.stopping = true;
  try {
    await Promise.all(current.pending);
    const result = await command(current.tabId, 'Runtime.evaluate', { expression: '(' + snapshotPage.toString() + ')()', returnByValue: true });
    if (result.exceptionDetails || !result.result?.value) throw new Error('Không đọc được trang. Hãy thử lại khi trang tải xong.');
    const snapshot = result.result.value;
    const target = new URL(current.targetUrl);
    if (snapshot.origin !== target.origin) throw new Error('Tab đã chuyển sang website khác. Quay về website ban đầu rồi nhấn Dừng để xuất.');
    const { cookies } = await command(current.tabId, 'Network.getCookies', { urls: [current.targetUrl, snapshot.url] });
    lastCapture = {
      format: 'web-to-mcp-capture-v1', targetUrl: current.targetUrl, capturedAt: new Date().toISOString(),
      har: { log: { version: '1.2', creator: { name: 'Web-to-MCP Extension', version: '0.1.0' }, entries: current.entries } },
      dom: snapshot.dom, auth: snapshot.auth,
      authState: { cookies: cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path, expires: c.expires, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite ?? 'Lax' })), origins: [{ origin: snapshot.origin, localStorage: snapshot.localStorage }] },
      warnings: [...new Set([...current.warnings, 'Chỉ ghi yêu cầu hoàn tất sau khi bắt đầu. Không ghi WebSocket, worker riêng hoặc tab khác. Redirect có thể thiếu bước trung gian. Cookie chỉ xuất cho URL đang ghi.'])]
    };
    // Detach the debugger only. Never close or navigate the user's tab.
    session = undefined;
    await chrome.debugger.detach({ tabId: current.tabId });
    await chrome.action.setBadgeText({ text: '' });
    return lastCapture;
  } catch (error) { if (session) session.stopping = false; throw error; }
}

async function stopAuto() {
  await chrome.storage.session.remove('autoTarget');
  await chrome.alarms.clear('studio-auto');
}
async function tryAutoConnect() {
  if (busy || bridge || session) return;
  busy = true;
  try {
    const { autoTarget } = await chrome.storage.session.get('autoTarget');
    if (!autoTarget) return;
    const tab = await chrome.tabs.get(autoTarget.tabId).catch(() => null);
    if (!tab) { await stopAuto(); return; }
    await pairBridge('', autoTarget);
  } catch (error) { bridgeError = 'Đang chờ AI: ' + error.message; }
  finally { busy = false; }
}
async function armAuto() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? (await chrome.debugger.getTargets()).find(t => t.tabId === tab?.id)?.url;
  if (!tab?.id || !/^https?:\/\//.test(url ?? '')) throw new Error('Mở tab website muốn AI điều khiển trước.');
  if (bridge || session) await disconnectBridge();
  await chrome.storage.session.set({ autoTarget: { tabId: tab.id, origin: new URL(url).origin } });
  await chrome.alarms.create('studio-auto', { periodInMinutes: 0.5 });
}
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'studio-auto') void tryAutoConnect(); });
chrome.tabs.onRemoved.addListener(tabId => {
  void chrome.storage.session.get('autoTarget').then(({ autoTarget }) => { if (autoTarget?.tabId === tabId) return stopAuto(); });
});
chrome.debugger.onDetach.addListener(source => {
  if (session?.tabId === source.tabId) void stopAuto(); // Respect the user's Stop debugging button.
  if (session?.tabId === source.tabId) { session = undefined; notice = 'Phiên ghi bị ngắt (tab đóng, DevTools mở hoặc bạn dừng gỡ lỗi). Hãy bắt đầu phiên mới.'; }
  chrome.action.setBadgeText({ text: '' });
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return false;
  (async () => {
    if (message.type === 'status') return { active: !!session, count: session?.entries.length ?? 0, host: session ? new URL(session.targetUrl).host : '', hasCapture: !!lastCapture, notice, bridgeConnected: !!bridge, bridgeError, autoTarget: (await chrome.storage.session.get('autoTarget')).autoTarget ?? null };
    if (message.type === 'disconnect' || (message.type === 'auto' && !message.enabled)) {
      const deadline = Date.now() + 5000;
      while (busy && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (busy) throw new Error('Đang xử lý, vui lòng chờ.');
    busy = true;
    try {
      if (message.type === 'start') { await startCapture(); return {}; }
      if (message.type === 'pair') { await pairBridge(message.pairingUrl); return {}; }
      if (message.type === 'auto') { if (message.enabled) await armAuto(); else { await stopAuto(); await disconnectBridge(); } return {}; }
      if (message.type === 'disconnect') { await stopAuto(); await disconnectBridge(); return {}; }
      if (message.type === 'stop') return { capture: await stopCapture() };
      throw new Error('Yêu cầu không hợp lệ.');
    } finally { busy = false; if (message.type === 'auto' && message.enabled) void tryAutoConnect(); }
  })().then(data => reply({ ok: true, ...data })).catch(error => reply({ ok: false, error: error.message }));
  return true;
});
