export interface CopyItem {
  id: string;
  content: string;
  fileName?: string | null;
  fileSize?: number | null;
  workspaceId?: string | null;
  createdAt: string;
}

export interface FetchHistoryResponse {
  items: CopyItem[];
  nextCursor: string | null;
}
