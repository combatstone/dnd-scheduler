export type UID = string;
export type CampaignID = string;
export type SessionID = string;

export type ProposedTime = {
  id: string; // uuid
  startISO: string;
  endISO: string;
  proposedBy: UID;
};

export type AvailabilityBuckets = {
  yes: UID[];
  maybe: UID[];
  no: UID[];
};

export type SessionDoc = {
  title: string;
  notes?: string;
  createdAt: number;
  confirmedTime?: { startISO: string; endISO: string } | null;
  proposedTimes: ProposedTime[];
  availability: Record<string, AvailabilityBuckets>; // key = ProposedTime.id
};

export type CampaignDoc = {
  name: string;
  description?: string;
  gmId: UID;
  players: UID[];
  createdAt: number;
};

