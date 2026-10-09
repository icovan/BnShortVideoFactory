/** BnShortVideoFactory 本机一体：始终 monolith，不走云端编排壳 */
export type FactoryRole = 'monolith' | 'orchestrator' | 'renderer';

export function factoryRole(): FactoryRole {
  return 'monolith';
}

export function orchestratorUrl(): string {
  return '';
}

export function agentKey(): string {
  return '';
}

export function isShellRenderer(): boolean {
  return false;
}

export function shellInfo() {
  return {
    role: 'monolith' as const,
    orchestratorUrl: undefined as string | undefined,
    shell: false,
    shipsSkills: true,
  };
}
