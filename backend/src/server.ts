import express from 'express';
import cors from 'cors';
import { DBManager } from './database/db';
import authRoutes from './routes/auth';
import servicosRoutes from './routes/servicos';
import furosRoutes from './routes/furos';
import barrasRoutes from './routes/barras';
import relatoriosRoutes from './routes/relatorios';

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
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes);
app.use('/api/servicos', servicosRoutes);
app.use('/api/furos', furosRoutes);
app.use('/api', barrasRoutes);
app.use('/api/relatorios', relatoriosRoutes);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Tecnodrill Server Error]', err);
  res.status(500).json({ error: 'Ocorreu um erro interno no servidor da Tecnodrill.' });
});

// Start server and initialize DB
const startServer = async () => {
  try {
    await DBManager.init();
    app.listen(PORT, () => {
      console.log(`🚀 [Tecnodrill INFRA Backend] Servidor rodando com sucesso na porta ${PORT}`);
      console.log(`📡 URL API: http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error('Falha crítica ao iniciar servidor Tecnodrill:', err);
    process.exit(1);
  }
};

startServer();
