import axios, { AxiosInstance } from 'axios';

export type PrecheckResponse = {
  mobileNumber: string;
  tenantReporter: boolean;
  alreadyUnionMember: boolean;
  tenantReporterDetails: any | null;
  unionMemberDetails: any | null;
};

export type CreateMemberResponse = {
  message: string;
  tenantReporter: boolean;
  member: any;
  card: any;
  idCard: {
    pdfGenerated: boolean;
    pdfUrl: string | null;
    whatsappSent: boolean;
  };
};

export type UnionDashboardResponse = {
  summary: {
    total: number;
    approved: number;
    active: number;
    inactive: number;
    pending: number;
    rejected: number;
    kycVerified: number;
  };
  filters: {
    district: string | null;
    mandal: string | null;
    districtId: string | null;
    mandalId: string | null;
  };
  stateWise: Array<{ state: string; total: number; approved: number; pending: number }>;
  districtWise: Array<{ district: string; total: number }>;
  mandalWise: Array<{ mandal: string; total: number }>;
  postsByLevel: Record<string, { count: number; posts: Array<{ title: string; count: number }> }>;
  insurance: {
    active: number;
    expired: number;
    accidentalActive: number;
    healthActive: number;
  };
  claims: {
    supported: boolean;
    total: number;
    open?: number;
    inProgress?: number;
    closed?: number;
    note?: string;
    message?: string;
  };
  election: {
    districtFilter: string | null;
    totalDistrictElectedPosts: number;
    postsNeedElection: number;
    postsReady: number;
    posts: Array<{
      postId: string;
      title: string;
      nativeTitle: string | null;
      maxSeats: number;
      seatsFilled: number;
      seatsVacant: number;
      electionRequired: boolean;
    }>;
  };
};

export type ConductDistrictElectionPayload = {
  postId: string;
  districtId: string;
  mandalId?: string;
  winnerProfileIds: string[];
  termStartDate: string; // YYYY-MM-DD
  termEndDate?: string; // YYYY-MM-DD
  notes?: string;
};

export type AddInsurancePayload = {
  type: 'ACCIDENTAL' | 'HEALTH';
  policyNumber: string;
  insurer: string;
  coverAmount?: number;
  premium?: number;
  validFrom: string;
  validTo: string;
  notes?: string;
};

export class PresidentUnionApi {
  private client: AxiosInstance;

  constructor(baseURL: string, token?: string) {
    this.client = axios.create({ baseURL });
    if (token) this.setToken(token);
  }

  setToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearToken() {
    delete this.client.defaults.headers.common['Authorization'];
  }

  // 1) Mobile precheck
  async precheckMobile(mobileNumber: string) {
    const { data } = await this.client.get<PrecheckResponse>('/journalist/president/members/precheck', {
      params: { mobileNumber },
    });
    return data;
  }

