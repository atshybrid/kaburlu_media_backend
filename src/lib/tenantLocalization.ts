export function getTenantPrimaryLanguageInfo(tenant: any): { code: string | null; name: string | null } {
  const code = tenant?.entity?.language?.code ? String(tenant.entity.language.code) : null;
  const name = tenant?.entity?.language?.name ? String(tenant.entity.language.name) : null;
  return { code, name };
}

export function getTenantDisplayName(tenant: any): string {
  const fallback = tenant?.name ? String(tenant.name) : '';
  const { code } = getTenantPrimaryLanguageInfo(tenant);
  if (!code) return fallback;
  const tr = (tenant?.translations || []).find((t: any) => String(t?.language) === code);
  const val = tr?.name ? String(tr.name).trim() : '';
  return val || fallback;
}
