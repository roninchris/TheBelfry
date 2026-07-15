import { getTool } from '../src/lib/tools/registry';

const tests = [
  { id: 'a1z26', input: 'TEST' },
  { id: 'affine', input: 'TEST', opts: { a: 5, b: 8 } },
  { id: 'railfence', input: 'TEST MESSAGE', opts: { rails: 3 } },
  { id: 'bacon', input: 'TEST' },
  { id: 'polybius', input: 'TEST' },
  { id: 'rot47', input: 'Hello, World!' },
  { id: 'base32', input: 'TEST MESSAGE 123' }
];

for (const t of tests) {
  const tool = getTool(t.id);
  if (!tool) {
    console.error(`Tool not found: ${t.id}`);
    continue;
  }
  try {
    const encoded = tool.encode(t.input, t.opts);
    const enText = typeof encoded === 'string' ? encoded : (encoded && (encoded as any).text) || String(encoded);
    const decoded = tool.decode(enText, t.opts);
    const deText = typeof decoded === 'string' ? decoded : (decoded && (decoded as any).text) || String(decoded);
    console.log(`[${t.id}] encoded: ${enText}`);
    console.log(`[${t.id}] decoded: ${deText}`);
  } catch (e:any) {
    console.error(`Error testing ${t.id}:`, e && e.message ? e.message : e);
  }
}
