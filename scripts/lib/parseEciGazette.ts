/**
 * Parse ECI gazette text (pdf-parse output) into party records.
 */
import * as fs from 'fs';

export type ParsedParty = {
  eciSerialNumber: number | null;
  name: string;
  symbolName: string | null;
  recognition: 'NATIONAL' | 'STATE' | 'REGISTERED_UNRECOGNIZED';
  states: string[];
  headquartersAddress: string | null;
  shortCode: string;
};

const ADDR_SPLIT_RE =
  /\s+(Village|Vill\.|H\.?\s*No\.?|Plot|At\s*&|At\s|C\/o|Ward\s|District|D-\d|Door\s|House\s|Flat\s|Office|Post\s|P\.O\.?|P\.S\.?|Near\s|Gram|S\.?F\.?|Tehsil|Tahsil|Distt\.?|State-|Hyderabad|New\s+Delhi|Kolkata|Mumbai|Chennai|Bangalore|Lucknow|Patna|Jaipur|Bhopal|Ahmedabad|Shillong|\d+,\s)/i;

const PARTY_NAME_END_RE =
  /\s+Party\s+(?=[A-Z0-9])/i;

const NATIONAL_KNOWN: { serial: number; name: string; symbol: string; shortCode: string; hq: string }[] = [
  { serial: 1, name: 'All India Trinamool Congress', symbol: 'Flowers & Grass', shortCode: 'AITC', hq: '30-B, Harish Chatterjee Street, Kolkata-700026' },
  { serial: 2, name: 'Bahujan Samaj Party', symbol: 'Elephant', shortCode: 'BSP', hq: '4, Gurudwara Rakabganj Road, New Delhi – 110001' },
  { serial: 3, name: 'Bharatiya Janata Party', symbol: 'Lotus', shortCode: 'BJP', hq: '6-A, Deen Dayal Upadhyaya Marg, New Delhi – 110002' },
  { serial: 4, name: 'Communist Party of India', symbol: 'Ears of Corn and Sickle', shortCode: 'CPI', hq: 'Ajoy Bhawan, Kotla Marg, New Delhi – 110002' },
  { serial: 5, name: 'Communist Party of India (Marxist)', symbol: 'Hammer, Sickle and Star', shortCode: 'CPI_M', hq: '27-29, Bhai Vir Singh Marg, New Delhi - 110001' },
  { serial: 6, name: 'Indian National Congress', symbol: 'Hand', shortCode: 'INC', hq: '24, Akbar Road, New Delhi – 110011' },
  { serial: 7, name: 'Nationalist Congress Party', symbol: 'Clock', shortCode: 'NCP', hq: 'Bungalow No.-1, Canning Lane, New Delhi-110001' },
  { serial: 8, name: "National People's Party", symbol: 'Book', shortCode: 'NPP', hq: 'Plot No.90A, Lachaumiere District, Shillong-793001' },
];

/** Wikipedia page titles for symbol image fetch (national + major state). */
export const WIKI_SYMBOL_PAGES: Record<string, string> = {
  BJP: 'Bharatiya_Janata_Party',
  INC: 'Indian_National_Congress',
  AITC: 'All_India_Trinamool_Congress',
  BSP: 'Bahujan_Samaj_Party',
  CPI: 'Communist_Party_of_India',
  CPI_M: 'Communist_Party_of_India_(Marxist)',
  NCP: 'Nationalist_Congress_Party',
  NPP: "National_People's_Party",
  AAP: 'Aam_Aadmi_Party',
  TDP: 'Telugu_Desam_Party',
  YSRCP: 'YSR_Congress_Party',
  BRS: 'Bharat_Rashtra_Samithi',
  TRS: 'Telangana_Rashtra_Samithi',
  AIMIM: 'All_India_Majlis-e-Ittehadul_Muslimeen',
  DMK: 'Dravida_Munnetra_Kazhagam',
  AIADMK: 'All_India_Anna_Dravida_Munnetra_Kazhagam',
  SP: 'Samajwadi_Party',
  RJD: 'Rashtriya_Janata_Dal',
  JDU: 'Janata_Dal_(United)',
  SHIVSENA: 'Shiv_Sena',
  JSP: 'Jana_Sena_Party',
  TMC: 'All_India_Trinamool_Congress',
};

function slugShortCode(name: string, serial: number, recognition: string): string {
  const known = Object.values(NATIONAL_KNOWN).find((n) => n.name === name);
  if (known) return known.shortCode;
  const base = name
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)
    .toUpperCase();
  if (base.length >= 2 && base.length <= 24) return base;
  const prefix = recognition === 'NATIONAL' ? 'NAT' : recognition === 'STATE' ? 'ST' : 'RUPP';
  return `${prefix}_${String(serial).padStart(5, '0')}`;
}

