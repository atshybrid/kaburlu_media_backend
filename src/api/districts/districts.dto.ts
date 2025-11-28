export interface CreateDistrictDto {
  name: string;
  stateId: string;
}

export interface UpdateDistrictDto {
  name?: string;
  stateId?: string;
  isDeleted?: boolean;
}
