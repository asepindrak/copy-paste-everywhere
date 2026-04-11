import { NextRequest, NextResponse } from "next/server";

const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;

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
      { error: "Only http(s) image URLs are supported." },
      { status: 400 },
    );
  }

  if (!IMAGE_EXTENSION_REGEX.test(parsedUrl.pathname)) {
    return NextResponse.json(
      { error: "URL does not appear to be an image." },
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
    console.error("Image proxy fetch failed:", error);
    return NextResponse.json(
      { error: "Unable to fetch remote image." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Unable to fetch remote image." },
      { status: 502 },
    );
  }

  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Fetched resource is not an image." },
      { status: 400 },
    );
  }

  const body = Buffer.from(await response.arrayBuffer());
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "no-store");

  return new NextResponse(body, { status: 200, headers });
}
