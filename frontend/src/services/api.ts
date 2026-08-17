import { Usuario, Servico, Furo, Barra, DashboardGestorMetrics } from '../types';

const API_BASE = '/api';

export class ApiService {
  private static getToken(): string | null {
    return localStorage.getItem('tecnodrill_token');
  }

  public static setAuth(token: string, usuario: Usuario) {
    localStorage.setItem('tecnodrill_token', token);
    localStorage.setItem('tecnodrill_usuario', JSON.stringify(usuario));
  }

  public static getUsuarioAtual(): Usuario | null {
    const raw = localStorage.getItem('tecnodrill_usuario');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public static logout() {
    localStorage.removeItem('tecnodrill_token');
    localStorage.removeItem('tecnodrill_usuario');
  }

  private static async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...((options.headers as any) || {})
      }
    });

    if (!res.ok) {
      let errMessage = 'Erro na requisição';
      try {
        const data = await res.json();
        errMessage = data.error || data.message || errMessage;
      } catch {}
      throw new Error(errMessage);
    }

    return res.json();
  }

  // --- AUTH ---
  public static async login(identifier: string, senha: string): Promise<{ token: string; usuario: Usuario }> {
    const res = await this.request<{ token: string; usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, senha })
    });
    this.setAuth(res.token, res.usuario);
    return res;
  }

  public static async getUsuarios(): Promise<Usuario[]> {
    return this.request<Usuario[]>('/usuarios');
  }

  public static async createUsuario(data: Partial<Usuario> & { senha?: string }): Promise<Usuario> {
    return this.request<Usuario>('/usuarios', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public static async updateUsuario(id: string, data: Partial<Usuario> & { senha?: string }): Promise<Usuario> {
    return this.request<Usuario>(`/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  public static async deleteUsuario(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/usuarios/${id}`, {
      method: 'DELETE'
    });
  }

  // --- DASHBOARD & METRICS ---
  public static async getDashboard(): Promise<DashboardGestorMetrics> {
    return this.request<DashboardGestorMetrics>('/relatorios/dashboard');
  }

  // --- SERVICOS ---
  public static async getServicos(): Promise<Servico[]> {
    return this.request<Servico[]>('/servicos');
  }

  public static async getServico(id: string): Promise<Servico & { furos: Furo[] }> {
    return this.request<Servico & { furos: Furo[] }>(`/servicos/${id}`);
  }

  public static async createServico(data: Partial<Servico>): Promise<Servico> {
    return this.request<Servico>('/servicos', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public static async updateServico(id: string, data: Partial<Servico>): Promise<Servico> {
    return this.request<Servico>(`/servicos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // --- FUROS ---
  public static async getFuros(servicoId?: string): Promise<Furo[]> {
    const query = servicoId ? `?servico_id=${servicoId}` : '';
    return this.request<Furo[]>(`/furos${query}`);
  }

  public static async getFuro(id: string): Promise<Furo> {
    return this.request<Furo>(`/furos/${id}`);
  }

  public static async createFuro(data: Partial<Furo>): Promise<Furo> {
    return this.request<Furo>('/furos', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public static async updateFuro(id: string, data: Partial<Furo>): Promise<Furo> {
    return this.request<Furo>(`/furos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // --- BARRAS ---
  public static async getBarras(furoId: string): Promise<Barra[]> {
    return this.request<Barra[]>(`/furos/${furoId}/barras`);
  }

  public static async addBarra(furoId: string, data: Partial<Barra>): Promise<{
    barra: Barra;
    celebrarMeta: boolean;
    metaInfo?: any;
    mensagem: string;
  }> {
    return this.request(`/furos/${furoId}/barras`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public static async deleteBarra(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/barras/${id}`, {
      method: 'DELETE'
    });
  }

  // --- EXPORT ---
  public static getExcelUrl(furoId: string): string {
    return `${API_BASE}/relatorios/furo/${furoId}/excel`;
  }
}
