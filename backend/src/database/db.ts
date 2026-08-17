import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment loader
const loadEnv = () => {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return;
      const parts = trimmedLine.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = value;
      }
    });
  }
};
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkscchjzztwyjzjpllob.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrc2NjaGp6enR3eWp6anBsbG9iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI0NDcwMCwiZXhwIjoyMDk2ODIwNzAwfQ.QDco_35MhHsnHWDMrtcAsQyRXKJOntO1otClAWTA5KU';
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Types
export interface TecnodrillUsuario {
  id: string;
  nome: string;
  perfil: 'ADMIN' | 'GESTOR' | 'NAVEGADOR' | 'OPERADOR';
  email: string;
  username: string;
  senha_hash: string;
  ativo: boolean;
  criado_em?: string;
}

export interface TecnodrillServico {
  id: string;
  nome: string;
  descricao?: string;
  cliente: string;
  projeto?: string;
  obra?: string;
  centro_custo?: string;
  local: string;
  gestor_id?: string;
  status: 'EM_ANDAMENTO' | 'CONCLUIDO' | 'PAUSADO';
  cenario_financeiro: 'VALOR_METRO' | 'FATOR_DIAMETRO_METRO' | 'VALOR_FECHADO';
  valor_metro: number;
  fator_financeiro: number;
  diametro_furo_mm: number;
  valor_total_fechado: number;
  metragem_prevista_total: number;
  tipo_meta: 'DIARIA' | 'SEMANAL';
  meta_metros: number;
  criado_em?: string;
  atualizado_em?: string;
}

export interface TecnodrillFuro {
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
  criado_em?: string;
  atualizado_em?: string;
}

export interface TecnodrillBarra {
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
}

export interface DatabaseState {
  usuarios: TecnodrillUsuario[];
  servicos: TecnodrillServico[];
  furos: TecnodrillFuro[];
  barras: TecnodrillBarra[];
  logs: any[];
}

