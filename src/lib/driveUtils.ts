export const sanitizeFileName = (fileName: string) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "code"
  | "other";

export function getFileCategory(mimeType: string, fileName: string): FileCategory {
  const ext = (fileName.split(".").pop() || "").toLowerCase();

  if (
    mimeType.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "jfif"].includes(ext)
  ) {
    return "image";
  }
  if (
    mimeType.startsWith("video/") ||
    ["mp4", "webm", "ogg", "mov", "avi", "mkv", "m4v"].includes(ext)
  ) {
    return "video";
  }
  if (
    mimeType.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)
  ) {
    return "audio";
  }
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("presentation") ||
    ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "csv"].includes(ext)
  ) {
    return "document";
  }
  if (
    mimeType.includes("zip") ||
    mimeType.includes("tar") ||
    mimeType.includes("compressed") ||
    mimeType.includes("archive") ||
    ["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)
  ) {
    return "archive";
  }
  if (
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("json") ||
    mimeType.includes("html") ||
    mimeType.includes("css") ||
    [
      "js",
      "ts",
      "tsx",
      "jsx",
      "json",
      "html",
      "css",
      "py",
      "java",
      "cpp",
      "c",
      "go",
      "rs",
      "php",
      "sql",
      "sh",
      "md",
    ].includes(ext)
  ) {
    return "code";
  }
  return "other";
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function getTimeGroup(
  dateInput: Date | string
): "today" | "yesterday" | "this_week" | "this_month" | "older" {
  const date = new Date(dateInput);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const startOfThisWeek = new Date(startOfToday);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - 7);

  const startOfThisMonth = new Date(startOfToday);
  startOfThisMonth.setDate(startOfThisMonth.getDate() - 30);

  if (date >= startOfToday) return "today";
  if (date >= startOfYesterday) return "yesterday";
  if (date >= startOfThisWeek) return "this_week";
  if (date >= startOfThisMonth) return "this_month";
  return "older";
}
