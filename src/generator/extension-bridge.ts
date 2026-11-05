import { createServer, type Server, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';

/** Local, explicitly paired command bridge. No website-facing unauthenticated API. */
export class ExtensionBridge {
  private server?: Server;
  private token = randomBytes(32).toString('hex');
  private poll?: ServerResponse;
  private queue: unknown[] = [];
  private pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private lastSeen = 0;
  private pairingUrl = '';
  tabUrl = '';
  get connected() { return !!this.tabUrl && Date.now() - this.lastSeen < 45000; }
  async start(autoDiscover = false) {
    if (this.server) return { pairingUrl: this.pairingUrl, connected: this.connected, tabUrl: this.tabUrl };
    this.server = createServer((req, res) => {
      const auth = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
      const origin = req.headers.origin;
      // Extension fetch has host permission; websites cannot supply this custom
      // header without a preflight, which this server never authorizes.
      if (autoDiscover && req.method === 'GET' && req.url === '/pairing') {
        const extension = req.headers['x-studio-extension'];
        if (typeof extension !== 'string' || !/^[a-p]{32}$/.test(extension) ||
            (origin && origin !== `chrome-extension://${extension}`) ||
            req.headers.host !== '127.0.0.1:43119') {
          res.writeHead(403).end(); return;
        }
        if (this.connected) { res.writeHead(409).end(); return; }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
          .end(JSON.stringify({ pairingUrl: this.pairingUrl }));
        return;
      }
      if ((origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) || !/^[a-f0-9]{64}$/.test(auth) || !timingSafeEqual(Buffer.from(auth), Buffer.from(this.token))) {
        res.writeHead(403).end(); return;
      }
      const send = (data: unknown, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(data)); };
      if (req.method === 'GET' && req.url === '/next') {
        this.lastSeen = Date.now();
        if (this.poll) { send({ error: 'Đã có kết nối tiện ích.' }, 409); return; }
        if (this.queue.length) { send(this.queue.shift()); return; }
        this.poll = res;
        const timer = setTimeout(() => { if (this.poll === res) { this.poll = undefined; send({ type: 'ping' }); } }, 15000);
        res.on('close', () => { clearTimeout(timer); if (this.poll === res) this.poll = undefined; });
        return;
      }
      if (req.method !== 'POST' || !['/hello', '/result', '/disconnect'].includes(req.url ?? '')) { send({ error: 'Not found' }, 404); return; }
      let bytes = 0; const chunks: Buffer[] = [];
      req.on('error', () => {});
      req.on('data', chunk => { bytes += chunk.length; if (bytes > 50_000_000) req.destroy(); else chunks.push(chunk); });
      req.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (req.url === '/hello') {
            if (this.connected) { send({ error: 'Một tab khác đã ghép nối. Ngắt kết nối trước.' }, 409); return; }
            const url = new URL(body.url);
            if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL không hợp lệ');
            this.tabUrl = url.href; this.lastSeen = Date.now();
          } else if (req.url === '/result') {
            const pending = this.pending.get(body.id);
            if (pending) { clearTimeout(pending.timer); this.pending.delete(body.id); body.ok ? pending.resolve(body.result) : pending.reject(new Error(String(body.error))); }
            this.lastSeen = Date.now();
          } else {
            this.tabUrl = ''; this.lastSeen = 0; this.failPending();
            this.poll?.end(JSON.stringify({ type: 'disconnect' })); this.poll = undefined;
          }
          send({ ok: true });
        } catch { send({ error: 'Dữ liệu không hợp lệ' }, 400); }
      });
    });
    const listen = (port: number) => new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => { this.server!.removeListener('listening', onListen); reject(error); };
      const onListen = () => { this.server!.removeListener('error', onError); resolve(); };
      this.server!.once('error', onError).once('listening', onListen).listen(port, '127.0.0.1');
    });
    try { await listen(autoDiscover ? 43119 : 0); }
    catch (error) {
      if (!autoDiscover || (error as NodeJS.ErrnoException).code !== 'EADDRINUSE') { this.server = undefined; throw error; }
      autoDiscover = false;
      await listen(0); // Another Studio owns discovery; manual pairing stays available.
    }
    const address = this.server.address();
    if (!address || typeof address === 'string') throw new Error('Không mở được cầu nối.');
    this.pairingUrl = `http://127.0.0.1:${address.port}/#${this.token}`;
    return { pairingUrl: this.pairingUrl, connected: false, instruction: 'Mở tiện ích trên tab website, dán pairingUrl vào ô Kết nối AI rồi bấm Kết nối. Giữ mã ghép nối riêng tư.' };
  }
  async rpc(type: string, args: unknown = {}): Promise<any> {
    if (!this.connected) throw new Error('Tiện ích chưa kết nối. Gọi studio_extension_pair và ghép nối trong popup.');
    return new Promise((resolve, reject) => {
      const id = randomBytes(12).toString('hex');
      const timer = setTimeout(() => { this.pending.delete(id); this.queue = this.queue.filter((item: any) => item.id !== id); reject(new Error('Tiện ích không phản hồi trong 30 giây. Kiểm tra tab và trạng thái kết nối trước khi thử lại.')); }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      const message = { id, type, args };
      if (this.poll) { const res = this.poll; this.poll = undefined; res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(message)); }
      else this.queue.push(message);
    });
  }
  private failPending() { for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Tiện ích đã ngắt kết nối.')); } this.pending.clear(); this.queue = []; }
  async close() {
    this.tabUrl = ''; this.failPending();
    this.poll?.end(JSON.stringify({ type: 'disconnect' })); this.poll = undefined;
    this.server?.closeAllConnections();
    await new Promise<void>(resolve => { if (this.server) this.server.close(() => resolve()); else resolve(); });
    this.server = undefined;
  }
}
