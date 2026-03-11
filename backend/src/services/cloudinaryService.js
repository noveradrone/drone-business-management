const crypto = require("crypto");
const {
  cloudinaryCloudName,
  cloudinaryApiKey,
  cloudinaryApiSecret,
  cloudinaryUploadPreset
} = require("../config");

const ACCEPTED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || "");
  const match = raw.match(/^data:([a-zA-Z0-9/+.-]+);base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match) return null;
  const mime = String(match[1] || "").toLowerCase();
  if (!ACCEPTED_MIME.has(mime)) return null;
  return { mime, base64: match[2].replace(/\s+/g, "") };
}

function ensureCloudinaryConfigured() {
  if (!cloudinaryCloudName) {
    throw new Error("Cloudinary non configure: CLOUDINARY_CLOUD_NAME manquant.");
  }
  if (!cloudinaryUploadPreset && (!cloudinaryApiKey || !cloudinaryApiSecret)) {
    throw new Error(
      "Cloudinary non configure: definir CLOUDINARY_UPLOAD_PRESET (unsigned) ou CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET."
    );
  }
}

function signParams(params, apiSecret) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(`${sorted}${apiSecret}`).digest("hex");
}

async function uploadImageToCloudinary(dataUrl, options = {}) {
  ensureCloudinaryConfigured();
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new Error("Format image invalide. Formats acceptes: jpg, jpeg, png, webp.");
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`;
  const form = new URLSearchParams();
  const folder = options.folder || "drone-business/thermography";
  const publicId = options.publicId || "";

  form.set("file", `data:${parsed.mime};base64,${parsed.base64}`);
  form.set("folder", folder);
  if (publicId) form.set("public_id", publicId);

  if (cloudinaryUploadPreset) {
    form.set("upload_preset", cloudinaryUploadPreset);
  } else {
    const timestamp = Math.floor(Date.now() / 1000);
    const signPayload = { folder, timestamp };
    if (publicId) signPayload.public_id = publicId;
    const signature = signParams(signPayload, cloudinaryApiSecret);
    form.set("timestamp", String(timestamp));
    form.set("api_key", cloudinaryApiKey);
    form.set("signature", signature);
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = payload?.error?.message || "Echec upload Cloudinary.";
    throw new Error(message);
  }

  return {
    secure_url: payload.secure_url,
    public_id: payload.public_id,
    width: payload.width,
    height: payload.height,
    format: payload.format
  };
}

module.exports = {
  uploadImageToCloudinary
};
