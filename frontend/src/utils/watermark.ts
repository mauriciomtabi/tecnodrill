// Helper function to format decimal degrees into DMS (Degrees, Minutes, Seconds)
export const decToDMSForWatermark = (deg: number, isLat: boolean): string => {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = (minutesNotTruncated - minutes) * 60;

  // Format seconds with 3 decimal places using comma as separator
  const secFormatted = seconds.toFixed(3).replace('.', ',');
  const hemisphere = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');

  return `${degrees}°${minutes}'${secFormatted}"${hemisphere}`;
};

// Helper function to format Portuguese date
export const formatWatermarkDate = (d: Date): string => {
  const months = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  const day = d.getDate();
  const monthStr = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${day} de ${monthStr} de ${year} ${hours}:${minutes}:${seconds}`;
};

export interface AddressDetails {
  road?: string;
  houseNumber?: string;
  neighbourhood?: string;
  city?: string;
  state?: string;
  formattedAddress?: string;
}

// In-memory cache for reverse geocoding to prevent duplicate network calls
const geocodeCache = new Map<string, AddressDetails>();

const getCacheKey = (lat: number, lon: number): string => {
  // Round to ~4 decimals (approx 11m precision) for cache hits
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
};

/**
 * Format full address into a clean single string for UI details and database storage
 * Example: "Avenida Imperatriz Dona Leopoldina, 2262 - Pinheiros, São Leopoldo - RS"
 */
export const formatFullAddress = (addr?: AddressDetails | null): string => {
  if (!addr) return '';

  const parts: string[] = [];

  // Street + number
  if (addr.road) {
    const street = addr.houseNumber && addr.houseNumber !== 'S/N'
      ? `${addr.road}, ${addr.houseNumber}`
      : addr.road;
    parts.push(street);
  }

  // Neighbourhood
  if (addr.neighbourhood && addr.neighbourhood !== addr.city && addr.neighbourhood !== addr.road) {
    parts.push(addr.neighbourhood);
  }

  // City + State
  if (addr.city && addr.state) {
    parts.push(`${addr.city} - ${addr.state}`);
  } else if (addr.city) {
    parts.push(addr.city);
  } else if (addr.state) {
    parts.push(addr.state);
  }

  return parts.join(' - ');
};

/**
 * Robust reverse geocoding with multi-provider fallback and caching
 */
export const reverseGeocode = async (lat: number, lon: number): Promise<AddressDetails | null> => {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return null;
  }

  const cacheKey = getCacheKey(lat, lon);
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // Provider 1: Backend Geocode Proxy (uses official User-Agent, robust caching and zero CORS)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.road || data.city || data.state || data.neighbourhood) {
        const details: AddressDetails = {
          road: data.road || '',
          houseNumber: data.houseNumber || '',
          neighbourhood: data.neighbourhood || '',
          city: data.city || '',
          state: data.state || ''
        };
        details.formattedAddress = formatFullAddress(details);
        geocodeCache.set(cacheKey, details);
        return details;
      }
    }
  } catch (err) {
    // Try direct providers if backend route is unavailable or offline
  }

  // Provider 2: OpenStreetMap Nominatim Direct
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
      {
        headers: { 'Accept-Language': 'pt-BR' },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};

      const road = addr.road || addr.street || addr.avenue || addr.pedestrian || addr.footway || addr.highway || addr.residential || addr.path || '';
      const houseNumber = addr.house_number || addr.street_number || '';
      const neighbourhood = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || addr.district || addr.borough || '';
      const city = addr.city || addr.town || addr.municipality || addr.village || addr.county || addr.city_district || '';
      const state = addr.state || addr.state_district || addr.province || '';

      if (road || city || state || neighbourhood) {
        const details: AddressDetails = {
          road,
          houseNumber,
          neighbourhood,
          city,
          state
        };
        details.formattedAddress = formatFullAddress(details);
        geocodeCache.set(cacheKey, details);
        return details;
      }
    }
  } catch (err) {
    // Fail silently and try fallback provider
  }

  // Provider 3 Fallback: BigDataCloud Client Reverse Geocoding API (Fast, Free, CORS-friendly)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const road = data.street || data.localityInfo?.administrative?.[3]?.name || '';
      const neighbourhood = data.locality || data.localityInfo?.administrative?.[2]?.name || '';
      const city = data.city || data.localityInfo?.administrative?.[1]?.name || '';
      const state = data.principalSubdivision || '';

      if (road || city || state || neighbourhood) {
        const details: AddressDetails = {
          road,
          houseNumber: '',
          neighbourhood,
          city,
          state
        };
        details.formattedAddress = formatFullAddress(details);
        geocodeCache.set(cacheKey, details);
        return details;
      }
    }
  } catch (err) {
    // Both failed
  }

  return null;
};

// Draw TecnoDrill official watermark on canvas (exact JLE style, no technician name)
export const applyTecnodrillWatermark = (
  base64Src: string,
  lat: number | null,
  lon: number | null,
  addrDetails: AddressDetails | null,
  originalDate?: Date,
  customLogoSrc?: string | null,
  logoScale: number = 1.0
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    const logo = new Image();

    let logoLoaded = false;
    let logoFinished = false;

    logo.onload = () => {
      logoLoaded = true;
      logoFinished = true;
      checkAllLoaded();
    };
    logo.onerror = () => {
      logoFinished = true;
      checkAllLoaded();
    };
    logo.src = customLogoSrc || '/logo.png';

    let imgLoaded = false;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgLoaded = true;
      checkAllLoaded();
    };
    img.onerror = () => {
      resolve(base64Src);
    };
    img.src = base64Src;

    function checkAllLoaded() {
      if (imgLoaded && logoFinished) {
        drawWatermark();
      }
    }

    function drawWatermark() {
      // Escalonamento proporcional inteligente: limita dimensão máxima a 1600px para alto desempenho
      const MAX_DIM = 1600;
      let targetWidth = img.width;
      let targetHeight = img.height;
      if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round((targetHeight * MAX_DIM) / targetWidth);
          targetWidth = MAX_DIM;
        } else {
          targetWidth = Math.round((targetWidth * MAX_DIM) / targetHeight);
          targetHeight = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Src);
        return;
      }

      // 1. Draw base photo
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // 2. Format Date and Dimensions
      const dateStr = formatWatermarkDate(originalDate || new Date());
      const fontSize = Math.max(16, Math.round(targetHeight * 0.032));
      ctx.font = `bold ${fontSize}px Arial, "Helvetica Neue", Helvetica, sans-serif`;

      const padding = Math.round(fontSize * 1.2);
      const lineSpacing = Math.round(fontSize * 0.28);

      const lines: string[] = [];

      // Line 1: Date & Time
      lines.push(dateStr);

      // Line 2: DMS GPS Coordinates
      if (lat != null && lon != null) {
        const latDMS = decToDMSForWatermark(lat, true);
        const lonDMS = decToDMSForWatermark(lon, false);
        lines.push(`${latDMS} ${lonDMS}`);
      }

      // Address lines (Rua + Nº, Bairro, Cidade, Estado)
      if (addrDetails) {
        const street = addrDetails.road
          ? (addrDetails.houseNumber && addrDetails.houseNumber !== 'S/N'
              ? `${addrDetails.road}, ${addrDetails.houseNumber}`
              : addrDetails.road)
          : '';

        if (street) {
          lines.push(street);
        }
        if (addrDetails.neighbourhood && addrDetails.neighbourhood !== addrDetails.city) {
          lines.push(addrDetails.neighbourhood);
        }
        if (addrDetails.city) {
          lines.push(addrDetails.city);
        }
        if (addrDetails.state) {
          lines.push(addrDetails.state);
        }
      }

      // 3. Draw Bottom-Right Stacked Text (Right-aligned, white with crisp black outline)
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.20));
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;

      let currentY = targetHeight - padding;
      const reversedLines = [...lines].reverse();

      reversedLines.forEach((line) => {
        ctx.strokeText(line, targetWidth - padding, currentY);
        ctx.fillText(line, targetWidth - padding, currentY);
        currentY -= (fontSize + lineSpacing);
      });

      // 4. Draw Logo in Top-Right Corner (Client custom logo or TecnoDrill fallback)
      if (logoLoaded && logo.width > 0 && logo.height > 0) {
        const scale = Math.max(0.4, Math.min(3.0, Number(logoScale) || 1.0));
        // Base multiplier: 2.2x font size for comfortable default visibility
        const baseHeight = fontSize * 2.2 * scale;
        let logoHeight = Math.round(baseHeight);
        let logoWidth = Math.round(logo.width * (logoHeight / logo.height));

        // Limit maximum width to 45% of image width
        const maxWidth = Math.round(targetWidth * 0.45);
        if (logoWidth > maxWidth) {
          logoWidth = maxWidth;
          logoHeight = Math.round(logo.height * (logoWidth / logo.width));
        }

        // Limit maximum height to 30% of image height
        const maxHeight = Math.round(targetHeight * 0.30);
        if (logoHeight > maxHeight) {
          logoHeight = maxHeight;
          logoWidth = Math.round(logo.width * (logoHeight / logo.width));
        }

        const logoX = targetWidth - padding - logoWidth;
        const logoY = padding;

        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      } else {
        // Fallback text if logo image is unavailable
        ctx.font = `bold ${fontSize}px Arial, "Helvetica Neue", Helvetica, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.20));
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';

        const brandText = customLogoSrc ? 'CLIENTE INFRA' : 'TecnoDrill INFRA';
        ctx.strokeText(brandText, targetWidth - padding, padding);
        ctx.fillText(brandText, targetWidth - padding, padding);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.82));
    }
  });
};

