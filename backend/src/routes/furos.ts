import { Router, Request, Response } from 'express';
import { DBManager } from '../database/db';

const router = Router();

// GET /api/furos
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const servicoId = req.query.servico_id as string | undefined;
    const furos = await DBManager.getFuros(servicoId);
    return res.json(furos);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar relatórios de perfuração.' });
  }
});

// GET /api/furos/:id
router.get('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const furo = await DBManager.getFuroById(req.params.id);
    if (!furo) return res.status(404).json({ error: 'Relatório de perfuração não encontrado.' });

    const barras = await DBManager.getBarras(furo.id);
    const servico = await DBManager.getServicoById(furo.servico_id);

    return res.json({
      ...furo,
      servico,
      barras
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao carregar relatório.' });
  }
});

// POST /api/furos
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      servico_id,
      data_furo,
      navegador_id,
      operador_id,
      navegador_nome,
      operador_nome,
      tubo_aplicado,
      diametro_furo,
      comprimento_furo,
      tipo_perfuracao,
      utilizacao_tubo,
      hora_inicio_furo,
      hora_fim_furo,
      horimetro_inicio_furo,
      horimetro_fim_furo,
      hora_inicio_pux,
      hora_fim_pux,
      horimetro_inicio_pux,
      horimetro_fim_pux,
      observacoes
    } = req.body;

    if (!servico_id) {
      return res.status(400).json({ error: 'É necessário informar o serviço correspondente.' });
    }

    const novoFuro = await DBManager.createFuro({
      servico_id,
      data_furo: data_furo || new Date().toISOString().split('T')[0],
      navegador_id,
      operador_id,
      navegador_nome,
      operador_nome,
      tubo_aplicado,
      diametro_furo,
      comprimento_furo: Number(comprimento_furo) || 0,
      tipo_perfuracao: tipo_perfuracao || [],
      utilizacao_tubo: utilizacao_tubo || [],
      hora_inicio_furo,
      hora_fim_furo,
      horimetro_inicio_furo,
      horimetro_fim_furo,
      hora_inicio_pux,
      hora_fim_pux,
      horimetro_inicio_pux,
      horimetro_fim_pux,
      observacoes,
      status: 'EM_EXECUCAO'
    });

    return res.status(201).json(novoFuro);
  } catch (err: any) {
    console.error('[Furos POST] Erro:', err);
    return res.status(500).json({ error: 'Erro ao criar relatório de perfuração.' });
  }
});

// PUT /api/furos/:id
router.put('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const updated = await DBManager.updateFuro(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Furo não encontrado.' });
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao atualizar relatório de perfuração.' });
  }
});

export default router;
