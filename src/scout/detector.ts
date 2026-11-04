import type { Page } from 'playwright';
export async function detectAuth(page: Page) {
  return page.evaluate(() => ({
    url: location.origin + location.pathname,
    sitekeys: Array.from(document.querySelectorAll('[data-sitekey]')).map(el => ({ sitekey: el.getAttribute('data-sitekey'), kind: el.classList.contains('cf-turnstile') ? 'turnstile' : 'recaptcha-or-other' })),
    challengeFrames: Array.from(document.querySelectorAll('iframe')).map(el => el.src).filter(src => /recaptcha|challenges.cloudflare.com/.test(src)).map(src => { const u = new URL(src); return { origin: u.origin, path: u.pathname, sitekey: u.searchParams.get('k') }; }),
    tokenFields: Array.from(document.querySelectorAll('input, textarea, meta')).map(el => el.getAttribute('name') || '').filter(name => /csrf|xsrf|recaptcha|turnstile/i.test(name)),
    runtime: { recaptcha: 'grecaptcha' in window, turnstile: 'turnstile' in window },
    note: 'Challenge presence is metadata only. Complete challenges interactively; tokens expire and are not generated automatically.'
  }));
}
