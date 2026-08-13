import { describe, expect, it } from 'vitest';
import type { PhaseType } from '../persistence';
import { PSP2 } from './definitions';
import { classifyPhase } from './phase-type';

describe('phase-type', () => {
  it('5. dldr を分類する: appraisal', () => {
    expect(classifyPhase('dldr')).toBe('appraisal');
  });

  it('6. cr を分類する: appraisal', () => {
    expect(classifyPhase('cr')).toBe('appraisal');
  });

  it('7. comp を分類する: failure', () => {
    expect(classifyPhase('comp')).toBe('failure');
  });

  it('8. ut を分類する: failure', () => {
    expect(classifyPhase('ut')).toBe('failure');
  });

  it('9. plan を分類する: overhead', () => {
    expect(classifyPhase('plan')).toBe('overhead');
  });

  it('10. code を分類する: development', () => {
    expect(classifyPhase('code')).toBe('development');
  });

  it('11. 大文字で渡す（DLDR）: appraisal。小文字化される', () => {
    // PhaseType は小文字の literal union だが、移植元と同じく大文字混入への
    // 耐性を確認する（PRT-B3 3章）。型上は起こらない入力なのでキャストする。
    expect(classifyPhase('DLDR' as PhaseType)).toBe('appraisal');
  });

  it('12. 未知の種別を渡す: other', () => {
    // PhaseType に存在しない値でも、4分類のどれにも属さなければ 'other' になる
    // ことを確認する（PhaseUtil は「その他」の集合を持たない。ana-b3.md 5章）。
    expect(classifyPhase('unknown' as PhaseType)).toBe('other');
  });

  it('13. 8フェーズすべてを分類する: 順に overhead, development, appraisal, development, appraisal, failure, failure, overhead', () => {
    expect(PSP2.phases.map((phase) => classifyPhase(phase.type))).toEqual([
      'overhead',
      'development',
      'appraisal',
      'development',
      'appraisal',
      'failure',
      'failure',
      'overhead',
    ]);
  });
});
