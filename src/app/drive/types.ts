export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "code"
  | "other";

export type TimeGroup =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "older";

export interface DriveFolderItem {
  id: string;
  name: string;
  color: string | null;
  parentId: string | null;
  workspaceId: string | null;
  isStarred: boolean;
  isTrash: boolean;
  filesCount?: number;
  foldersCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DriveFileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  storageType: string;
  storageKey?: string | null;
  folderId: string | null;
  workspaceId: string | null;
  isStarred: boolean;
  isTrash: boolean;
  category: FileCategory;
  timeGroup: TimeGroup;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  folder?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export interface DriveStats {
  totalFiles: number;
  totalBytes: number;
  totalBytesFormatted: string;
  categories: {
    category: string;
    count: number;
    bytes: number;
    formatted: string;
  }[];
}

export type ViewMode = "grid" | "list";

export type DriveFilter =
  | "all"
  | "starred"
  | "recent"
  | "trash"
  | "image"
  | "document"
  | "video"
  | "audio"
  | "archive";

export type TimeFilter =
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "older";

export type SortBy = "name" | "size" | "createdAt" | "updatedAt";
export type SortOrder = "asc" | "desc";
