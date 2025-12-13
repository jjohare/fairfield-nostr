export interface Channel {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  creatorPubkey: string;
  members: string[];
  admins: string[];
  pendingRequests: string[];
  cohortTags: string[];
  isEncrypted: boolean;
  encryptionKey?: string;
}

export interface Message {
  id: string;
  channelId: string;
  authorPubkey: string;
  content: string;
  createdAt: number;
  isEncrypted: boolean;
  decryptedContent?: string;
  tags?: string[][];
  replyTo?: string;
  quotedMessages?: string[];
}

export interface JoinRequest {
  channelId: string;
  requesterPubkey: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export type MemberStatus = 'member' | 'pending' | 'non-member' | 'admin';