function splitNameAddress(rest: string): { name: string; address: string | null } {
  const cleaned = rest.replace(/\s+/g, ' ').trim();
  const partySplit = cleaned.match(PARTY_NAME_END_RE);
  if (partySplit && partySplit.index != null && partySplit.index > 5) {
    return {
      name: cleaned.slice(0, partySplit.index + 6).trim(),
      address: cleaned.slice(partySplit.index + 7).trim() || null,
    };
  }
  const m = cleaned.match(ADDR_SPLIT_RE);
  if (m && m.index != null && m.index > 8) {
    return {
      name: cleaned.slice(0, m.index).trim(),
      address: cleaned.slice(m.index).trim() || null,
    };
  }
  const pin = cleaned.match(/^(.*?)(\s+\d{5,6}.*)$/);
  if (pin && pin[1].length > 5) {
    return { name: pin[1].trim(), address: pin[2].trim() };
  }
  if (cleaned.length > 80) {
    const mid = Math.min(60, Math.floor(cleaned.length * 0.35));
    const space = cleaned.indexOf(' ', mid);
    if (space > 10) {
      return { name: cleaned.slice(0, space).trim(), address: cleaned.slice(space).trim() };
    }
  }
  return { name: cleaned, address: null };
}

function extractSection(text: string, startMarker: string, endMarker: string): string {
  const start = text.indexOf(startMarker);
  if (start < 0) return '';
  const end = text.indexOf(endMarker, start + startMarker.length);
  return end > start ? text.slice(start, end) : text.slice(start);
}

function parseRupp(section: string): ParsedParty[] {
  const lines = section.split(/\r?\n/);
  const out: ParsedParty[] = [];
  let buffer: string[] = [];
  let serial: number | null = null;

  const flush = () => {
    if (serial == null || !buffer.length) return;
    const rest = buffer.join(' ').replace(/\s+/g, ' ').trim();
    const { name, address } = splitNameAddress(rest);
    if (name.length < 3) return;
    out.push({
      eciSerialNumber: serial,
      name,
      symbolName: null,
      recognition: 'REGISTERED_UNRECOGNIZED',
      states: [],
      headquartersAddress: address,
      shortCode: slugShortCode(name, serial, 'REGISTERED_UNRECOGNIZED'),
    });
    buffer = [];
    serial = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^Sl\./i.test(line) || /^Name of the Registered/i.test(line)) continue;
    if (/^TABLE/i.test(line)) continue;
    const m = line.match(/^(\d+)\s+(.+)/);
    if (m) {
      flush();
      serial = parseInt(m[1], 10);
      buffer = [m[2]];
    } else if (serial != null && line.length > 1 && !/^\d+\.\s*\d+\./.test(line)) {
      buffer.push(line);
    }
  }
  flush();
  return out;
}

/** Rough state-party parse: lines with party name + symbol keywords. */
function parseStateParties(section: string): ParsedParty[] {
  const symbolWords =
    /(Lotus|Hand|Bicycle|Car|Ceiling Fan|Arrow|Elephant|Hammer|Clock|Book|Kite|Rising Sun|Two Leaves|Hurricane Lamp|Bow and Arrow|Plough|Ink Pot|Maize|Lock|Nangol|Drum|Guitar|Lady Farmer|Paddy|Ganna|Farmer|Coconut)/i;
  const lines = section.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out: ParsedParty[] = [];
  let currentState = '';

  for (const line of lines) {
    if (/^TABLE/i.test(line) || /^Sl\./i.test(line) || /^Name of the State/i.test(line)) continue;
    const stateM = line.match(/^(\d+)\.\s*([A-Za-z].+)$/);
    if (stateM && !symbolWords.test(line) && line.length < 60) {
      currentState = stateM[2].replace(/\s+\d+\.\s*$/, '').trim();
      continue;
    }
    const partyM = line.match(/^\d+\.\s+(.+)/);
    if (!partyM) continue;
    const rest = partyM[1];
    const symM = rest.match(symbolWords);
    if (!symM) continue;
    const symIdx = rest.search(symbolWords);
    const name = rest.slice(0, symIdx).trim();
    const afterSym = rest.slice(symIdx).trim();
    const symEnd = afterSym.search(/\s{2,}|\d+[-,]|New Delhi|Hyderabad|Kolkata|Mumbai|Chennai|House|Plot|Village|Road/i);
    const symbolName = symEnd > 0 ? afterSym.slice(0, symEnd).trim() : afterSym.split(/\s{2}/)[0]?.trim() || afterSym;
    const address = symEnd > 0 ? afterSym.slice(symEnd).trim() : null;
    if (name.length < 4) continue;
    const serial = out.length + 1;
    out.push({
      eciSerialNumber: serial,
      name,
      symbolName,
      recognition: 'STATE',
      states: currentState ? [currentState] : [],
      headquartersAddress: address,
      shortCode: slugShortCode(name, serial, 'STATE'),
    });
  }
  return out;
}

export function parseEciGazetteFile(filePath: string): ParsedParty[] {
  const text = fs.readFileSync(filePath, 'utf8');
  const national: ParsedParty[] = NATIONAL_KNOWN.map((n) => ({
    eciSerialNumber: n.serial,
    name: n.name,
    symbolName: n.symbol,
    recognition: 'NATIONAL' as const,
    states: [],
    headquartersAddress: n.hq,
    shortCode: n.shortCode,
  }));

  const stateSection = extractSection(text, 'TABLE – II', 'TABLE – III');
  const state = parseStateParties(stateSection);

  const ruppSection = extractSection(text, 'TABLE – III', 'TABLE-IV');
  const rupp = parseRupp(ruppSection);

  const byCode = new Map<string, ParsedParty>();
  for (const p of [...national, ...state, ...rupp]) {
    let code = p.shortCode;
    let n = 1;
    while (byCode.has(code)) {
      code = `${p.shortCode}_${n++}`;
    }
    byCode.set(code, { ...p, shortCode: code });
  }
  return [...byCode.values()];
}
