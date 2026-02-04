type AnyPrisma = any;

let cachedHasJpegColumns: boolean | null = null;

/**
 * Returns true if the connected DB has the JPEG URL columns for ePaper issues/pages.
 * This allows zero-downtime deploys: code can run before migrations are applied.
 */
export async function hasEpaperJpegColumns(prisma: AnyPrisma): Promise<boolean> {
  if (cachedHasJpegColumns !== null) return cachedHasJpegColumns;

  try {
    const rows: Array<{ table_name: string; column_name: string }> = await prisma['$queryRawUnsafe'](
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('EpaperPdfIssue','EpaperPdfPage') AND column_name IN ('coverImageUrlJpeg','imageUrlJpeg');"
    );

    const hasIssue = rows.some((r) => r.table_name === 'EpaperPdfIssue' && r.column_name === 'coverImageUrlJpeg');
    const hasPage = rows.some((r) => r.table_name === 'EpaperPdfPage' && r.column_name === 'imageUrlJpeg');
    cachedHasJpegColumns = Boolean(hasIssue && hasPage);
    return cachedHasJpegColumns;
  } catch {
    cachedHasJpegColumns = false;
    return cachedHasJpegColumns;
  }
}
