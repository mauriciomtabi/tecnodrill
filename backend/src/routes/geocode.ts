import { Router, Request, Response } from 'express';

const router = Router();

const geoCache = new Map<string, any>();

// GET /api/geocode/reverse?lat=-29.7603&lon=-51.1192
router.get('/reverse', async (req: Request, res: Response): Promise<any> => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Parâmetros lat e lon são obrigatórios.' });
    }

    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (geoCache.has(cacheKey)) {
      return res.json(geoCache.get(cacheKey));
    }

    // Provider 1: OpenStreetMap Nominatim with official User-Agent
    try {
      const osmRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'pt-BR',
            'User-Agent': 'TecnoDrill-Infra-App/1.0 (contato@tecnodrill.com.br)'
          }
        }
      );

      if (osmRes.ok) {
        const data: any = await osmRes.json();
        const addr = data.address || {};

        const road = addr.road || addr.street || addr.avenue || addr.pedestrian || addr.footway || addr.highway || addr.residential || addr.path || '';
        const houseNumber = addr.house_number || addr.street_number || '';
        const neighbourhood = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || addr.district || addr.borough || '';
        const city = addr.city || addr.town || addr.municipality || addr.village || addr.county || addr.city_district || '';
        const state = addr.state || addr.state_district || addr.province || '';

        const result = {
          road,
          houseNumber,
          neighbourhood,
          city,
          state,
          formattedAddress: [
            houseNumber && road ? `${road}, ${houseNumber}` : road,
            neighbourhood && neighbourhood !== city ? neighbourhood : '',
            city && state ? `${city} - ${state}` : city || state
          ].filter(Boolean).join(' - ')
        };

        geoCache.set(cacheKey, result);
        return res.json(result);
      }
    } catch (osmErr) {
      console.warn('[Geocode Proxy] Nominatim falhou, tentando fallback:', osmErr);
    }

    // Provider 2: BigDataCloud Reverse Geocoding
    try {
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`
      );

      if (bdcRes.ok) {
        const bdcData: any = await bdcRes.json();
        const road = bdcData.street || bdcData.localityInfo?.administrative?.[3]?.name || '';
        const neighbourhood = bdcData.locality || bdcData.localityInfo?.administrative?.[2]?.name || '';
        const city = bdcData.city || bdcData.localityInfo?.administrative?.[1]?.name || '';
        const state = bdcData.principalSubdivision || '';

        const result = {
          road,
          houseNumber: '',
          neighbourhood,
          city,
          state,
          formattedAddress: [
            road,
            neighbourhood && neighbourhood !== city ? neighbourhood : '',
            city && state ? `${city} - ${state}` : city || state
          ].filter(Boolean).join(' - ')
        };

        geoCache.set(cacheKey, result);
        return res.json(result);
      }
    } catch (bdcErr) {
      console.warn('[Geocode Proxy] BigDataCloud falhou:', bdcErr);
    }

    return res.json({
      road: '',
      houseNumber: '',
      neighbourhood: '',
      city: '',
      state: '',
      formattedAddress: ''
    });
  } catch (err: any) {
    console.error('[Geocode Route Error]:', err);
    return res.status(500).json({ error: 'Erro ao processar geocodificação reversa.' });
  }
});

export default router;
