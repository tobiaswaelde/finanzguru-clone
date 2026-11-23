import { expect, it } from 'vitest';
import { dataSource } from '../../src/database/schema.js';
import { ownerApp } from '../helpers/owner-app.js';

it('omits stored credentials and rejects an upload over 20 MiB without recording a job', async () => {
  const { app, cookies, db } = await ownerApp();
  try {
    db.insert(dataSource)
      .values({
        kind: 'scalable_mcp',
        status: 'disabled',
        displayName: 'Synthetic source',
        encryptedCredentials: Buffer.from('synthetic-grant-marker'),
        toolManifest: { marker: 'synthetic-manifest-marker' },
      })
      .run();
    const sources = await app.inject({ url: '/api/sources', cookies });
    expect(sources.statusCode).toBe(200);
    expect(sources.json().find((row: { displayName: string }) => row.displayName === 'Synthetic source')).toEqual({
      id: expect.any(String),
      kind: 'scalable_mcp',
      status: 'disabled',
      displayName: 'Synthetic source',
      lastSyncAt: null,
      lastError: null,
    });

    const payload = Buffer.concat([
      Buffer.from(
        '--fixture\r\nContent-Disposition: form-data; name="file"; filename="synthetic.csv"\r\nContent-Type: text/csv\r\n\r\n',
      ),
      Buffer.alloc(20 * 1024 * 1024 + 1, '0'),
      Buffer.from('\r\n--fixture--\r\n'),
    ]);
    const result = await app.inject({
      method: 'POST',
      url: '/api/import/csv',
      cookies,
      payload,
      headers: { 'content-type': 'multipart/form-data; boundary=fixture' },
    });
    expect(result.statusCode).toBe(413);
    expect(result.body).not.toContain('synthetic.csv');
  } finally {
    await app.close();
  }
});
