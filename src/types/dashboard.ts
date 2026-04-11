export interface CopyItem {
  id: string;
  content: string;
  fileName?: string | null;
  fileSize?: number | null;
  workspaceId?: string | null;
  userId: string;
  createdAt: string;
  user?: {
    id: string;
    name?: string | null;
    email: string;
  };
}

export interface FetchHistoryResponse {
  items: CopyItem[];
  nextCursor: string | null;
}
