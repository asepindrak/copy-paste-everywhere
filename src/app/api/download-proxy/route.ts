import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing url parameter." },
      { status: 400 },
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json(
      { error: "Only http(s) URLs are supported." },
      { status: 400 },
    );
  }

  const allowedEndpoint = process.env.S3_ENDPOINT_URL?.replace(/\/$/, "");
  if (allowedEndpoint && !url.startsWith(allowedEndpoint)) {
    return NextResponse.json(
      { error: "URL is not allowed for proxy fetching." },
      { status: 403 },
    );
  }

  let response: Response;
  try {
    response = await fetch(url, { redirect: "follow" });
  } catch (error) {
    console.error("Download proxy fetch failed:", error);
    return NextResponse.json(
      { error: "Unable to fetch remote resource." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Unable to fetch remote resource." },
      { status: 502 },
    );
  }

  const contentType =
    response.headers.get("content-type") || "application/octet-stream";
  const body = Buffer.from(await response.arrayBuffer());
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "no-store");

  const filename = parsedUrl.pathname.split("/").pop() || "download";
  headers.set(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(filename)}"`,
  );

  return new NextResponse(body, { status: 200, headers });
}
