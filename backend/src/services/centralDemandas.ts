/**
 * centralDemandas.ts
 * Módulo de integração do App_Tecnodrill com a Central de Demandas Operacional JLE & Tecnodrill.
 * Envia apontamentos de perfuração, ordens de serviço e manutenções em tempo real.
 */

export interface DemandaTecnodrillPayload {
  titulo: string;
  setor?: string;
  uf?: 'RS' | 'SC' | 'PR';
  tipo?: 'Operação' | 'Incidente' | 'Solicitação' | 'Manutenção';
  prioridade?: 'Baixa' | 'Normal' | 'Alta' | 'Crítica';
  equipamento?: string;
  obra?: string;
  detalhes?: string;
}

export async function notificarCentralTecnodrill(dados: DemandaTecnodrillPayload) {
  const centralUrl = process.env.CENTRAL_DEMANDAS_URL || 'http://localhost:8080/api/webhook/novo-chamado';

  const body = {
    title: dados.titulo,
    sector: dados.setor || 'Engenharia',
    station: 'Tecnodrill',
    uf: dados.uf || 'RS',
    kind: dados.tipo || 'Operação',
    priority: dados.prioridade || 'Normal',
    origem: 'App_Tecnodrill',
    description: dados.detalhes || `Equipamento: ${dados.equipamento || 'N/A'} | Obra: ${dados.obra || 'N/A'}`
  };

  try {
    const res = await fetch(centralUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`[CentralDemandas] Apontamento Tecnodrill ${data.ticket?.id || ''} transmitido com sucesso!`);
      return data;
    } else {
      console.warn(`[CentralDemandas] Resposta do webhook: ${res.status}`);
      return null;
    }
  } catch (err: any) {
    console.warn(`[CentralDemandas] Central offline ou inacessível (${err?.message || err})`);
    return null;
  }
}
