/**
 * Meta WhatsApp Business API — templates (create/list/delete) + generic template send.
 */
import axios from 'axios';
import { config } from '../config/env';

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0';

export type MetaApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: unknown };

function graphBase() {
  return `https://graph.facebook.com/${GRAPH_VERSION}`;
}

let cachedBusinessAccountId: string | null = null;

/** Resolve WABA ID from token when WHATSAPP_BUSINESS_ACCOUNT_ID is not in .env */
export async function resolveWhatsappBusinessAccountId(
  accessToken?: string,
): Promise<string | null> {
  const fromEnv =
    config.whatsapp.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
  if (fromEnv) return fromEnv;
  if (cachedBusinessAccountId) return cachedBusinessAccountId;

  const token = accessToken || config.whatsapp.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return null;

  try {
    const resp = await axios.get(`${graphBase()}/debug_token`, {
      params: { input_token: token },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    const scopes: any[] = resp.data?.data?.granular_scopes || [];
    for (const s of scopes) {
      if (
        s.scope === 'whatsapp_business_management' ||
        s.scope === 'whatsapp_business_messaging'
      ) {
        const id = Array.isArray(s.target_ids) ? s.target_ids[0] : null;
        if (id) {
          cachedBusinessAccountId = String(id);
          return cachedBusinessAccountId;
        }
      }
    }
  } catch (e: any) {
    console.warn('[WhatsApp] debug_token WABA resolve failed:', e?.message);
  }

  const phoneNumberId = config.whatsapp.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (phoneNumberId) {
    try {
      const resp = await axios.get(`${graphBase()}/${phoneNumberId}`, {
        params: { fields: 'whatsapp_business_account,account_mode' },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });
      const waba = resp.data?.whatsapp_business_account?.id;
      if (waba) {
        cachedBusinessAccountId = String(waba);
        return cachedBusinessAccountId;
      }
    } catch (e: any) {
      console.warn('[WhatsApp] phone_number_id WABA resolve failed:', e?.message);
    }
  }

  return null;
}

export function getWhatsappMetaConfig() {
  const accessToken = config.whatsapp.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = config.whatsapp.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const businessAccountId =
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || config.whatsapp.businessAccountId || '';
  const appId = process.env.WHATSAPP_APP_ID || '';
  return {
    accessToken,
    phoneNumberId,
    businessAccountId,
    appId,
    graphVersion: GRAPH_VERSION,
    enabled: config.whatsapp.enabled,
    defaultCountryCode: config.whatsapp.defaultCountryCode || '91',
  };
}

export function assertMetaConfigured(requireWaba = false): MetaApiResult<{ accessToken: string; businessAccountId: string }> {
  const c = getWhatsappMetaConfig();
  if (!c.accessToken) return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN not configured' };
  if (requireWaba && !c.businessAccountId) {
    return { ok: false, error: 'WHATSAPP_BUSINESS_ACCOUNT_ID not configured' };
  }
  return { ok: true, data: { accessToken: c.accessToken, businessAccountId: c.businessAccountId } };
}

export async function fetchMetaMessageTemplates(limit = 100): Promise<MetaApiResult<any[]>> {
  const accessToken = config.whatsapp.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN not configured' };

  const businessAccountId = await resolveWhatsappBusinessAccountId(accessToken);
  if (!businessAccountId) {
    return {
      ok: false,
      error:
        'WHATSAPP_BUSINESS_ACCOUNT_ID not configured and could not resolve from token. Add WHATSAPP_BUSINESS_ACCOUNT_ID to .env (Meta Business Settings → WhatsApp Account ID).',
    };
  }

  try {
    const url = `${graphBase()}/${businessAccountId}/message_templates`;
    const resp = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { limit },
      timeout: 30000,
    });
    return { ok: true, data: resp.data?.data || [] };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed to fetch templates', details: e?.response?.data };
  }
}

export type CreateTemplateInput = {
  name: string;
  language: string;
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  components: unknown[];
  allowCategoryChange?: boolean;
};

/** Submit new template to Meta for approval (status usually PENDING). */
export async function createMetaMessageTemplate(input: CreateTemplateInput): Promise<MetaApiResult<any>> {
  const accessToken = config.whatsapp.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN not configured' };
  const businessAccountId = await resolveWhatsappBusinessAccountId(accessToken);
  if (!businessAccountId) {
    return { ok: false, error: 'WHATSAPP_BUSINESS_ACCOUNT_ID not configured' };
  }

  const name = String(input.name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  if (!name || name.length < 1) return { ok: false, error: 'Template name is required (lowercase, underscores)' };

  const payload: Record<string, unknown> = {
    name,
    language: input.language || 'en_US',
    category: input.category,
    components: input.components,
  };
  if (input.allowCategoryChange) payload.allow_category_change = true;

  try {
    const url = `${graphBase()}/${businessAccountId}/message_templates`;
    const resp = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });
    return { ok: true, data: resp.data };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Template create failed', details: e?.response?.data };
  }
}

