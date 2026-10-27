import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { DBManager, TecnodrillBarra } from '../database/db';

export interface ItemObraDiario {
  servicoId: string;
  nome: string;
  cliente: string;
  metrosHoje: number;
  receitaHoje: number;
  metaDiaria: number;
  metaBatida: boolean;
}

export interface DadosFechamentoDiario {
  dataStr: string;
  dataExtenso: string;
  horarioFechamento: string;
  totalMetrosHoje: number;
  totalReceitaHoje: number;
  acumuladoMesMetros: number;
  acumuladoMesReceita: number;
  metaMensalMetros: number;
  percentualMetaMensal: number;
  totalObrasAtivas: number;
  totalObrasComProducaoHoje: number;
  totalObrasEmAberto: number;
  obras: ItemObraDiario[];
}

export interface ConfigEmailDiario {
  ativo: boolean;
  nomeRelatorio: string;
  destinatarios: string[];
  horario: string;
  diasSemana: number[];
  ultimoEnvio?: string;
  updatedAt?: string;
}

const DEFAULT_CONFIG: ConfigEmailDiario = {
  ativo: true,
  nomeRelatorio: 'Relatório Diário de Produção & Faturamento',
  destinatarios: [
    'mauricio.maciel@jletelecom.com.br',
    'eduardo.costa@tecnodrill.com.br',
    'carlos@tecnodrill.com.br'
  ],
  horario: '19:00',
  diasSemana: [1, 2, 3, 4, 5, 6] // Seg a Sáb
};

