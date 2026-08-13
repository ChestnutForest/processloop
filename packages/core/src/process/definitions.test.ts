import { describe, expect, it } from 'vitest';
import { PSP2, findDefinition, listDefinitions } from './definitions';

describe('definitions', () => {
  it('1. 定義の一覧を取る: PSP2 が1件返る', () => {
    const definitions = listDefinitions();
    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.id).toBe('PSP2');
  });

  it('2. ID で探す: PSP2 が返る', () => {
    expect(findDefinition('PSP2')).toEqual(PSP2);
  });

  it('3. 存在しない ID で探す: null が返る', () => {
    expect(findDefinition('PSP4')).toBeNull();
  });

  it('4. PSP2 のフェーズ数と順序: 8件が定義の順で返る', () => {
    expect(PSP2.phases.map((phase) => phase.name)).toEqual([
      'Planning',
      'Design',
      'Design Review',
      'Code',
      'Code Review',
      'Compile',
      'Test',
      'Postmortem',
    ]);
  });
});