/** Delete template by name (all languages) or hsm id — Meta uses name query param. */
export async function deleteMetaMessageTemplate(templateName: string): Promise<MetaApiResult<{ success: boolean }>> {
  const accessToken = config.whatsapp.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN not configured' };
  const businessAccountId = await resolveWhatsappBusinessAccountId(accessToken);
  if (!businessAccountId) return { ok: false, error: 'WHATSAPP_BUSINESS_ACCOUNT_ID not configured' };
  try {
    const url = `${graphBase()}/${businessAccountId}/message_templates`;
    await axios.delete(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { name: templateName },
      timeout: 30000,
    });
    return { ok: true, data: { success: true } };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Template delete failed', details: e?.response?.data };
  }
}

export function parseMetaTemplateRow(t: any) {
  const components = t.components || [];
  const header = components.find((c: any) => c.type === 'HEADER');
  const body = components.find((c: any) => c.type === 'BODY');
  const footer = components.find((c: any) => c.type === 'FOOTER');
  const buttons = components.find((c: any) => c.type === 'BUTTONS');

  return {
    templateId: String(t.id),
    name: t.name,
    language: t.language || 'en_US',
    category: t.category || null,
    status: t.status || 'UNKNOWN',
    headerType: header?.format || null,
    headerText: header?.text || null,
    bodyText: body?.text || null,
    footerText: footer?.text || null,
    buttonsJson: buttons?.buttons || null,
    componentsJson: components,
    qualityScore: t.quality_score?.score || null,
    rejectedReason: t.rejected_reason || null,
    lastSyncedAt: new Date(),
  };
}

export type SendTemplateParams = {
  toMobileNumber: string;
  templateName: string;
  languageCode?: string;
  /** Body {{1}}, {{2}} text params in order */
  bodyParams?: string[];
  /** Header: text string OR { format: 'IMAGE'|'DOCUMENT', link } OR { format, mediaId } */
  header?: { format: 'TEXT'; text: string } | { format: 'IMAGE' | 'DOCUMENT'; link?: string; mediaId?: string };
  /** URL button {{1}} — index 0 typical for OTP templates */
  urlButtonParam?: string;
  urlButtonIndex?: number;
  phoneNumberId?: string;
  accessToken?: string;
  defaultCountryCode?: string;
};

function normalizeToE164DigitsOnly(mobileNumber: string, defaultCountryCode: string): string {
  const digits = String(mobileNumber || '').replace(/\D/g, '');
  if (!digits) return digits;
  if (digits.length >= 11) return digits;
  const cc = String(defaultCountryCode || '').replace(/\D/g, '') || '91';
  return `${cc}${digits}`;
}

function buildHeaderParameters(header: SendTemplateParams['header']): any[] | null {
  if (!header) return null;
  if (header.format === 'TEXT') {
    return [{ type: 'text', text: String(header.text) }];
  }
  if (header.format === 'IMAGE') {
    if (header.mediaId) return [{ type: 'image', image: { id: header.mediaId } }];
    if (header.link) return [{ type: 'image', image: { link: header.link } }];
  }
  if (header.format === 'DOCUMENT') {
    if (header.mediaId) return [{ type: 'document', document: { id: header.mediaId } }];
    if (header.link) return [{ type: 'document', document: { link: header.link } }];
  }
  return null;
}

/** Send any APPROVED template with dynamic parameters. */
export async function sendMetaTemplateMessage(
  params: SendTemplateParams,
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string; details?: unknown }> {
  const phoneNumberId = params.phoneNumberId || config.whatsapp.phoneNumberId;
  const accessToken = params.accessToken || config.whatsapp.accessToken;
  const cc = params.defaultCountryCode || config.whatsapp.defaultCountryCode || '91';

  if (!phoneNumberId) return { ok: false, error: 'WHATSAPP_PHONE_NUMBER_ID not configured' };
  if (!accessToken) return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN not configured' };

  const to = normalizeToE164DigitsOnly(params.toMobileNumber, cc);
  if (!to) return { ok: false, error: 'Invalid toMobileNumber' };

  const components: any[] = [];
  const headerParams = buildHeaderParameters(params.header);
  if (headerParams?.length) {
    components.push({ type: 'header', parameters: headerParams });
  }
  if (params.bodyParams?.length) {
    components.push({
      type: 'body',
      parameters: params.bodyParams.map((t) => ({ type: 'text', text: String(t) })),
    });
  }
  if (params.urlButtonParam != null) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: String(params.urlButtonIndex ?? 0),
      parameters: [{ type: 'text', text: String(params.urlButtonParam) }],
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.languageCode || 'en_US' },
      ...(components.length ? { components } : {}),
    },
  };

  try {
    const resp = await axios.post(`${graphBase()}/${phoneNumberId}/messages`, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });
    return { ok: true, messageId: resp?.data?.messages?.[0]?.id };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message || 'WhatsApp template send failed',
      details: e?.response?.data,
    };
  }
}