// Local JSON file path fallback
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'tecnodrill_db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class DBManager {
  private static localData: DatabaseState = {
    usuarios: [],
    servicos: [],
    furos: [],
    barras: [],
    logs: []
  };

  public static async init() {
    console.log('[Tecnodrill DB] Inicializando gerenciador de banco...');
    
    // Seed default admin and managers if needed
    const defaultPasswordHash = await bcrypt.hash('Gestor@123', 10);
    const opPasswordHash = await bcrypt.hash('Tecno@123', 10);

    const initialUsers: TecnodrillUsuario[] = [
      {
        id: '11111111-1111-4111-a111-111111111111',
        nome: 'Eduardo Gestor',
        perfil: 'GESTOR',
        email: 'eduardo@tecnodrill.com.br',
        username: 'eduardo',
        senha_hash: defaultPasswordHash,
        ativo: true
      },
      {
        id: '22222222-2222-4222-a222-222222222222',
        nome: 'Carlos Gestor',
        perfil: 'GESTOR',
        email: 'carlos@tecnodrill.com.br',
        username: 'carlos',
        senha_hash: defaultPasswordHash,
        ativo: true
      },
      {
        id: '33333333-3333-4333-a333-333333333333',
        nome: 'Marcelo Navegador',
        perfil: 'NAVEGADOR',
        email: 'marcelo@tecnodrill.com.br',
        username: 'marcelo',
        senha_hash: opPasswordHash,
        ativo: true
      },
      {
        id: '44444444-4444-4444-a444-444444444444',
        nome: 'Antônio Operador',
        perfil: 'OPERADOR',
        email: 'antonio@tecnodrill.com.br',
        username: 'antonio',
        senha_hash: opPasswordHash,
        ativo: true
      }
    ];

    const initialService: TecnodrillServico = {
      id: 'TD-OBRA-01',
      nome: 'Canalização e Perfuração - Itapoá Centro',
      descricao: 'Cruzamento com rede subterrânea e travessia urbana',
      cliente: 'Vale do Ouro',
      projeto: 'PRJ-ITAPOA-2026',
      obra: 'OBRA-01-SP',
      centro_custo: 'CC-3021',
      local: 'Itapoá SP - Rua Sol Nascente',
      gestor_id: '11111111-1111-4111-a111-111111111111',
      status: 'EM_ANDAMENTO',
      cenario_financeiro: 'FATOR_DIAMETRO_METRO',
      valor_metro: 0,
      fator_financeiro: 2.85,
      diametro_furo_mm: 150,
      valor_total_fechado: 0,
      metragem_prevista_total: 54,
      tipo_meta: 'DIARIA',
      meta_metros: 54,
      criado_em: new Date().toISOString()
    };

    const initialFuro: TecnodrillFuro = {
      id: '55555555-5555-4555-a555-555555555555',
      servico_id: 'TD-OBRA-01',
      data_furo: '2026-08-14',
      navegador_id: '33333333-3333-4333-a333-333333333333',
      operador_id: '44444444-4444-4444-a444-444444444444',
      navegador_nome: 'Marcelo',
      operador_nome: 'Antônio',
      tubo_aplicado: 'PEAD 150mm',
      diametro_furo: '150 MM',
      comprimento_furo: 54,
      tipo_perfuracao: ['Ruas/Av'],
      utilizacao_tubo: ['Esgoto'],
      hora_inicio_furo: '08:00',
      hora_fim_furo: '17:30',
      horimetro_inicio_furo: '1240.5',
      horimetro_fim_furo: '1249.0',
      hora_inicio_pux: '18:00',
      hora_fim_pux: '20:15',
      horimetro_inicio_pux: '1249.0',
      horimetro_fim_pux: '1251.2',
      status: 'FINALIZADO',
      observacoes: 'Perfuração concluída com sucesso conforme ficha técnica de campo'
    };

    // Pre-populate sample bars from the physical sheet (Barra 1 to 18 = 54m)
    const initialBarras: TecnodrillBarra[] = [
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 1, metros_acumulados: 3, angulo_pitch: '+0,08', profundidade_cm: 167 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 2, metros_acumulados: 6, angulo_pitch: '+0,08', profundidade_cm: 164 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 3, metros_acumulados: 9, angulo_pitch: '+0,08', profundidade_cm: 164 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 4, metros_acumulados: 12, angulo_pitch: '+0,08', profundidade_cm: 160 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 5, metros_acumulados: 15, angulo_pitch: '+0,09', profundidade_cm: 161 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 6, metros_acumulados: 18, angulo_pitch: '+0,08', profundidade_cm: 155 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 7, metros_acumulados: 21, angulo_pitch: '+0,08', profundidade_cm: 157 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 8, metros_acumulados: 24, angulo_pitch: '+0,08', profundidade_cm: 151 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 9, metros_acumulados: 27, angulo_pitch: '+0,08', profundidade_cm: 150 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 10, metros_acumulados: 30, angulo_pitch: '+0,08', profundidade_cm: 155 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 11, metros_acumulados: 33, angulo_pitch: '+0,08', profundidade_cm: 152 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 12, metros_acumulados: 36, angulo_pitch: '+0,08', profundidade_cm: 151 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 13, metros_acumulados: 39, angulo_pitch: '+0,08', profundidade_cm: 157 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 14, metros_acumulados: 42, angulo_pitch: '+0,08', profundidade_cm: 150 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 15, metros_acumulados: 45, angulo_pitch: '+0,08', profundidade_cm: 150 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 16, metros_acumulados: 48, angulo_pitch: '+0,08', profundidade_cm: 141 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 17, metros_acumulados: 51, angulo_pitch: '+0,08', profundidade_cm: 137 },
      { id: crypto.randomUUID(), furo_id: initialFuro.id, numero_barra: 18, metros_acumulados: 54, angulo_pitch: '+0,08', profundidade_cm: 135 }
    ];

    // Load local file if exists
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.localData = JSON.parse(raw);
      } catch (err) {
        console.error('[Tecnodrill DB] Erro lendo db local:', err);
      }
    }

    if (!this.localData.usuarios || this.localData.usuarios.length === 0) {
      this.localData.usuarios = initialUsers;
      this.localData.servicos = [initialService];
      this.localData.furos = [initialFuro];
      this.localData.barras = initialBarras;
      this.saveLocal();
    }

    // Try Supabase sync
    try {
      const { data: users, error } = await supabase.from('tecnodrill_usuarios').select('id').limit(1);
      if (error && error.code === '42P01') {
        console.log('[Tecnodrill DB] Tabelas tecnodrill_* não encontradas no Supabase. Utilizando storage local/híbrido com alta disponibilidade.');
      } else if (!error && users && users.length === 0) {
        console.log('[Tecnodrill DB] Populando seed inicial no Supabase...');
        await supabase.from('tecnodrill_usuarios').insert(initialUsers);
        await supabase.from('tecnodrill_servicos').insert([initialService]);
        await supabase.from('tecnodrill_furos').insert([initialFuro]);
        await supabase.from('tecnodrill_barras').insert(initialBarras);
      }
    } catch (e) {
      console.log('[Tecnodrill DB] Supabase indisponível no momento, operando com cache local persistente.');
    }
  }

  private static saveLocal() {
    fs.writeFileSync(DB_FILE, JSON.stringify(this.localData, null, 2), 'utf-8');
  }

  // --- USUARIOS ---
  public static async getUsuarios(): Promise<TecnodrillUsuario[]> {
    try {
      const { data, error } = await supabase.from('tecnodrill_usuarios').select('*').order('nome');
      if (!error && data && data.length > 0) return data;
    } catch (_) {}
    return this.localData.usuarios;
  }

  public static async getUsuarioByEmailOrUsername(identifier: string): Promise<TecnodrillUsuario | null> {
    const idLower = identifier.toLowerCase().trim();
    try {
      const { data, error } = await supabase
        .from('tecnodrill_usuarios')
        .select('*')
        .or(`email.ilike.${idLower},username.ilike.${idLower}`)
        .limit(1);
      if (!error && data && data.length > 0) return data[0];
    } catch (_) {}
    return this.localData.usuarios.find(u => 
      (u.email && u.email.toLowerCase() === idLower) || 
      (u.username && u.username.toLowerCase() === idLower)
    ) || null;
  }

  public static async getUsuarioById(id: string): Promise<TecnodrillUsuario | null> {
    try {
      const { data, error } = await supabase.from('tecnodrill_usuarios').select('*').eq('id', id).limit(1);
      if (!error && data && data.length > 0) return data[0];
    } catch (_) {}
    return this.localData.usuarios.find(u => u.id === id) || null;
  }

  public static async createUsuario(user: Partial<TecnodrillUsuario>): Promise<TecnodrillUsuario> {
    const newUser: TecnodrillUsuario = {
      id: user.id || crypto.randomUUID(),
      nome: user.nome || '',
      perfil: user.perfil || 'OPERADOR',
      email: user.email || '',
      username: user.username || user.email?.split('@')[0] || `user_${Date.now()}`,
      senha_hash: user.senha_hash || '',
      ativo: user.ativo !== undefined ? user.ativo : true,
      criado_em: new Date().toISOString()
    };

    try {
      await supabase.from('tecnodrill_usuarios').insert([newUser]);
    } catch (_) {}

    this.localData.usuarios.push(newUser);
    this.saveLocal();
    return newUser;
  }

  public static async updateUsuario(id: string, updates: Partial<TecnodrillUsuario>): Promise<TecnodrillUsuario | null> {
    try {
      await supabase.from('tecnodrill_usuarios').update(updates).eq('id', id);
    } catch (_) {}

    const idx = this.localData.usuarios.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.localData.usuarios[idx] = { ...this.localData.usuarios[idx], ...updates };
      this.saveLocal();
      return this.localData.usuarios[idx];
    }
    return null;
  }

  public static async deleteUsuario(id: string): Promise<boolean> {
    try {
      await supabase.from('tecnodrill_usuarios').delete().eq('id', id);
    } catch (_) {}

    this.localData.usuarios = this.localData.usuarios.filter(u => u.id !== id);
    this.saveLocal();
    return true;
  }

  // --- SERVICOS ---
  public static async getServicos(): Promise<TecnodrillServico[]> {
    try {
      const { data, error } = await supabase.from('tecnodrill_servicos').select('*').order('criado_em', { ascending: false });
      if (!error && data) return data;
    } catch (_) {}
    return this.localData.servicos;
  }

  public static async getServicoById(id: string): Promise<TecnodrillServico | null> {
    try {
      const { data, error } = await supabase.from('tecnodrill_servicos').select('*').eq('id', id).limit(1);
      if (!error && data && data.length > 0) return data[0];
    } catch (_) {}
    return this.localData.servicos.find(s => s.id === id) || null;
  }

  public static async createServico(servico: Partial<TecnodrillServico>): Promise<TecnodrillServico> {
    const existingCount = this.localData.servicos.length + 1;
    const generatedId = `TD-${String(existingCount).padStart(2, '0')}`;

    const newServico: TecnodrillServico = {
      id: servico.id || generatedId,
      nome: servico.nome || '',
      descricao: servico.descricao || '',
      cliente: servico.cliente || '',
      projeto: servico.projeto || '',
      obra: servico.obra || '',
      centro_custo: servico.centro_custo || '',
      local: servico.local || '',
      gestor_id: servico.gestor_id,
      status: servico.status || 'EM_ANDAMENTO',
      cenario_financeiro: servico.cenario_financeiro || 'VALOR_METRO',
      valor_metro: Number(servico.valor_metro) || 0,
      fator_financeiro: Number(servico.fator_financeiro) || 0,
      diametro_furo_mm: Number(servico.diametro_furo_mm) || 0,
      valor_total_fechado: Number(servico.valor_total_fechado) || 0,
      metragem_prevista_total: Number(servico.metragem_prevista_total) || 0,
      tipo_meta: servico.tipo_meta || 'DIARIA',
      meta_metros: Number(servico.meta_metros) || 54,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    };

    try {
      await supabase.from('tecnodrill_servicos').insert([newServico]);
    } catch (_) {}

    this.localData.servicos.unshift(newServico);
    this.saveLocal();
    return newServico;
  }

  public static async updateServico(id: string, updates: Partial<TecnodrillServico>): Promise<TecnodrillServico | null> {
    try {
      await supabase.from('tecnodrill_servicos').update({ ...updates, atualizado_em: new Date().toISOString() }).eq('id', id);
    } catch (_) {}

    const index = this.localData.servicos.findIndex(s => s.id === id);
    if (index !== -1) {
      this.localData.servicos[index] = { ...this.localData.servicos[index], ...updates, atualizado_em: new Date().toISOString() };
      this.saveLocal();
      return this.localData.servicos[index];
    }
    return null;
  }

  // --- FUROS ---
  public static async getFuros(servicoId?: string): Promise<TecnodrillFuro[]> {
    try {
      let q = supabase.from('tecnodrill_furos').select('*').order('data_furo', { ascending: false });
      if (servicoId) q = q.eq('servico_id', servicoId);
      const { data, error } = await q;
      if (!error && data) return data;
    } catch (_) {}
    if (servicoId) return this.localData.furos.filter(f => f.servico_id === servicoId);
    return this.localData.furos;
  }

  public static async getFuroById(id: string): Promise<TecnodrillFuro | null> {
    try {
      const { data, error } = await supabase.from('tecnodrill_furos').select('*').eq('id', id).limit(1);
      if (!error && data && data.length > 0) return data[0];
    } catch (_) {}
    return this.localData.furos.find(f => f.id === id) || null;
  }

  public static async createFuro(furo: Partial<TecnodrillFuro>): Promise<TecnodrillFuro> {
    const newFuro: TecnodrillFuro = {
      id: furo.id || crypto.randomUUID(),
      servico_id: furo.servico_id || '',
      data_furo: furo.data_furo || new Date().toISOString().split('T')[0],
      navegador_id: furo.navegador_id,
      operador_id: furo.operador_id,
      navegador_nome: furo.navegador_nome || '',
      operador_nome: furo.operador_nome || '',
      tubo_aplicado: furo.tubo_aplicado || '',
      diametro_furo: furo.diametro_furo || '',
      comprimento_furo: Number(furo.comprimento_furo) || 0,
      tipo_perfuracao: furo.tipo_perfuracao || [],
      utilizacao_tubo: furo.utilizacao_tubo || [],
      hora_inicio_furo: furo.hora_inicio_furo || '',
      hora_fim_furo: furo.hora_fim_furo || '',
      horimetro_inicio_furo: furo.horimetro_inicio_furo || '',
      horimetro_fim_furo: furo.horimetro_fim_furo || '',
      hora_inicio_pux: furo.hora_inicio_pux || '',
      hora_fim_pux: furo.hora_fim_pux || '',
      horimetro_inicio_pux: furo.horimetro_inicio_pux || '',
      horimetro_fim_pux: furo.horimetro_fim_pux || '',
      status: furo.status || 'EM_EXECUCAO',
      observacoes: furo.observacoes || '',
      assinatura_navegador: furo.assinatura_navegador || '',
      assinatura_fiscal: furo.assinatura_fiscal || '',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    };

    try {
      await supabase.from('tecnodrill_furos').insert([newFuro]);
    } catch (_) {}

    this.localData.furos.unshift(newFuro);
    this.saveLocal();
    return newFuro;
  }

  public static async updateFuro(id: string, updates: Partial<TecnodrillFuro>): Promise<TecnodrillFuro | null> {
    try {
      await supabase.from('tecnodrill_furos').update({ ...updates, atualizado_em: new Date().toISOString() }).eq('id', id);
    } catch (_) {}

    const idx = this.localData.furos.findIndex(f => f.id === id);
    if (idx !== -1) {
      this.localData.furos[idx] = { ...this.localData.furos[idx], ...updates, atualizado_em: new Date().toISOString() };
      this.saveLocal();
      return this.localData.furos[idx];
    }
    return null;
  }

  // --- BARRAS ---
  public static async getBarras(furoId: string): Promise<TecnodrillBarra[]> {
    try {
      const { data, error } = await supabase.from('tecnodrill_barras').select('*').eq('furo_id', furoId).order('numero_barra', { ascending: true });
      if (!error && data) return data;
    } catch (_) {}
    return this.localData.barras.filter(b => b.furo_id === furoId).sort((a, b) => a.numero_barra - b.numero_barra);
  }

  public static async addBarra(barra: Partial<TecnodrillBarra>): Promise<TecnodrillBarra> {
    // Determine next number and accumulated meters
    const existing = await this.getBarras(barra.furo_id || '');
    const maxNumber = existing.reduce((max, b) => Math.max(max, b.numero_barra), 0);
    const nextNumber = barra.numero_barra || (maxNumber + 1);
    
    const lastBarra = existing[existing.length - 1];
    const metrosAnteriores = lastBarra ? lastBarra.metros_acumulados : 0;
    const metrosDesteLance = barra.metros !== undefined ? Number(barra.metros) : 3;
    const metrosAcumulados = barra.metros_acumulados !== undefined 
      ? Number(barra.metros_acumulados) 
      : (metrosAnteriores + metrosDesteLance);

    const newBarra: TecnodrillBarra = {
      id: barra.id || crypto.randomUUID(),
      furo_id: barra.furo_id || '',
      numero_barra: nextNumber,
      metros: metrosDesteLance,
      metros_acumulados: metrosAcumulados,
      tem_caixa: barra.tem_caixa !== undefined ? Boolean(barra.tem_caixa) : false,
      tipo_caixa: barra.tipo_caixa || '',
      observacao: barra.observacao || '',
      angulo_pitch: barra.angulo_pitch || '+0.00',
      profundidade_cm: Number(barra.profundidade_cm) || 0,
      distancia_pista_cm: Number(barra.distancia_pista_cm) || 0,
      foto_url: barra.foto_url || '',
      latitude: barra.latitude,
      longitude: barra.longitude,
      horario_registro: new Date().toISOString(),
      registrado_por: barra.registrado_por
    };

    try {
      await supabase.from('tecnodrill_barras').insert([newBarra]);
    } catch (_) {}

    // Update length in furo if higher
    await this.updateFuro(newBarra.furo_id, { comprimento_furo: metrosAcumulados });

    this.localData.barras.push(newBarra);
    this.saveLocal();
    return newBarra;
  }

  public static async deleteBarra(id: string): Promise<boolean> {
    try {
      await supabase.from('tecnodrill_barras').delete().eq('id', id);
    } catch (_) {}

    this.localData.barras = this.localData.barras.filter(b => b.id !== id);
    this.saveLocal();
    return true;
  }

  // --- LOGS ---
  public static async logAction(usuarioId: string, acao: string, detalhes: string) {
    const logItem = {
      id: crypto.randomUUID(),
      usuario_id: usuarioId,
      acao,
      detalhes,
      criado_em: new Date().toISOString()
    };
    try {
      await supabase.from('tecnodrill_logs').insert([logItem]);
    } catch (_) {}
    this.localData.logs.push(logItem);
    this.saveLocal();
  }
}