  // 2) Create member (tenantReporter true/false) with optional photo file
  async createMember(input: {
    mobileNumber: string;
    tenantReporter?: boolean;
    unionName?: string;
    fullName?: string;
    mpin?: string;
    designation?: string;
    organization?: string;
    currentNewspaper?: string;
    currentDesignation?: string;
    stateId?: string;
    stateName?: string;
    districtId?: string;
    districtName?: string;
    mandalId?: string;
    mandalName?: string;
    aadhaarNumber?: string;
    nomineeName?: string;
    photo?: {
      uri: string;
      name: string;
      type: string;
    };
  }) {
    const form = new FormData();

    const appendIfValue = (key: string, value?: string | boolean) => {
      if (value === undefined || value === null || value === '') return;
      form.append(key, String(value));
    };

    appendIfValue('mobileNumber', input.mobileNumber);
    appendIfValue('tenantReporter', input.tenantReporter);
    appendIfValue('unionName', input.unionName);
    appendIfValue('fullName', input.fullName);
    appendIfValue('mpin', input.mpin);
    appendIfValue('designation', input.designation);
    appendIfValue('organization', input.organization);
    appendIfValue('currentNewspaper', input.currentNewspaper);
    appendIfValue('currentDesignation', input.currentDesignation);
    appendIfValue('stateId', input.stateId);
    appendIfValue('stateName', input.stateName);
    appendIfValue('districtId', input.districtId);
    appendIfValue('districtName', input.districtName);
    appendIfValue('mandalId', input.mandalId);
    appendIfValue('mandalName', input.mandalName);
    appendIfValue('aadhaarNumber', input.aadhaarNumber);
    appendIfValue('nomineeName', input.nomineeName);

    if (input.photo) {
      form.append('photo', {
        uri: input.photo.uri,
        name: input.photo.name,
        type: input.photo.type,
      } as any);
    }

    const { data } = await this.client.post<CreateMemberResponse>('/journalist/president/members/create', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  // 3) Union dashboard
  async getUnionDashboard(filters?: {
    district?: string;
    mandal?: string;
    districtId?: string;
    mandalId?: string;
  }) {
    const { data } = await this.client.get<UnionDashboardResponse>('/journalist/president/union-dashboard', {
      params: filters || {},
    });
    return data;
  }

  // 4) Members list and details
  async getMembers(params?: {
    page?: number;
    limit?: number;
    state?: string;
    district?: string;
    mandal?: string;
    approved?: boolean;
    kycVerified?: boolean;
    search?: string;
  }) {
    const { data } = await this.client.get('/journalist/president/members', { params: params || {} });
    return data;
  }

  async getMemberDetail(memberId: string) {
    const { data } = await this.client.get(`/journalist/president/members/${memberId}`);
    return data;
  }

  async activateMember(memberId: string, payload: { approved: boolean; kycNote?: string; approveApplication?: boolean }) {
    const { data } = await this.client.patch(`/journalist/president/members/${memberId}/kyc`, payload);
    return data;
  }

  // 5) Insurance
  async listMemberInsurance(memberId: string) {
    const { data } = await this.client.get(`/journalist/president/members/${memberId}/insurance`);
    return data;
  }

  async addMemberInsurance(memberId: string, payload: AddInsurancePayload) {
    const { data } = await this.client.post(`/journalist/president/members/${memberId}/insurance`, payload);
    return data;
  }

  async updateMemberInsurance(memberId: string, insuranceId: string, payload: Partial<AddInsurancePayload> & { isActive?: boolean }) {
    const { data } = await this.client.patch(`/journalist/president/members/${memberId}/insurance/${insuranceId}`, payload);
    return data;
  }

  async uploadInsuranceCard(memberId: string, insuranceId: string, file: { uri: string; name: string; type: string }) {
    const form = new FormData();
    form.append('insuranceCard', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const { data } = await this.client.post(
      `/journalist/president/members/${memberId}/insurance/${insuranceId}/card`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  }

  // 6) Elections
  async getDistrictElectionReadiness(params?: { districtId?: string; district?: string }) {
    const { data } = await this.client.get('/journalist/president/elections/district-readiness', {
      params: params || {},
    });
    return data;
  }

  async conductDistrictElection(payload: ConductDistrictElectionPayload) {
    const { data } = await this.client.post('/journalist/president/elections/conduct-district', payload);
    return data;
  }

  // 7) Post holders
  async getPostHolders(params?: { level?: 'STATE' | 'DISTRICT' | 'MANDAL' | 'CITY' | 'SPECIAL_WING'; state?: string; district?: string }) {
    const { data } = await this.client.get('/journalist/president/post-holders', { params: params || {} });
    return data;
  }
}

/*
Quick React Native usage

import { PresidentUnionApi } from './PRESIDENT_UNION_RN_API_SERVICE';

const api = new PresidentUnionApi('https://your-domain.com/api/v1', YOUR_TOKEN);

const pre = await api.precheckMobile('9876543210');
if (pre.alreadyUnionMember) {
  // show existing member details
} else {
  await api.createMember({
    mobileNumber: '9876543210',
    tenantReporter: pre.tenantReporter,
    unionName: 'Telangana Working Journalists Federation',
    fullName: 'Suresh Babu',
    designation: 'Reporter',
    stateName: 'Telangana',
    districtName: 'Hyderabad',
    mandalName: 'Secunderabad',
  });
}

const dashboard = await api.getUnionDashboard({ district: 'Hyderabad' });
*/
