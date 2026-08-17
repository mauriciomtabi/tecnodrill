import { Router, Request, Response } from 'express';
import { FinanceiroService } from '../services/financeiroService';
import { ExportService } from '../services/exportService';

const router = Router();

// GET /api/relatorios/dashboard
router.get('/dashboard', async (_req: Request, res: Response): Promise<any> => {
  try {
    const metrics = await FinanceiroService.getDashboardMetrics();
    return res.json(metrics);
  } catch (err: any) {
    console.error('[Relatorios Dashboard] Erro:', err);
    return res.status(500).json({ error: 'Erro ao gerar métricas do dashboard.' });
  }
});

// GET /api/relatorios/furo/:id/excel
router.get('/furo/:id/excel', async (req: Request, res: Response): Promise<any> => {
  try {
    const buffer = await ExportService.gerarExcelFuro(req.params.id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Relatorio_Perfuracao_Tecnodrill_${req.params.id}.xlsx"`);
    return res.send(buffer);
  } catch (err: any) {
    console.error('[Relatorio Excel] Erro:', err);
    return res.status(500).json({ error: 'Erro ao gerar planilha Excel do relatório.' });
  }
});

export default router;
