import express from 'express';
import cors from 'cors';
import { DBManager } from './database/db';
import authRoutes from './routes/auth';
import servicosRoutes from './routes/servicos';
import furosRoutes from './routes/furos';
import barrasRoutes from './routes/barras';
import relatoriosRoutes from './routes/relatorios';
import geocodeRoutes from './routes/geocode';
import { requireManager } from './requireManager';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[Tecnodrill API] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'TecnoDrill INFRA Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api', (req, res, next) => {
  if (
    req.path === '/geocode' || 
    req.path.startsWith('/geocode/') ||
    req.path.startsWith('/relatorios/diario') ||
    req.path.startsWith('/relatorios/telegram') ||
    req.path.startsWith('/auth')
  ) {
    return next();
  }
  return requireManager(req, res, next);
});
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes);
app.use('/api/servicos', servicosRoutes);
app.use('/servicos', servicosRoutes);
app.use('/api/furos', furosRoutes);
app.use('/furos', furosRoutes);
app.use('/api', barrasRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/relatorios', relatoriosRoutes);
app.use('/api/geocode', geocodeRoutes);
app.use('/geocode', geocodeRoutes);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Tecnodrill Server Error]', err);
  res.status(500).json({ error: 'Ocorreu um erro interno no servidor da Tecnodrill.' });
});

import { RelatorioDiarioEmailService } from './services/relatorioDiarioEmailService';
import { RelatorioDiarioTelegramService } from './services/relatorioDiarioTelegramService';

let ultimoDiaExecutado = '';

const iniciarAgendadorRelatorioDiario = () => {
  console.log('⏰ [Scheduler] Agendador de relatórios diários das 19h (Brasília) inicializado.');
  setInterval(async () => {
    try {
      const agora = new Date();
      const optionsHora: Intl.DateTimeFormatOptions = { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false };
      const optionsData: Intl.DateTimeFormatOptions = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };

      const horaBrasilia = agora.toLocaleTimeString('pt-BR', optionsHora);
      const dataBrasilia = agora.toLocaleDateString('pt-BR', optionsData);

      const [hora, minuto] = horaBrasilia.split(':').map(Number);

      if (hora === 19 && minuto >= 0 && minuto <= 5 && ultimoDiaExecutado !== dataBrasilia) {
        ultimoDiaExecutado = dataBrasilia;
        console.log(`⏰ [Scheduler 19h] Disparando relatórios automáticos diários de ${dataBrasilia} às ${horaBrasilia}...`);

        try {
          await RelatorioDiarioEmailService.enviarRelatorioEmail();
          console.log('✅ [Scheduler 19h] Relatório de e-mail disparado.');
        } catch (e: any) {
          console.error('❌ [Scheduler 19h] Erro ao disparar e-mail:', e);
        }

        try {
          await RelatorioDiarioTelegramService.enviarRelatorioTelegram();
          console.log('✅ [Scheduler 19h] Relatório do Telegram disparado.');
        } catch (e: any) {
          console.error('❌ [Scheduler 19h] Erro ao disparar Telegram:', e);
        }
      }
    } catch (err) {
      console.error('[Scheduler Error]', err);
    }
  }, 60000);
};

// Start server and initialize DB
const startServer = async () => {
  try {
    await DBManager.init();
    app.listen(PORT, () => {
      console.log(`🚀 [Tecnodrill INFRA Backend] Servidor rodando com sucesso na porta ${PORT}`);
      console.log(`📡 URL API: http://localhost:${PORT}/api`);
      iniciarAgendadorRelatorioDiario();
    });
  } catch (err) {
    console.error('Falha crítica ao iniciar servidor Tecnodrill:', err);
    process.exit(1);
  }
};

if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}

export default app;
