import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CppPreprocessor, newlineIsEscaped, preprocess } from './index';

/** ゴールデンファイルを読む。改行は LF に正規化する。 */
function fixture(name: string): string {
  const path = join(__dirname, '__fixtures__', name);
  return readFileSync(path, 'utf-8').replace(/\r\n/g, '\n');
}

describe('ゴールデンファイルとの一致', () => {
  it('test1: 関数マクロと #ifdef / #ifndef', () => {
    expect(preprocess(fixture('test1.txt'))).toBe(fixture('test1.expected'));
  });

  it('test2: 行継続を含む FOR_EACH_PHASE の展開', () => {
    expect(preprocess(fixture('test2.txt'))).toBe(fixture('test2.expected'));
  });
});

describe('#define', () => {
  it('引数なしマクロを展開する', () => {
    const out = preprocess('#define FOO 42\n[A] = FOO;');
    expect(out).toBe('\n[A] = 42;');
  });

  it('引数付きマクロを展開する', () => {
    const out = preprocess('#define double(x) [x] * 2\n[B] = double(A);');
    expect(out).toBe('\n[B] = [A] * 2;');
  });

  it('定義本体を省略すると 1 になる', () => {
    const out = preprocess('#define FLAG\n[A] = FLAG;');
    expect(out).toBe('\n[A] = 1;');
  });

  it('単語境界を守り、部分一致では展開しない', () => {
    const out = preprocess('#define A 1\n[AB] = A;');
    expect(out).toBe('\n[AB] = 1;');
  });

  it('複数引数を順に置き換える', () => {
    const out = preprocess('#define sum(a,b) [a] + [b]\n[T] = sum(X,Y);');
    expect(out).toBe('\n[T] = [X] + [Y];');
  });
});

describe('#undef', () => {
  it('定義を取り消すと展開されなくなる', () => {
    const out = preprocess('#define FOO 42\n#undef FOO\n[A] = FOO;');
    expect(out).toBe('\n\n[A] = FOO;');
  });
});

describe('#ifdef / #ifndef / #else / #endif', () => {
  it('定義済みなら #ifdef の中身を出力する', () => {
    const out = preprocess('#define X\n#ifdef X\n[A] = 1;\n#endif');
    expect(out).toBe('\n\n[A] = 1;\n');
  });

  it('未定義なら #ifdef の中身を抑止する', () => {
    const out = preprocess('#ifdef X\n[A] = 1;\n#endif');
    expect(out).toBe('\n\n');
  });

  it('#else で分岐する', () => {
    const out = preprocess('#ifdef X\n[A] = 1;\n#else\n[A] = 2;\n#endif');
    expect(out).toBe('\n\n\n[A] = 2;\n');
  });

  it('#ifndef は条件を反転する', () => {
    const out = preprocess('#ifndef X\n[A] = 1;\n#endif');
    expect(out).toBe('\n[A] = 1;\n');
  });

  it('入れ子の #ifdef で、外側が抑止中なら内側は解除できない', () => {
    const src = '#ifdef MISSING\n#define Y\n#ifdef Y\n[A] = 1;\n#endif\n#endif';
    expect(preprocess(src)).toBe('\n\n\n\n\n');
  });
});

describe('行数の保存', () => {
  it('ディレクティブ行は空行として残る', () => {
    const src = '#define A 1\n[B] = A;\n#undef A';
    expect(preprocess(src).split('\n')).toHaveLength(3);
  });

  it('行継続で連結しても総行数は変わらない', () => {
    const src = '#define M(x) \\\n  [x]\n[A] = M(Z);';
    const out = preprocess(src);
    expect(out.split('\n')).toHaveLength(3);
    expect(out).toBe('\n\n[A] = [Z];');
  });
});

describe('扱わないもの（上流の仕様）', () => {
  it('#include はそのまま残す', () => {
    const src = '#include <psp1.1/dataFile.txt>';
    expect(preprocess(src)).toBe(src);
  });

  it('コメントは除去しない', () => {
    const src = '/* comment */\n// line comment';
    expect(preprocess(src)).toBe(src);
  });
});

describe('newlineIsEscaped', () => {
  it('末尾のバックスラッシュが奇数個なら true', () => {
    expect(newlineIsEscaped('abc\\')).toBe(true);
    expect(newlineIsEscaped('abc\\\\\\')).toBe(true);
  });

  it('偶数個なら false', () => {
    expect(newlineIsEscaped('abc\\\\')).toBe(false);
  });

  it('バックスラッシュで終わらなければ false', () => {
    expect(newlineIsEscaped('abc')).toBe(false);
  });
});

describe('再帰展開の防止', () => {
  it('自己参照マクロで無限ループしない', () => {
    const out = new CppPreprocessor().process('#define A A + 1\n[X] = A;');
    expect(out).toBe('\n[X] = A + 1;');
  });
});
