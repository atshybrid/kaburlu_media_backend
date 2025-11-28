export interface CreateMandalDto {
  name: string;
  districtId: string;
  isAssemblyConstituency?: boolean;
}

export interface UpdateMandalDto {
  name?: string;
  districtId?: string;
  isAssemblyConstituency?: boolean;
  isDeleted?: boolean;
}
