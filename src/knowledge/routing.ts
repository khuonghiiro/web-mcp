import { join } from 'node:path';
import { z } from 'zod';
import { readJson } from '../core.js';
import { exists } from '../storage/artifacts.js';
import { siteGuide } from './sites.js';

export const executionSchema = z.object({
  api: z.enum(['verified', 'observed', 'blocked', 'unknown']).default('unknown'),
  captcha: z.enum(['not-observed', 'required', 'unknown']).default('unknown'),
  browser: z.enum(['verified', 'observed', 'documented', 'unknown']).default('unknown'),
  effect: z.enum(['read', 'write']).default('read'),
  evidence: z.string().default('Execution mode not yet verified.')
});
export type Execution = z.infer<typeof executionSchema>;
export function chooseRoute(execution: Execution, prefer: 'auto' | 'api' | 'browser' = 'auto', signal: 'none' | 'auth-required' | 'verification-required' | 'ambiguous-write' = 'none') {
  if (signal === 'ambiguous-write') return { mode: 'browser', reason: 'Inspect previous write outcome on UI before retrying.', action: 'verify-before-retry' };
  if (prefer === 'browser') return { mode: 'browser', reason: 'User explicitly requested browser UI interaction.', action: 'inspect-and-act' };
  if (signal === 'auth-required') return { mode: 'browser', reason: 'Refresh local authentication via browser session before calling API.', action: 'refresh-auth' };
  if (signal === 'verification-required' || execution.captcha === 'required') return { mode: 'browser', reason: 'Website verification / reCAPTCHA required; use browser session instead of standalone API.', action: 'website-verification' };
  if (execution.api === 'verified' && execution.captcha === 'not-observed') return { mode: 'api', reason: 'Verified API with no observed CAPTCHA gate; run via local auth/cookies.', action: 'call-and-verify' };
  return { mode: 'browser', reason: 'API is unverified or blocked; use browser UI and capture evidence.', action: 'inspect-and-capture' };
}
export async function siteRoute(root: string, url: string, task: string, prefer: 'auto' | 'api' | 'browser' = 'auto', signal: 'none' | 'auth-required' | 'verification-required' | 'ambiguous-write' = 'none') {
  if (!/^[a-z][a-z0-9-]{0,50}$/.test(task)) throw new Error('Invalid task ID.');
  const guide = await siteGuide(root, url);
  if (!('namespace' in guide)) return { ...guide, mode: 'browser', reason: 'Website not registered yet; use web-scout.' };
  const file = join(root, '.agents/skills', guide.namespace + '-project/references/tasks.json');
  const tasks = await exists(file) ? z.array(z.object({ id: z.string(), execution: executionSchema.default({}) })).parse(await readJson(file)) : [];
  const definition = tasks.find(t => t.id === task);
  if (!definition) return { ...guide, mode: 'browser', reason: 'Task not yet reviewed; read browse skill and inspect page.', selectedSkill: `.agents/skills/${guide.namespace}-browse/SKILL.md` };
  const result = chooseRoute(definition.execution, prefer, signal);
  return { domain: guide.domain, namespace: guide.namespace, task, ...result, execution: definition.execution, selectedSkill: `.agents/skills/${guide.namespace}-${result.mode}-${task}/SKILL.md`, authSkill: `.agents/skills/${guide.namespace}-auth/SKILL.md` };
}
