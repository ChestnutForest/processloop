import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_DATABASE_URL, clearTables } from '../persistence/test-support';

process.env.DATABASE_URL = TEST_DATABASE_URL;

import { disconnect, hierarchy } from '../persistence';
import * as node from './node';
import { PSP2_DEFINITION, assign, canAddChild, reassign } from './process';
import type { ProcessDefinition } from './types';

beforeEach(async () => {
  await clearTables();
});

afterAll(async () => {
  await disconnect();
});

describe('process', () => {
  it('20. プロセスを割り当てる: templateId が保存される', async () => {
    await node.addRoot('MyProject');

    const assigned = await assign('/MyProject', PSP2_DEFINITION);

    expect(assigned.templateId).toBe('PSP2');
  });

  it('21. フェーズが展開される: 定義の順に子が作られる', async () => {
    await node.addRoot('MyProject');

    await assign('/MyProject', PSP2_DEFINITION);

    const project = await hierarchy.findByPath('/MyProject');
    const children = await hierarchy.findChildren(project?.id ?? null);
    expect(children.map((child) => child.name)).toEqual(
      PSP2_DEFINITION.phases.map((phase) => phase.name),
    );
  });

  it('22. フェーズ種別が保存される: phaseType が入る', async () => {
    await node.addRoot('MyProject');

    await assign('/MyProject', PSP2_DEFINITION);

    const project = await hierarchy.findByPath('/MyProject');
    const children = await hierarchy.findChildren(project?.id ?? null);
    expect(children.map((child) => child.phaseType)).toEqual(
      PSP2_DEFINITION.phases.map((phase) => phase.type),
    );
  });

  it('23. 別の定義に変える: 既存のフェーズが消えて作り直される', async () => {
    await node.addRoot('MyProject');
    await assign('/MyProject', PSP2_DEFINITION);

    const other: ProcessDefinition = {
      id: 'PSP0',
      name: 'PSP0',
      phases: [
        { name: 'Planning', type: 'plan' },
        { name: 'Postmortem', type: 'pm' },
      ],
    };
    await reassign('/MyProject', other);

    const project = await hierarchy.findByPath('/MyProject');
    const children = await hierarchy.findChildren(project?.id ?? null);
    expect(children.map((child) => child.name)).toEqual(['Planning', 'Postmortem']);
    expect(project?.templateId).toBe('PSP0');
  });

  it('24. フェーズに子を追加できるか: canAddChild が false', async () => {
    await node.addRoot('MyProject');
    await assign('/MyProject', PSP2_DEFINITION);

    expect(await canAddChild('/MyProject/Planning')).toBe(false);
  });

  it('25. 通常のノードは子を追加できる: canAddChild が true', async () => {
    await node.addRoot('MyProject');

    expect(await canAddChild('/MyProject')).toBe(true);
  });
});