export class RelatorioDiarioEmailService {
  /**
   * Obtém as configurações salvas de envio automático de e-mail
   */
  public static getConfigEmailDiario(): ConfigEmailDiario {
    try {
      const configPath = path.join(process.cwd(), 'data', 'tecnodrill_email_config.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('[RelatorioDiarioEmail] Erro ao ler config, usando default:', e);
    }
    return DEFAULT_CONFIG;
  }

  /**
   * Atualiza e persiste as configurações de envio automático
   */
  public static salvarConfigEmailDiario(novaConfig: Partial<ConfigEmailDiario>): ConfigEmailDiario {
    const atual = this.getConfigEmailDiario();
    const mesclada: ConfigEmailDiario = {
      ...atual,
      ...novaConfig,
      updatedAt: new Date().toISOString()
    };
    try {
      const dir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const configPath = path.join(dir, 'tecnodrill_email_config.json');
      fs.writeFileSync(configPath, JSON.stringify(mesclada, null, 2), 'utf-8');
    } catch (e) {
      console.error('[RelatorioDiarioEmail] Erro ao salvar config:', e);
    }
    return mesclada;
  }
  /**
   * Coleta dados do banco e calcula o fechamento diário focado exclusivamente em Produção e Faturamento
   */
  public static async getDadosFechamentoDiario(dataRef?: string): Promise<DadosFechamentoDiario> {
    const hoje = dataRef ? new Date(dataRef + 'T12:00:00') : new Date();
    const ano = hoje.getFullYear();
    const mesNum = hoje.getMonth() + 1;
    const diaNum = hoje.getDate();
    
    const hojeYMD = `${ano}-${String(mesNum).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}`;
    const dataFormatada = `${String(diaNum).padStart(2, '0')}/${String(mesNum).padStart(2, '0')}/${ano}`;
    
    const mesesExtenso = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const dataExtenso = `${diaNum} de ${mesesExtenso[hoje.getMonth()]} de ${ano}`;

    // Buscar dados do banco
    const servicos = await DBManager.getServicos();
    const todosFuros = await DBManager.getFuros();

    const barrasPorFuro: Record<string, TecnodrillBarra[]> = {};
    for (const f of todosFuros) {
      barrasPorFuro[f.id] = await DBManager.getBarras(f.id);
    }

    let totalMetrosHoje = 0;
    let totalReceitaHoje = 0;
    let acumuladoMesMetros = 0;
    let acumuladoMesReceita = 0;
    let metaMensalTotal = 0;

    const obrasMap = new Map<string, ItemObraDiario>();

    for (const servico of servicos) {
      const furosDoServico = todosFuros.filter(f => f.servico_id === servico.id);
      metaMensalTotal += Number(servico.metragem_prevista_total) || 500;

      const fatorFinanceiro = Number(servico.fator_financeiro) || 0.8;
      const diamDefault = Number(servico.diametro_furo_mm) || 150;
      const metaDiaria = Number(servico.meta_metros) || 54;

      for (const furo of furosDoServico) {
        const barras = barrasPorFuro[furo.id] || [];

        for (const b of barras) {
          if (b.tipo_registro === 'CAIXA' || (b.tem_caixa && !b.diametro)) continue;

          const m = b.metros !== undefined && b.metros !== null ? Number(b.metros) : 3;
          const diam = b.diametro ? String(b.diametro).replace(/[^\d.]/g, '') : String(diamDefault);
          const diamNum = parseFloat(diam) || diamDefault;

          // Cálculo do valor unitário por metro conforme cenário financeiro
          let vMetro = 0;
          if (servico.cenario_financeiro === 'VALOR_METRO') {
            vMetro = Number(servico.valor_metro) || 0;
          } else if (servico.cenario_financeiro === 'FATOR_DIAMETRO_METRO') {
            vMetro = fatorFinanceiro * diamNum;
          } else if (servico.cenario_financeiro === 'VALOR_FECHADO') {
            const totPrev = Number(servico.metragem_prevista_total) || 1;
            vMetro = totPrev > 0 ? (Number(servico.valor_total_fechado) || 0) / totPrev : 0;
          } else {
            vMetro = Number(servico.valor_metro) || (fatorFinanceiro * diamNum);
          }

          const receitaLance = m * vMetro;

          // Verificação da data da barra
          let dataBarraYMD = '';
          const bAny = b as any;

          // 1. Extrair data_referencia dos metadados da observação <!--BARRA_META:{...}-->
          if (b.observacao && b.observacao.includes('BARRA_META:')) {
            const match = b.observacao.match(/<!--BARRA_META:(.*?)-->/);
            if (match) {
              try {
                const meta = JSON.parse(match[1]);
                if (meta.data_referencia) {
                  dataBarraYMD = String(meta.data_referencia).trim();
                } else if (meta.mes_referencia) {
                  dataBarraYMD = `${meta.mes_referencia}-01`;
                }
              } catch (_) {}
            }
          }

          // 2. Extrair de campos diretos se não encontrou nos metadados
          if (!dataBarraYMD) {
            const raw = bAny.data_referencia || b.horario_registro || bAny.data_registro || bAny.created_at;
            if (raw) {
              if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
                dataBarraYMD = raw.slice(0, 10);
              } else {
                const dObj = new Date(raw);
                if (!isNaN(dObj.getTime())) {
                  dataBarraYMD = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
                }
              }
            }
          }

          // 3. Fallback para data_furo
          if (!dataBarraYMD && furo.data_furo) {
            dataBarraYMD = furo.data_furo.slice(0, 10);
          }

          // Acumulado do Mês (todas as barras do mês e ano de referência)
          if (dataBarraYMD) {
            const [bAno, bMes] = dataBarraYMD.split('-').map(Number);
            if (bAno === ano && bMes === mesNum) {
              acumuladoMesMetros += m;
              acumuladoMesReceita += receitaLance;
            }
          }

          // Se for produção do dia
          if (dataBarraYMD === hojeYMD) {
            totalMetrosHoje += m;
            totalReceitaHoje += receitaLance;

            if (!obrasMap.has(servico.id)) {
              obrasMap.set(servico.id, {
                servicoId: servico.id,
                nome: servico.nome,
                cliente: servico.cliente,
                metrosHoje: 0,
                receitaHoje: 0,
                metaDiaria,
                metaBatida: false
              });
            }

            const itemObra = obrasMap.get(servico.id)!;
            itemObra.metrosHoje += m;
            itemObra.receitaHoje += receitaLance;
          }
        }
      }
    }

    // Avaliar status de metas
    for (const item of obrasMap.values()) {
      item.metaBatida = item.metrosHoje >= item.metaDiaria && item.metaDiaria > 0;
    }

    const pctMetaMensal = metaMensalTotal > 0 ? (acumuladoMesMetros / metaMensalTotal) * 100 : 0;
    const totalObrasEmAberto = servicos.filter(s => s.status !== 'CONCLUIDO').length || servicos.length;
    const totalObrasComProducaoHoje = obrasMap.size;

    return {
      dataStr: dataFormatada,
      dataExtenso,
      horarioFechamento: '19:00h',
      totalMetrosHoje: Math.round(totalMetrosHoje * 10) / 10,
      totalReceitaHoje: Math.round(totalReceitaHoje * 100) / 100,
      acumuladoMesMetros: Math.round(acumuladoMesMetros * 10) / 10,
      acumuladoMesReceita: Math.round(acumuladoMesReceita * 100) / 100,
      metaMensalMetros: metaMensalTotal,
      percentualMetaMensal: Math.round(pctMetaMensal),
      totalObrasAtivas: totalObrasComProducaoHoje,
      totalObrasComProducaoHoje,
      totalObrasEmAberto,
      obras: Array.from(obrasMap.values()).sort((a, b) => b.metrosHoje - a.metrosHoje)
    };
  }

