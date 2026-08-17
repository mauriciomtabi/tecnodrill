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
}

// Reverse Geocode using Nominatim / OpenStreetMap
export const reverseGeocode = async (lat: number, lon: number): Promise<AddressDetails | null> => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`, {
      headers: { 'Accept-Language': 'pt-BR' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};

    return {
      road: addr.road || addr.street || addr.avenue || addr.pedestrian || '',
      houseNumber: addr.house_number || '',
      neighbourhood: addr.suburb || addr.neighbourhood || addr.city_district || '',
      city: addr.city || addr.town || addr.municipality || addr.village || '',
      state: addr.state || ''
    };
  } catch (err) {
    return null;
  }
};

// Draw TecnoDrill official watermark on canvas (exact JLE style, no technician name)
export const applyTecnodrillWatermark = (
  base64Src: string,
  lat: number | null,
  lon: number | null,
  addrDetails: AddressDetails | null,
  originalDate?: Date
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
    logo.src = '/logo.png';

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
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Src);
        return;
      }

      // 1. Draw base photo
      ctx.drawImage(img, 0, 0);

      // 2. Format Date and Dimensions
      const dateStr = formatWatermarkDate(originalDate || new Date());
      const fontSize = Math.max(16, Math.round(img.height * 0.032));
      ctx.font = `bold ${fontSize}px Arial, "Helvetica Neue", Helvetica, sans-serif`;

      const padding = Math.round(fontSize * 1.2);
      const lineSpacing = Math.round(fontSize * 0.28);

      const lines: string[] = [];

      // Date & Time
      lines.push(dateStr);

      // DMS GPS Coordinates
      if (lat != null && lon != null) {
        const latDMS = decToDMSForWatermark(lat, true);
        const lonDMS = decToDMSForWatermark(lon, false);
        lines.push(`${latDMS} ${lonDMS}`);
      }

      // Address lines
      if (addrDetails) {
        if (addrDetails.road) {
          const streetLine = addrDetails.houseNumber && addrDetails.houseNumber !== 'S/N'
            ? `${addrDetails.road}, ${addrDetails.houseNumber}`
            : addrDetails.road;
          lines.push(streetLine);
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

      // 3. Draw Bottom-Right Stacked Text (Right-aligned, white with black outline)
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.20));
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';

      let currentY = img.height - padding;
      const reversedLines = [...lines].reverse();

      reversedLines.forEach((line) => {
        ctx.strokeText(line, img.width - padding, currentY);
        ctx.fillText(line, img.width - padding, currentY);
        currentY -= (fontSize + lineSpacing);
      });

      // 4. Draw TecnoDrill Logo in Top-Right Corner
      if (logoLoaded) {
        const logoHeight = Math.round(fontSize * 1.8);
        const logoWidth = Math.round(logo.width * (logoHeight / logo.height));

        const logoX = img.width - padding - logoWidth;
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

        const brandText = 'TecnoDrill INFRA';
        ctx.strokeText(brandText, img.width - padding, padding);
        ctx.fillText(brandText, img.width - padding, padding);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.88));
    }
  });
};
