import QRCode from "qrcode";

/**
 * Generate an SVG string for a UPI URI.
 *
 * @param {string} upiUri
 * @param {object} options
 * @returns {Promise<string>} SVG markup
 */
export async function generateUpiQrSvg(upiUri, options = {}) {
  if (!upiUri) return "";
  try {
    return await QRCode.toString(upiUri, {
      type: "svg",
      margin: 2,
      color: {
        dark: options.darkColor || "#0f172a",
        light: options.lightColor || "#ffffff",
      },
      errorCorrectionLevel: "M",
      width: options.width || 240,
    });
  } catch (err) {
    console.error("Failed to generate UPI QR code:", err);
    throw err;
  }
}

/**
 * Generate a Data URL (base64 image) for a UPI URI.
 *
 * @param {string} upiUri
 * @param {object} options
 * @returns {Promise<string>} data:image/png;base64,...
 */
export async function generateUpiQrDataUrl(upiUri, options = {}) {
  if (!upiUri) return "";
  try {
    return await QRCode.toDataURL(upiUri, {
      margin: 2,
      color: {
        dark: options.darkColor || "#0f172a",
        light: options.lightColor || "#ffffff",
      },
      errorCorrectionLevel: "M",
      width: options.width || 240,
    });
  } catch (err) {
    console.error("Failed to generate UPI QR Data URL:", err);
    throw err;
  }
}