  /**
   * Constrói o HTML responsivo oficial simplificado (sem custos, OS, diâmetros, equipes ou ocorrências)
   */
  public static gerarHtmlEmailDiario(dados: DadosFechamentoDiario): string {
    const obrasRows = dados.obras.length === 0
      ? `<tr><td colspan="6" style="padding: 24px; text-align: center; color: #64748B;">Nenhuma produção lançada nesta data até o momento.</td></tr>`
      : dados.obras.map(o => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; color: #1E293B;">
            <strong>${o.nome}</strong>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; color: #64748B;">
            ${o.cliente}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 700; color: #F05A22; font-size: 13px; white-space: nowrap;">
            ${o.metrosHoje.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 700; color: #2ECC71; font-size: 13px; white-space: nowrap;">
            ${o.receitaHoje.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #64748B; white-space: nowrap;">
            ${o.metaDiaria} m
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: center; white-space: nowrap;">
            <span style="background: ${o.metaBatida ? '#ECFDF5' : '#FFFBEB'}; color: ${o.metaBatida ? '#059669' : '#D97706'}; border: 1px solid ${o.metaBatida ? '#A7F3D0' : '#FDE68A'}; padding: 3px 8px; border-radius: 4px; font-size: 10.5px; font-weight: 700; white-space: nowrap;">
              ${o.metaBatida ? 'Meta Batida' : 'Em Andamento'}
            </span>
          </td>
        </tr>
      `).join('');

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TecnoDrill INFRA - Relatório Diário de Produção</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0F1215; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; -webkit-font-smoothing: antialiased;">

  <div style="max-width: 660px; margin: 20px auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.3);">
    
    <!-- CABEÇALHO COM IDENTIDADE TECNODRILL -->
    <div style="background: linear-gradient(135deg, #161B22 0%, #0F1215 100%); padding: 26px 32px; border-bottom: 4px solid #F05A22;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td>
            <div style="color: #FFFFFF; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
              Tecno<span style="color: #F05A22;">Drill</span> <span style="font-size: 14px; font-weight: 400; color: #94A3B8;">INFRA</span>
            </div>
            <div style="color: #94A3B8; font-size: 11.5px; margin-top: 3px;">
              Inteligência Operacional & Perfuração Não Destrutiva
            </div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <div style="color: #F8FAFC; font-size: 13.5px; font-weight: 700; letter-spacing: 0.2px;">
              ${dados.dataExtenso}
            </div>
            <div style="color: #F05A22; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px;">
              Fechamento Diário • ${dados.horarioFechamento}
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- TÍTULO -->
    <div style="padding: 24px 32px 10px;">
      <h2 style="margin: 0 0 6px 0; font-size: 20px; color: #161B22; font-weight: 800;">
        Relatório Diário de Produção & Faturamento
      </h2>
      <p style="margin: 0; color: #64748B; font-size: 13.5px; line-height: 1.5;">
        Fechamento consolidado das obras em <strong>${dados.dataExtenso}</strong>.
      </p>
    </div>

    <!-- 4 CARDS DE INDICADORES CHAVE -->
    <div style="padding: 14px 32px;">
      <table style="width: 100%; border-collapse: separate; border-spacing: 10px;">
        <tr>
          <td style="background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 10px; padding: 16px; text-align: left; vertical-align: top; width: 50%;">
            <div style="font-size: 11px; font-weight: 700; color: #C2410C; text-transform: uppercase; letter-spacing: 0.5px;">Metros Perfurados Hoje</div>
            <div style="font-size: 26px; font-weight: 800; color: #EA580C; margin: 2px 0 4px; white-space: nowrap;">
              ${dados.totalMetrosHoje.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} m
            </div>
            <div style="font-size: 11.5px; color: #10B981; font-weight: 600;">Produção consolidada do dia</div>
          </td>
          <td style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; text-align: left; vertical-align: top; width: 50%;">
            <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Receita Estimada (Hoje)</div>
            <div style="font-size: 26px; font-weight: 800; color: #2ECC71; margin: 2px 0 4px; white-space: nowrap;">
              ${dados.totalReceitaHoje.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <div style="font-size: 11.5px; color: #059669; font-weight: 600; white-space: nowrap;">
              Acumulado no mês: ${dados.acumuladoMesReceita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </td>
        </tr>
        <tr>
          <td style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; text-align: left; vertical-align: top; width: 50%;">
            <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Acumulado no Mês</div>
            <div style="font-size: 24px; font-weight: 800; color: #0F1215; margin: 2px 0 4px; white-space: nowrap;">
              ${dados.acumuladoMesMetros.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} m
            </div>
            <div style="font-size: 11.5px; color: #2563EB; font-weight: 600;">${dados.percentualMetaMensal}% da meta mensal atingida</div>
          </td>
          <td style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; text-align: left; vertical-align: top; width: 50%;">
            <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Frentes de Obra</div>
            <div style="font-size: 24px; font-weight: 800; color: #0F1215; margin: 2px 0 4px; white-space: nowrap;">
              ${dados.totalObrasComProducaoHoje} Obras Hoje
            </div>
            <div style="font-size: 11.5px; color: #64748B; font-weight: 600;">de um total de ${dados.totalObrasEmAberto} obras</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- TABELA DE OBRAS -->
    <div style="padding: 18px 32px 10px; font-size: 14px; font-weight: 800; color: #161B22; text-transform: uppercase; letter-spacing: 0.5px;">
      Produção por Obra no Dia
    </div>

    <div style="padding: 0 32px 24px;">
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; font-size: 12.5px;">
        <thead>
          <tr style="background-color: #161B22; color: #FFFFFF;">
            <th style="padding: 11px 12px; font-weight: 700; text-align: left; font-size: 11px; text-transform: uppercase;">Obra / Serviço</th>
            <th style="padding: 11px 12px; font-weight: 700; text-align: left; font-size: 11px; text-transform: uppercase;">Cliente</th>
            <th style="padding: 11px 12px; font-weight: 700; text-align: right; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Metros Hoje</th>
            <th style="padding: 11px 12px; font-weight: 700; text-align: right; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Receita (R$)</th>
            <th style="padding: 11px 12px; font-weight: 700; text-align: center; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Meta Diária</th>
            <th style="padding: 11px 12px; font-weight: 700; text-align: center; font-size: 11px; text-transform: uppercase; white-space: nowrap;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${obrasRows}
          <tr style="background-color: #F05A22; color: #FFFFFF; font-weight: 800;">
            <td colspan="2" style="padding: 12px;">TOTAL GERAL DO DIA</td>
            <td style="text-align: right; font-size: 14px; padding: 12px; white-space: nowrap;">${dados.totalMetrosHoje.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} m</td>
            <td style="text-align: right; font-size: 14px; padding: 12px; white-space: nowrap;">${dados.totalReceitaHoje.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td colspan="2" style="text-align: center; padding: 12px; white-space: nowrap;">100% OK</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- BOTÃO DE ACESSO AO PORTAL -->
    <div style="padding: 24px 32px 32px; text-align: center; background: #F8FAFC; border-top: 1px solid #E2E8F0;">
      <p style="margin: 0 0 14px 0; font-size: 13px; color: #64748B;">
        Para consultar os detalhes completos e baixar as planilhas de medição em Excel:
      </p>
      <a href="https://tecnodrill-66l8.vercel.app" style="display: inline-block; background-color: #F05A22; color: #FFFFFF !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 800; font-size: 13.5px; letter-spacing: 0.3px; box-shadow: 0 4px 12px rgba(240, 90, 34, 0.3);" target="_blank">
        Acessar BI TecnoDrill INFRA →
      </a>
    </div>

    <!-- RODAPÉ CORPORATIVO -->
    <div style="padding: 20px 32px; text-align: center; background-color: #0F1215; color: #64748B; font-size: 11px; line-height: 1.6;">
      Relatório diário gerado automaticamente pelo <strong>TecnoDrill INFRA</strong>.<br>
      Horário de consolidação diária: 19h00 (Horário de Brasília).
    </div>

  </div>

</body>
</html>
    `;
  }

  /**
   * Envia o relatório de produção por e-mail para a lista de destinatários
   */
  public static async enviarRelatorioEmail(
    destinatarios?: string[],
    dataRef?: string
  ): Promise<{ sucesso: boolean; mensagem: string; destinatarios: string[]; dados: DadosFechamentoDiario }> {
    const dados = await this.getDadosFechamentoDiario(dataRef);
    const html = this.gerarHtmlEmailDiario(dados);

    // Destinatários padrão da diretoria e gestão
    const configAtual = this.getConfigEmailDiario();
    const listaDestinatarios = destinatarios && destinatarios.length > 0
      ? destinatarios
      : (configAtual.destinatarios && configAtual.destinatarios.length > 0
          ? configAtual.destinatarios
          : (process.env.REPORT_RECIPIENTS || 'mauricio.maciel@jletelecom.com.br,eduardo.costa@tecnodrill.com.br,carlos@tecnodrill.com.br')
              .split(',')
              .map(e => e.trim())
              .filter(Boolean));

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || '"TecnoDrill INFRA" <relatorios@tecnodrill.com.br>';

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });

        await transporter.sendMail({
          from: smtpFrom,
          to: listaDestinatarios.join(', '),
          subject: `📊 Relatório Diário TecnoDrill - ${dados.dataStr} (${dados.totalMetrosHoje.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}m - ${dados.totalReceitaHoje.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`,
          html
        });

        this.salvarConfigEmailDiario({ ultimoEnvio: new Date().toISOString() });

        return {
          sucesso: true,
          mensagem: `E-mail diário enviado com sucesso para ${listaDestinatarios.length} destinatário(s).`,
          destinatarios: listaDestinatarios,
          dados
        };
      } catch (err: any) {
        console.error('[RelatorioDiarioEmail] Erro ao enviar SMTP:', err);
        return {
          sucesso: false,
          mensagem: `Falha no envio SMTP: ${err.message || 'Erro desconhecido'}`,
          destinatarios: listaDestinatarios,
          dados
        };
      }
    } else {
      console.log(`[RelatorioDiarioEmail] Modo simulação ativo. E-mail gerado para:`, listaDestinatarios);
      return {
        sucesso: true,
        mensagem: `Relatório diário gerado com sucesso para ${listaDestinatarios.length} destinatário(s) (modo pré-visualização ativo; configure SMTP_HOST para envio em produção).`,
        destinatarios: listaDestinatarios,
        dados
      };
    }
  }
}