/**
 * Generate a realistic sample photo preview with watermark to show how the client logo will look
 */
export const generateWatermarkPreview = async (
  customLogoSrc?: string | null,
  city: string = 'Novo Hamburgo',
  state: string = 'RS',
  logoScale: number = 1.0
): Promise<string> => {
  // Create a canvas simulating a high-res jobsite photo
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 960;
  sampleCanvas.height = 720;
  const ctx = sampleCanvas.getContext('2d');
  if (!ctx) return '';

  // Background: Realistic jobsite gradient (ground / pipe trench simulation)
  const grad = ctx.createLinearGradient(0, 0, 960, 720);
  grad.addColorStop(0, '#1c2833');
  grad.addColorStop(0.5, '#2c3e50');
  grad.addColorStop(1, '#1a252f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 960, 720);

  // Decorative trench/pipe lines for realistic context
  ctx.strokeStyle = 'rgba(240, 90, 34, 0.4)';
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.moveTo(100, 500);
  ctx.bezierCurveTo(350, 450, 600, 600, 850, 550);
  ctx.stroke();

  // Subtle grid overlay
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 960; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 720);
    ctx.stroke();
  }
  for (let y = 0; y < 720; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(960, y);
    ctx.stroke();
  }

  // Sample watermark coordinates & address
  const sampleLat = -29.6875;
  const sampleLon = -51.1311;
  const sampleAddr: AddressDetails = {
    road: 'Rua Bento Gonçalves',
    houseNumber: '1420',
    neighbourhood: 'Centro',
    city: city || 'Novo Hamburgo',
    state: state || 'RS'
  };

  const sampleBase64 = sampleCanvas.toDataURL('image/jpeg', 0.9);
  return applyTecnodrillWatermark(
    sampleBase64,
    sampleLat,
    sampleLon,
    sampleAddr,
    new Date(),
    customLogoSrc,
    logoScale
  );
};
