import { Router, Request, Response } from 'express';
import { FinanceiroService } from '../services/financeiroService';
import { ExportService } from '../services/exportService';
import { RelatorioDiarioEmailService } from '../services/relatorioDiarioEmailService';
import { RelatorioDiarioTelegramService } from '../services/relatorioDiarioTelegramService';

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

// GET /api/relatorios/diario/preview
router.get('/diario/preview', async (req: Request, res: Response): Promise<any> => {
  try {
    const dataRef = req.query.data as string | undefined;
    const dados = await RelatorioDiarioEmailService.getDadosFechamentoDiario(dataRef);
    const html = RelatorioDiarioEmailService.gerarHtmlEmailDiario(dados);

    if (req.query.format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    return res.json({ status: 'ok', dados, html });
  } catch (err: any) {
    console.error('[Relatorio Diario Preview] Erro:', err);
    return res.status(500).json({ error: 'Erro ao gerar prévia do relatório diário.' });
  }
});

// POST /api/relatorios/diario/enviar
router.post('/diario/enviar', async (req: Request, res: Response): Promise<any> => {
  try {
    const { destinatarios, dataRef } = req.body;
    const resultado = await RelatorioDiarioEmailService.enviarRelatorioEmail(destinatarios, dataRef);
    return res.json(resultado);
  } catch (err: any) {
    console.error('[Relatorio Diario Enviar] Erro:', err);
    return res.status(500).json({ error: 'Erro ao disparar relatório diário por e-mail.' });
  }
});

// GET /api/relatorios/diario/config
router.get('/diario/config', async (_req: Request, res: Response): Promise<any> => {
  try {
    const config = RelatorioDiarioEmailService.getConfigEmailDiario();
    return res.json({ status: 'ok', config });
  } catch (err: any) {
    console.error('[Relatorio Diario Config GET] Erro:', err);
    return res.status(500).json({ error: 'Erro ao consultar configurações de e-mail.' });
  }
});

// POST /api/relatorios/diario/config
router.post('/diario/config', async (req: Request, res: Response): Promise<any> => {
  try {
    const saved = RelatorioDiarioEmailService.salvarConfigEmailDiario(req.body);
    return res.json({ status: 'ok', config: saved });
  } catch (err: any) {
    console.error('[Relatorio Diario Config POST] Erro:', err);
    return res.status(500).json({ error: 'Erro ao salvar configurações de e-mail.' });
  }
});

// GET /api/relatorios/telegram/config
router.get('/telegram/config', async (_req: Request, res: Response): Promise<any> => {
  try {
    const config = RelatorioDiarioTelegramService.getConfigTelegram();
    return res.json({ status: 'ok', config });
  } catch (err: any) {
    console.error('[Telegram Config GET] Erro:', err);
    return res.status(500).json({ error: 'Erro ao consultar configurações do Telegram.' });
  }
});

// POST /api/relatorios/telegram/config
router.post('/telegram/config', async (req: Request, res: Response): Promise<any> => {
  try {
    const saved = RelatorioDiarioTelegramService.salvarConfigTelegram(req.body);
    return res.json({ status: 'ok', config: saved });
  } catch (err: any) {
    console.error('[Telegram Config POST] Erro:', err);
    return res.status(500).json({ error: 'Erro ao salvar configurações do Telegram.' });
  }
});

// POST /api/relatorios/telegram/enviar
router.post('/telegram/enviar', async (req: Request, res: Response): Promise<any> => {
  try {
    const { chatId, botToken, dataRef } = req.body;
    const resultado = await RelatorioDiarioTelegramService.enviarRelatorioTelegram(chatId, botToken, dataRef);
    return res.json(resultado);
  } catch (err: any) {
    console.error('[Telegram Enviar] Erro:', err);
    return res.status(500).json({ error: 'Erro ao disparar relatório diário no Telegram.' });
  }
});

// GET /api/relatorios/telegram/detectar-chat
router.get('/telegram/detectar-chat', async (req: Request, res: Response): Promise<any> => {
  try {
    const botToken = req.query.botToken as string | undefined;
    const resultado = await RelatorioDiarioTelegramService.detectarChatId(botToken);
    return res.json(resultado);
  } catch (err: any) {
    console.error('[Telegram Detectar Chat] Erro:', err);
    return res.status(500).json({ error: 'Erro ao detectar chat no Telegram.' });
  }
});

export default router;

