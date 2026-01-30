import axios from 'axios';

export type WhatsappTemplateSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string; details?: any };

function normalizeToE164DigitsOnly(mobileNumber: string, defaultCountryCode: string): string {
  const digits = String(mobileNumber || '').replace(/\D/g, '');
  if (!digits) return digits;

  // If already looks like a country-code prefixed number (>= 11 digits), keep as-is.
  if (digits.length >= 11) return digits;

  // If local (e.g. 10 digits in India), prefix default country code.
  const cc = String(defaultCountryCode || '').replace(/\D/g, '') || '91';
  return `${cc}${digits}`;
}

/**
 * Upload a media file (PDF, image, etc.) to WhatsApp to get a media_id for use in templates.
 * Returns the media_id on success.
 */
export async function uploadWhatsappMedia(params: {
  fileUrl: string;
  mimeType: string; // e.g., 'application/pdf', 'image/jpeg'
  phoneNumberId?: string;
  accessToken?: string;
}): Promise<{ ok: true; mediaId: string } | { ok: false; error: string; details?: any }> {
  const phoneNumberId = params.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = params.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId) return { ok: false, error: 'WHATSAPP_PHONE_NUMBER_ID not configured' };
  if (!accessToken) return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN not configured' };

  try {
    // First, download the file from the URL
    const fileResponse = await axios.get(params.fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const fileBuffer = Buffer.from(fileResponse.data);

    // Upload to WhatsApp Media API
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/media`;
    
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', params.mimeType);
    formData.append('file', fileBuffer, {
      filename: params.mimeType === 'application/pdf' ? 'document.pdf' : 'file',
      contentType: params.mimeType,
    });

    const resp = await axios.post(url, formData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...formData.getHeaders(),
      },
      timeout: 30000,
    });

    const mediaId = resp?.data?.id;
    if (!mediaId) {
      return { ok: false, error: 'No media_id returned from WhatsApp', details: resp.data };
    }

    return { ok: true, mediaId };
  } catch (e: any) {
    const details = e?.response?.data;
    const msg = e?.message || 'WhatsApp media upload failed';
    console.error('[WhatsApp] Media upload error:', msg, details);
    return { ok: false, error: msg, details };
  }
}

/**
 * Send reporter ID card PDF via WhatsApp using the "send_idcard_reporter" template.
 * Template structure:
 * - HEADER: DOCUMENT (PDF attachment)
 * - BODY: "Thank you for using your {{1}} card at {{2}}. Your {{3}} is attached as a PDF."
 *   - {{1}}: card type (e.g., "Reporter ID")
 *   - {{2}}: organization name (e.g., "Kaburlu Today")
 *   - {{3}}: document type (e.g., "ID Card")
 */
export async function sendWhatsappIdCardTemplate(params: {
  toMobileNumber: string;
  pdfUrl: string;
  cardType?: string; // {{1}} - default: "Reporter ID"
  organizationName: string; // {{2}} - e.g., "Kaburlu Today"
  documentType?: string; // {{3}} - default: "ID Card"
  pdfFilename?: string; // Filename shown in WhatsApp
  templateName?: string;
  templateLang?: string;
  defaultCountryCode?: string;
  phoneNumberId?: string;
  accessToken?: string;
}): Promise<WhatsappTemplateSendResult> {
  const phoneNumberId = params.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = params.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId) return { ok: false, error: 'WHATSAPP_PHONE_NUMBER_ID not configured' };
  if (!accessToken) return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN not configured' };
  if (!params.pdfUrl) return { ok: false, error: 'PDF URL is required' };

  const templateName = params.templateName || process.env.WHATSAPP_IDCARD_TEMPLATE_NAME || 'send_idcard_reporter';
  const templateLang = params.templateLang || process.env.WHATSAPP_IDCARD_TEMPLATE_LANG || 'en_US';
  const defaultCountryCode = params.defaultCountryCode || process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91';

  const to = normalizeToE164DigitsOnly(params.toMobileNumber, defaultCountryCode);
  if (!to) return { ok: false, error: 'Invalid toMobileNumber' };

  // First, upload the PDF to WhatsApp to get media_id
  console.log('[WhatsApp] Uploading ID card PDF to WhatsApp media API...');
  const uploadResult = await uploadWhatsappMedia({
    fileUrl: params.pdfUrl,
    mimeType: 'application/pdf',
    phoneNumberId,
    accessToken,
  });

  if (!uploadResult.ok) {
    return { ok: false, error: `Failed to upload PDF: ${uploadResult.error}`, details: uploadResult.details };
  }

  const mediaId = uploadResult.mediaId;
  console.log('[WhatsApp] PDF uploaded, media_id:', mediaId);

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const cardType = params.cardType || 'Reporter ID';
  const documentType = params.documentType || 'ID Card';
  const pdfFilename = params.pdfFilename || 'Reporter_ID_Card.pdf';

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'document',
              document: {
                id: mediaId,
                filename: pdfFilename,
              },
            },
          ],
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(cardType) },
            { type: 'text', text: String(params.organizationName) },
            { type: 'text', text: String(documentType) },
          ],
        },
      ],
    },
  };

  try {
    console.log('[WhatsApp] Sending ID card template to:', to);
    const resp = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    const messageId = resp?.data?.messages?.[0]?.id;
    console.log('[WhatsApp] ID card sent successfully, message_id:', messageId);
    return { ok: true, messageId };
  } catch (e: any) {
    const details = e?.response?.data;
    const msg = e?.message || 'WhatsApp send failed';
    console.error('[WhatsApp] ID card send error:', msg, details);
    return { ok: false, error: msg, details };
  }
}

export async function sendWhatsappOtpTemplate(params: {
  toMobileNumber: string;
  otp: string;
  purpose: string;
  ttlText: string;
  supportMobile: string;
  templateName?: string;
  templateLang?: string;
  defaultCountryCode?: string;
  phoneNumberId?: string;
  accessToken?: string;
}): Promise<WhatsappTemplateSendResult> {
  const phoneNumberId = params.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = params.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId) return { ok: false, error: 'WHATSAPP_PHONE_NUMBER_ID not configured' };
  if (!accessToken) return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN not configured' };

  const templateName = params.templateName || process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'kaburlu_app_otp';
  const templateLang = params.templateLang || process.env.WHATSAPP_OTP_TEMPLATE_LANG || 'en_US';
  const defaultCountryCode = params.defaultCountryCode || process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91';

  const to = normalizeToE164DigitsOnly(params.toMobileNumber, defaultCountryCode);
  if (!to) return { ok: false, error: 'Invalid toMobileNumber' };

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  // NOTE:
  // - The button URL base (e.g. https://kaburlumedia.com/otp/{{1}}) MUST be set in the approved template.
  // - Here we only provide the replacement value for {{1}}.
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(params.otp) },
            { type: 'text', text: String(params.purpose) },
            { type: 'text', text: String(params.ttlText) },
            { type: 'text', text: String(params.supportMobile) },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: 0,
          parameters: [{ type: 'text', text: String(params.otp) }],
        },
      ],
    },
  };

  try {
    const resp = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    const messageId = resp?.data?.messages?.[0]?.id;
    return { ok: true, messageId };
  } catch (e: any) {
    const details = e?.response?.data;
    const msg = e?.message || 'WhatsApp send failed';
    return { ok: false, error: msg, details };
  }
}
