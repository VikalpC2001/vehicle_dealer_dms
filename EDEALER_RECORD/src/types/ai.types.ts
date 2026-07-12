/** Structured identity fields extracted from an ID proof image. */
export interface IdProofDetails {
  readonly fullName: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly pincode: string | null;
}
