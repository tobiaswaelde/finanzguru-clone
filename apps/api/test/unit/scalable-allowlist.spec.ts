import { expect, it, vi } from 'vitest';
import { ForbiddenToolError } from '../../src/modules/sources/errors.js';
import { allowedTools, callReadTool } from '../../src/modules/sources/scalable-mcp/allowlist.js';

it('denies unverified, renamed, ambiguous and action-like tools before sending', async () => {
  const discovered = [
    { name: 'demo_portfolio', description: 'Show the portfolio' },
    { name: 'demo_cash', description: 'Read cash or place an order' },
    { name: 'demo_transactions', description: 'List bookings' },
    { name: 'demo_transactions', description: 'Another tool with the same name' },
    { name: 'demo_extra' },
  ];
  const allowed = allowedTools(discovered, {
    portfolio: 'demo_portfolio',
    cash: 'demo_cash',
    transactions: 'demo_transactions',
  });
  expect(allowedTools(discovered).size).toBe(0);
  const transport = vi.fn(async () => 'result');
  for (const name of ['demo_cash', 'demo_transactions', 'demo_extra', 'Demo_Portfolio']) {
    await expect(callReadTool(allowed, name, {}, transport)).rejects.toBeInstanceOf(ForbiddenToolError);
  }
  expect(transport).not.toHaveBeenCalled();
  await expect(callReadTool(allowed, 'demo_portfolio', {}, transport)).resolves.toBe('result');
  expect(transport).toHaveBeenCalledTimes(1);
});
