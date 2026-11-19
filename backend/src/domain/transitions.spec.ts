import {
  assertTransition,
  canTransition,
  CLAIM_TRANSITIONS,
  POLICY_TRANSITIONS,
  SUBSCRIPTION_TRANSITIONS,
} from './transitions';

describe('transições de status', () => {
  it('sinistro segue o fluxo aberto → análise → aprovado → franquia → concluído', () => {
    expect(canTransition(CLAIM_TRANSITIONS, 'ABERTO', 'EM_ANALISE')).toBe(true);
    expect(canTransition(CLAIM_TRANSITIONS, 'EM_ANALISE', 'APROVADO')).toBe(
      true,
    );
    expect(
      canTransition(CLAIM_TRANSITIONS, 'APROVADO', 'AGUARDANDO_FRANQUIA'),
    ).toBe(true);
    expect(
      canTransition(CLAIM_TRANSITIONS, 'AGUARDANDO_FRANQUIA', 'CONCLUIDO'),
    ).toBe(true);
  });

  it('sinistro não pula etapas nem sai de estado final', () => {
    expect(canTransition(CLAIM_TRANSITIONS, 'ABERTO', 'APROVADO')).toBe(false);
    expect(canTransition(CLAIM_TRANSITIONS, 'NEGADO', 'EM_ANALISE')).toBe(
      false,
    );
    expect(canTransition(CLAIM_TRANSITIONS, 'CONCLUIDO', 'ABERTO')).toBe(false);
  });

  it('assinatura: inadimplente pode voltar a ativa, cancelada é final', () => {
    expect(
      canTransition(SUBSCRIPTION_TRANSITIONS, 'INADIMPLENTE', 'ATIVA'),
    ).toBe(true);
    expect(canTransition(SUBSCRIPTION_TRANSITIONS, 'SUSPENSA', 'ATIVA')).toBe(
      true,
    );
    expect(canTransition(SUBSCRIPTION_TRANSITIONS, 'CANCELADA', 'ATIVA')).toBe(
      false,
    );
    expect(
      canTransition(SUBSCRIPTION_TRANSITIONS, 'PENDENTE', 'INADIMPLENTE'),
    ).toBe(false);
  });

  it('apólice encerrada não volta', () => {
    expect(canTransition(POLICY_TRANSITIONS, 'ENCERRADA', 'ATIVA')).toBe(false);
  });

  it('assertTransition lança erro 409 em transição inválida', () => {
    expect(() =>
      assertTransition(CLAIM_TRANSITIONS, 'ABERTO', 'CONCLUIDO', 'o sinistro'),
    ).toThrow(/Não é possível/);
    expect(() =>
      assertTransition(CLAIM_TRANSITIONS, 'ABERTO', 'EM_ANALISE', 'o sinistro'),
    ).not.toThrow();
  });
});
