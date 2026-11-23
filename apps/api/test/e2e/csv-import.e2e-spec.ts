import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { csvPreviewSchema, importJobSchema, netWorthSchema } from '@finance/shared';
import { expect, it } from 'vitest';
import { account, institution } from '../../src/database/schema.js';
import { ownerApp } from '../helpers/owner-app.js';

it('previews, confirms, deduplicates and reuses custom mappings through HTTP', async () => {
  const { app, db, cookies } = await ownerApp();
  try {
    const provider = db.insert(institution).values({ name: 'Synthetic bank' }).returning().get();
    const target = db
      .insert(account)
      .values({ name: 'Demo', institutionId: provider.id, type: 'checking' })
      .returning()
      .get();
    /** Submit a synthetic multipart fixture using the real Fastify parser. */
    async function upload(name: string) {
      const file = readFileSync(join(__dirname, '../fixtures/csv', name), 'utf8');
      const payload = `--test-boundary\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/csv\r\n\r\n${file}\r\n--test-boundary--\r\n`;
      const result = await app.inject({
        url: '/api/import/csv',
        method: 'POST',
        cookies,
        payload,
        headers: { 'content-type': 'multipart/form-data; boundary=test-boundary' },
      });
      expect(result.statusCode).toBe(201);
      return csvPreviewSchema.parse(result.json());
    }
    /** Apply a preview to the disposable checking account. */
    async function confirm(id: string, options: Record<string, unknown> = {}) {
      const result = await app.inject({
        url: `/api/import/csv/${id}/confirm`,
        method: 'POST',
        cookies,
        payload: { accountId: target.id, ...options },
      });
      expect(result.statusCode).toBe(200);
      return importJobSchema.parse(result.json());
    }
    const preview = await upload('sparkasse-camt-v8.csv');
    expect(preview).toMatchObject({ detectedFormat: 'sparkasse-camt-v8', needsMapping: false });
    expect(await confirm(preview.jobId)).toMatchObject({ status: 'succeeded', imported: 2 });
    expect(await confirm((await upload('sparkasse-camt-v8.csv')).jobId)).toMatchObject({ imported: 0, skipped: 2 });
    expect(await confirm((await upload('malformed.csv')).jobId)).toMatchObject({ status: 'partial', failed: 2 });
    const generic = await upload('unknown-layout.csv');
    expect(generic.needsMapping).toBe(true);
    expect(
      await confirm(generic.jobId, {
        mapping: { columns: { date: 0, amount: 1, counterparty: 2, purpose: 3 } },
        saveMappingAs: 'Demo map',
      }),
    ).toMatchObject({ status: 'succeeded', imported: 2 });
    const saved = await upload('unknown-layout.csv');
    expect(saved).toMatchObject({ detectedFormat: 'generic', accountId: target.id, needsMapping: false });
    expect(await confirm(saved.jobId)).toMatchObject({ imported: 0, skipped: 2 });
    const totals = await app.inject({ url: '/api/overview/net-worth', cookies });
    expect(netWorthSchema.parse(totals.json()).totalCents).toBe(112225);
    expect((await app.inject({ url: `/api/import/jobs/${saved.jobId}` })).statusCode).toBe(401);
    const docs = (await app.inject({ url: '/api/docs-json' })).json();
    expect(docs.paths['/api/import/csv'].post.requestBody.content['multipart/form-data']).toBeDefined();
  } finally {
    await app.close();
  }
});
