import { Router, Request, Response } from 'express';
import { DBManager } from '../database/db';
import { FinanceiroService } from '../services/financeiroService';

const router = Router();

// GET /api/servicos
router.get('/', async (_req: Request, res: Response): Promise<any> => {
  try {
    const servicos = await DBManager.getServicos();
    const dashboard = await FinanceiroService.getDashboardMetrics();
    
    // Anexar métricas financeiras a cada serviço
    const comMetricas = servicos.map(s => {
      const metric = dashboard.servicos.find(m => m.servicoId === s.id);
      return {
        ...s,
        metricas: metric || null
      };
    });

    return res.json(comMetricas);
  } catch (err: any) {
    console.error('[Servicos Route] Erro:', err);
    return res.status(500).json({ error: 'Erro ao buscar serviços.' });
  }
});

// GET /api/servicos/:id
router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const servico = await DBManager.getServicoById(req.params.id);
    if (!servico) return res.status(404).json({ error: 'Serviço não encontrado.' });

    const furos = await DBManager.getFuros(servico.id);
    const dashboard = await FinanceiroService.getDashboardMetrics();
    const metric = dashboard.servicos.find(m => m.servicoId === servico.id);

    return res.json({
      ...servico,
      furos,
      metricas: metric || null
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao carregar detalhes do serviço.' });
  }
});

// POST /api/servicos (Criação de novo serviço com configuração de meta e cenário financeiro)
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      id,
      nome,
      descricao,
      cliente,
      projeto,
      obra,
      centro_custo,
      local,
      gestor_id,
      cenario_financeiro,
      valor_metro,
      fator_financeiro,
      diametro_furo_mm,
      valor_total_fechado,
      metragem_prevista_total,
      tipo_meta,
      meta_metros
    } = req.body;

    if (!nome || !cliente || !local) {
      return res.status(400).json({ error: 'Campos Nome, Cliente e Local são obrigatórios.' });
    }

    const novoServico = await DBManager.createServico({
      id,
      nome,
      descricao,
      cliente,
      projeto,
      obra,
      centro_custo,
      local,
      gestor_id,
      cenario_financeiro: cenario_financeiro || 'VALOR_METRO',
      valor_metro: Number(valor_metro) || 0,
      fator_financeiro: Number(fator_financeiro) || 0,
      diametro_furo_mm: Number(diametro_furo_mm) || 0,
      valor_total_fechado: Number(valor_total_fechado) || 0,
      metragem_prevista_total: Number(metragem_prevista_total) || 0,
      tipo_meta: tipo_meta || 'DIARIA',
      meta_metros: Number(meta_metros) || 54
    });

    await DBManager.logAction(gestor_id || 'SISTEMA', 'CRIAR_SERVICO', `Serviço ${novoServico.nome} criado com sucesso.`);

    return res.status(201).json(novoServico);
  } catch (err: any) {
    console.error('[Servicos POST] Erro:', err);
    return res.status(500).json({ error: 'Erro ao criar serviço.' });
  }
});

// PUT /api/servicos/:id
router.put('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const updated = await DBManager.updateServico(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Serviço não encontrado.' });
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao atualizar serviço.' });
  }
});

export default router;
