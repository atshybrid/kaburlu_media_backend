import { MAX_ISSUE_NUMBER_PER_YEAR } from './headerStyleCatalog';

export type IssueCounterMode = 'DAY_OF_YEAR' | 'SEQUENTIAL';

export function parseHHMM(time: string): { hours: number; minutes: number } {
  const [hh, mm] = (time || '23:00').split(':').map(Number);
  return {
    hours: Number.isFinite(hh) && hh >= 0 && hh <= 23 ? hh : 23,
    minutes: Number.isFinite(mm) && mm >= 0 && mm <= 59 ? mm : 0,
  };
}

export function nowIST(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utcMs + 5.5 * 60 * 60_000);
}

export function dayOfYearUtc(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - start) / 86400000) + 1;
}

export function teluguDayName(date: Date): string {
  const days = ['ఆదివారం', 'సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'];
  return days[date.getUTCDay()] || days[0];
}

export function computeSmartDesignDaily(config: {
  volumeStartNumber: number;
  volumeStartYear: number;
  issueStartNumber: number;
  issueStartDate: Date;
  issueCounterMode: string;
  newsCloseTime: string;
}) {
  const todayIST = nowIST();
  const y = todayIST.getUTCFullYear();
  const m = todayIST.getUTCMonth();
  const d = todayIST.getUTCDate();

  const yearDelta = Math.max(0, y - config.volumeStartYear);
  const currentVolume = config.volumeStartNumber + yearDelta;

  const issueStart = new Date(config.issueStartDate);
  const issueStartNorm = Date.UTC(issueStart.getUTCFullYear(), issueStart.getUTCMonth(), issueStart.getUTCDate());
  const todayNorm = Date.UTC(y, m, d);
  const daysSince = Math.floor((todayNorm - issueStartNorm) / 86400000);

  const mode = String(config.issueCounterMode || 'SEQUENTIAL').toUpperCase();
  let currentIssue: number;
  if (mode === 'DAY_OF_YEAR') {
    currentIssue = dayOfYearUtc(todayIST);
  } else {
    currentIssue = config.issueStartNumber + Math.max(0, daysSince);
  }

  if (currentIssue > MAX_ISSUE_NUMBER_PER_YEAR) {
    currentIssue = MAX_ISSUE_NUMBER_PER_YEAR;
  }

  const { hours: closeH, minutes: closeM } = parseHHMM(config.newsCloseTime);
  const issueDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return {
    issueDate,
    dayNameTelugu: teluguDayName(todayIST),
    currentVolume,
    currentIssue,
    maxIssuePerYear: MAX_ISSUE_NUMBER_PER_YEAR,
    newsWindow: {
      fromDate: `${issueDate}T00:00:00+05:30`,
      toDate: `${issueDate}T${String(closeH).padStart(2, '0')}:${String(closeM).padStart(2, '0')}:00+05:30`,
    },
  };
}
