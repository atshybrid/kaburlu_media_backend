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
