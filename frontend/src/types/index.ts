export type PerfilUsuario = 'ADMIN' | 'GESTOR' | 'NAVEGADOR' | 'OPERADOR';

export interface Usuario {
  id: string;
  nome: string;
  perfil: PerfilUsuario;
  email: string;
  username: string;
  ativo: boolean;
  trocar_senha_primeiro_acesso?: boolean;
}

export type CenarioFinanceiro = 'VALOR_METRO' | 'FATOR_DIAMETRO_METRO' | 'VALOR_FECHADO';
export type TipoMeta = 'DIARIA' | 'SEMANAL';
export type StatusServico = 'EM_ANDAMENTO' | 'CONCLUIDO' | 'PAUSADO';

export interface Servico {
  id: string;
  nome: string;
  descricao?: string;
  cliente: string;
  projeto?: string;
  obra?: string;
  centro_custo?: string;
  local: string;
  gestor_id?: string;
  navegador_id?: string;
  navegador_nome?: string;
  operador_id?: string;
  operador_nome?: string;
  status: StatusServico;
  cenario_financeiro: CenarioFinanceiro;
  valor_metro: number;
  fator_financeiro: number;
  diametro_furo_mm: number;
  valor_total_fechado: number;
  metragem_prevista_total: number;
  tipo_meta: TipoMeta;
  meta_metros: number;
  criado_em?: string;
  metricas?: ResumoFinanceiroServico;
}

export interface Furo {
  id: string;
  servico_id: string;
  data_furo: string;
  navegador_id?: string;
  operador_id?: string;
  navegador_nome?: string;
  operador_nome?: string;
  tubo_aplicado?: string;
  diametro_furo?: string;
  comprimento_furo: number;
  tipo_perfuracao: string[];
  utilizacao_tubo: string[];
  hora_inicio_furo?: string;
  hora_fim_furo?: string;
  horimetro_inicio_furo?: string;
  horimetro_fim_furo?: string;
  hora_inicio_pux?: string;
  hora_fim_pux?: string;
  horimetro_inicio_pux?: string;
  horimetro_fim_pux?: string;
  status: 'EM_EXECUCAO' | 'FINALIZADO';
  observacoes?: string;
  assinatura_navegador?: string;
  assinatura_fiscal?: string;
  servico?: Servico;
  barras?: Barra[];
}

export interface Barra {
  id: string;
  furo_id: string;
  numero_barra: number;
  metros?: number;
  metros_acumulados: number;
  tem_caixa?: boolean;
  tipo_caixa?: string;
  observacao?: string;
  angulo_pitch?: string;
  profundidade_cm?: number;
  distancia_pista_cm?: number;
  foto_url?: string;
  latitude?: number;
  longitude?: number;
  horario_registro?: string;
  registrado_por?: string;
  created_at?: string;
  data_registro?: string;
}

export interface ResumoFinanceiroServico {
  servicoId: string;
  nome: string;
  cliente: string;
  cenarioFinanceiro: CenarioFinanceiro;
  metrosExecutados: number;
  metragemPrevistaTotal: number;
  percentualConcluido: number;
  retornoFinanceiroCalculado: number;
  detalhesCalculo: {
    formula: string;
    parametros: Record<string, any>;
  };
  meta: {
    tipo: TipoMeta;
    valorMetaMetros: number;
    metrosPeriodoAtual: number;
    percentualMetaPeriodo: number;
    metaAtingida: boolean;
  };
}

export interface DashboardGestorMetrics {
  totalMetrosPerfurados: number;
  totalRetornoFinanceiro: number;
  totalServicosAtivos: number;
  totalFurosFinalizados: number;
  taxaAtingimentoMetas: number;
  servicos: ResumoFinanceiroServico[];
  evolucaoDiaria: Array<{ data: string; metros: number; retorno: number }>;
}
