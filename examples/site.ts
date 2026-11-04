import { createServer } from 'node:http';
export function demoServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('content-type', 'application/json');
      if (url.pathname === '/api/search') res.end(JSON.stringify({ query: url.searchParams.get('q'), page: url.searchParams.get('page'), results: [{ id: 1, title: 'MCP Studio' }] }));
      else if (url.pathname === '/api/contact') { let body = ''; for await (const chunk of req) body += chunk; res.end(JSON.stringify({ received: JSON.parse(body || '{}') })); }
      else if (url.pathname === '/api/private') { res.statusCode = req.headers.cookie?.includes('demo=session') ? 200 : 401; res.end(JSON.stringify({ authenticated: res.statusCode === 200 })); }
      else res.end(JSON.stringify({ posts: [{ id: 1, title: 'Hello MCP' }] }));
      return;
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('set-cookie', 'demo=session; Path=/; HttpOnly; SameSite=Lax');
    res.end(`<!doctype html><html><head><title>Web-to-MCP demo</title></head><body><h1>Web-to-MCP Studio demo</h1><p>Local blog, search, contact and authenticated API fixture.</p><input id="search" value="MCP"><button id="go">Search</button><div class="g-recaptcha" data-sitekey="demo-public-sitekey"></div><textarea name="g-recaptcha-response" hidden></textarea><pre id="result"></pre><script>
    fetch('/api/posts'); fetch('/api/private');
    fetch('/api/contact', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'Hello',count:1})});
    document.querySelector('#go').onclick=async()=>document.querySelector('#result').textContent=JSON.stringify(await (await fetch('/api/search?q='+encodeURIComponent(document.querySelector('#search').value)+'&page=1')).json());
    document.querySelector('#go').click();
    </script></body></html>`);
  });
}
