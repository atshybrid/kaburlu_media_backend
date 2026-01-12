import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { config } from '../config/env';

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function rmSafe(p: string): Promise<void> {
  try {
    // Node 20 supports fs.rm
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (fs as any).rm(p, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function resolvePdftoppmPath(): string {
  const fromConfig = (config as any)?.epaper?.pdftoppmPath;
  return String(fromConfig || 'pdftoppm');
}

function resolveDpi(): number {
  const fromConfig = (config as any)?.epaper?.pdfDpi;
  const dpi = Number(fromConfig || 150);
  if (!Number.isFinite(dpi) || dpi <= 0) return 150;
  return Math.floor(dpi);
}

function resolveMaxPages(): number {
  const fromConfig = (config as any)?.epaper?.pdfMaxPages;
  const n = Number(fromConfig || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export async function convertPdfToPngPages(pdfBuffer: Buffer): Promise<Buffer[]> {
  const pdftoppm = resolvePdftoppmPath();
  const dpi = resolveDpi();
  const maxPages = resolveMaxPages();

  const workDir = path.join(os.tmpdir(), `epaper-pdf-${randomId()}`);
  const pdfPath = path.join(workDir, 'input.pdf');
  const outPrefix = path.join(workDir, 'page');

  await fs.mkdir(workDir, { recursive: true });

  try {
    await fs.writeFile(pdfPath, pdfBuffer);

    await new Promise<void>((resolve, reject) => {
      const args = ['-png', '-r', String(dpi)];
      if (maxPages > 0) {
        args.push('-f', '1', '-l', String(maxPages));
      }
      args.push(pdfPath, outPrefix);

      const child = spawn(pdftoppm, args, {
        windowsHide: true,
      });

      let stderr = '';
      child.stderr.on('data', (d) => (stderr += String(d)));

      child.on('error', (err) => {
        const hint =
          `pdftoppm not available. Install Poppler (pdftoppm) and/or set PDFTOPPM_PATH. Original error: ${String(err?.message || err)}`;
        reject(new Error(hint));
      });

      child.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(`pdftoppm failed (exit ${code}). ${stderr || ''}`.trim()));
      });
    });

    const names = await fs.readdir(workDir);
    const pageFiles = names
      .filter((n) => /^page-\d+\.png$/i.test(n))
      .map((n) => ({
        name: n,
        n: parseInt(n.replace(/^page-(\d+)\.png$/i, '$1'), 10),
      }))
      .filter((x) => Number.isFinite(x.n))
      .sort((a, b) => a.n - b.n);

    if (pageFiles.length === 0) {
      throw new Error('pdftoppm produced no PNG pages.');
    }

    const buffers: Buffer[] = [];
    for (const f of pageFiles) {
      const p = path.join(workDir, f.name);
      buffers.push(await fs.readFile(p));
    }

    return buffers;
  } finally {
    await rmSafe(workDir);
  }
}
