import { Router, Request, Response } from 'express';
import { DBManager } from '../database/db';
import { FinanceiroService } from '../services/financeiroService';

const router = Router();

// GET /api/furos/:furoId/barras
router.get('/furos/:furoId/barras', async (req: Request, res: Response): Promise<any> => {
  try {
    const barras = await DBManager.getBarras(req.params.furoId);
    return res.json(barras);
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao buscar barras do furo.' });
  }
});

// POST /api/furos/:furoId/barras (Apontamento da haste de 3 metros com validação de meta festiva)
router.post('/furos/:furoId/barras', async (req: Request, res: Response): Promise<any> => {
  try {
    const { furoId } = req.params;
    const { 
      numero_barra, 
      tipo_registro,
      metros, 
      diametro,
      numero_os,
      tem_caixa, 
      tipo_caixa, 
      observacao, 
      foto_url, 
      fotos,
      angulo_pitch, 
      profundidade_cm, 
      distancia_pista_cm,
      latitude, 
      longitude, 
      endereco,
      registrado_por 
    } = req.body;

    const furo = await DBManager.getFuroById(furoId);
    if (!furo) return res.status(404).json({ error: 'Furo não encontrado.' });

    const servico = await DBManager.getServicoById(furo.servico_id);

    const isCaixa = tipo_registro === 'CAIXA' || Boolean(tem_caixa && !diametro);
    const metrosNumerico = isCaixa ? 0 : (metros !== undefined ? Number(metros) : 3);

    // Deduplica lista de fotos para garantir que nunca sejam gravadas duplicadas
    const rawFotos = Array.isArray(fotos) ? fotos : (foto_url ? [foto_url] : []);
    const cleanFotos: string[] = [];
    const seenFotoKeys = new Set<string>();
    for (const f of rawFotos) {
      if (!f || typeof f !== 'string') continue;
      const key = f.length > 500 ? (f.length + '_' + f.slice(0, 150) + '_' + f.slice(-100)) : f;
      if (!seenFotoKeys.has(key) && !cleanFotos.includes(f)) {
        seenFotoKeys.add(key);
        cleanFotos.push(f);
      }
    }

    const minFotosExigidas = (servico?.min_fotos_registro !== undefined && servico?.min_fotos_registro !== null && Number(servico.min_fotos_registro) > 0)
      ? Number(servico.min_fotos_registro)
      : 2;

    if (cleanFotos.length < minFotosExigidas) {
      return res.status(400).json({
        error: `Este serviço exige no mínimo ${minFotosExigidas} foto(s) para registrar. Você enviou ${cleanFotos.length}.`
      });
    }

    // Adiciona o novo registro de campo
    const novaBarra = await DBManager.addBarra({
      furo_id: furoId,
      numero_barra: numero_barra ? Number(numero_barra) : undefined,
      tipo_registro: isCaixa ? 'CAIXA' : (tipo_registro || 'CANALIZACAO'),
      metros: metrosNumerico,
      diametro: isCaixa ? '' : (diametro || ''),
      numero_os: numero_os || '',
      tem_caixa: Boolean(tem_caixa || isCaixa),
      tipo_caixa: tipo_caixa || '',
      observacao: observacao || '',
      foto_url: cleanFotos.length > 0 ? cleanFotos[0] : (foto_url || ''),
      fotos: cleanFotos,
      angulo_pitch: angulo_pitch || '+0.00',
      profundidade_cm: profundidade_cm !== undefined ? Number(profundidade_cm) : undefined,
      distancia_pista_cm: distancia_pista_cm !== undefined ? Number(distancia_pista_cm) : undefined,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      endereco: endereco || undefined,
      registrado_por
    });

    // Validar se atingiu ou superou a meta diária/semanal NO MOMENTO DESTE REGISTRO
    let metaAtingidaAgora = false;
    let percentualAtingido = 0;
    let metaInfo: any = null;

    if (servico && Number(servico.meta_metros) > 0 && !isCaixa) {
      const dashboard = await FinanceiroService.getDashboardMetrics();
      const metric = dashboard.servicos.find(m => m.servicoId === servico.id);
      if (metric) {
        metaInfo = metric.meta;
        percentualAtingido = metric.meta.percentualMetaPeriodo;
        const metaValor = metric.meta.valorMetaMetros;
        const metrosDepois = metric.meta.metrosPeriodoAtual;
        const metrosAntes = metrosDepois - (Number(novaBarra.metros) || 0);

        // Só celebra se ANTES não tinha batido a meta e AGORA bateu!
        if (metaValor > 0 && metrosAntes < metaValor && metrosDepois >= metaValor) {
          metaAtingidaAgora = true;
        }
      }
    }

    return res.status(201).json({
      barra: novaBarra,
      celebrarMeta: metaAtingidaAgora,
      metaInfo,
      mensagem: isCaixa
        ? `Instalação de Caixa #${novaBarra.numero_barra} registrada com sucesso.`
        : (metaAtingidaAgora
            ? `🎉 PARABÉNS EQUIPE! Meta ${servico?.tipo_meta.toLowerCase() || 'diária'} de ${servico?.meta_metros}m atingida com sucesso!`
            : `Registro Nº ${novaBarra.numero_barra} (+${novaBarra.metros}m) registrado com sucesso.`)
    });
  } catch (err: any) {
    console.error('[Barras POST] Erro:', err);
    return res.status(500).json({ error: 'Erro ao registrar haste de perfuração.' });
  }
});

// DELETE /api/barras/:id
router.delete('/barras/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    await DBManager.deleteBarra(req.params.id);
    return res.json({ success: true, message: 'Barra excluída com sucesso.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao excluir barra.' });
  }
});

export default router;
