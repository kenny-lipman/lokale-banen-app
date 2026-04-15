/**
 * Signed Upload URL API
 *
 * POST /api/storage/signed-upload
 *
 * Generates a short-lived signed upload URL so the admin client can upload
 * directly to Supabase Storage without exposing the service role key.
 *
 * Body: { bucket, path, contentType, sizeBytes }
 * Returns: { signedUrl, token, path, publicUrl }
 */

import { NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

// Whitelisted buckets. Each bucket can have its own limits and MIME types.
const BUCKET_CONFIG = {
  "platform-assets": {
    maxSizeBytes: 2 * 1024 * 1024, // 2MB
    allowedMimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
      "image/x-icon",
    ],
  },
  "company-logos": {
    maxSizeBytes: 2 * 1024 * 1024,
    allowedMimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ],
  },
  "job-images": {
    maxSizeBytes: 3 * 1024 * 1024, // 3MB
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
} as const

type AllowedBucket = keyof typeof BUCKET_CONFIG

function isAllowedBucket(bucket: string): bucket is AllowedBucket {
  return bucket in BUCKET_CONFIG
}

// Reject traversal / absolute paths so the client cannot escape the bucket root.
function isSafePath(path: string): boolean {
  if (!path || typeof path !== "string") return false
  if (path.length > 512) return false
  if (path.startsWith("/") || path.startsWith("\\")) return false
  if (path.includes("..")) return false
  // Only allow basic path chars
  return /^[A-Za-z0-9_\-./]+$/.test(path)
}

async function handler(
  request: NextRequest,
  _auth: AuthResult
): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const { bucket, path, contentType, sizeBytes } = (body ?? {}) as Record<
    string,
    unknown
  >

  if (typeof bucket !== "string" || !isAllowedBucket(bucket)) {
    return NextResponse.json(
      {
        error: "Invalid bucket",
        code: "INVALID_BUCKET",
        details: `Allowed: ${Object.keys(BUCKET_CONFIG).join(", ")}`,
      },
      { status: 400 }
    )
  }

  if (typeof path !== "string" || !isSafePath(path)) {
    return NextResponse.json(
      {
        error: "Invalid path",
        code: "INVALID_PATH",
        details: "Path must be relative and contain only safe characters",
      },
      { status: 400 }
    )
  }

  if (typeof contentType !== "string") {
    return NextResponse.json(
      { error: "Missing contentType", code: "INVALID_CONTENT_TYPE" },
      { status: 400 }
    )
  }

  const config = BUCKET_CONFIG[bucket]

  if (!config.allowedMimeTypes.includes(contentType as never)) {
    return NextResponse.json(
      {
        error: `MIME type not allowed`,
        code: "INVALID_MIME_TYPE",
        details: `Allowed: ${config.allowedMimeTypes.join(", ")}`,
      },
      { status: 400 }
    )
  }

  if (typeof sizeBytes !== "number" || sizeBytes <= 0) {
    return NextResponse.json(
      { error: "Invalid sizeBytes", code: "INVALID_SIZE" },
      { status: 400 }
    )
  }

  if (sizeBytes > config.maxSizeBytes) {
    return NextResponse.json(
      {
        error: `File too large`,
        code: "FILE_TOO_LARGE",
        details: `Max ${config.maxSizeBytes} bytes (${(
          config.maxSizeBytes /
          1024 /
          1024
        ).toFixed(1)}MB), got ${sizeBytes}`,
      },
      { status: 400 }
    )
  }

  try {
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: true })

    if (error || !data) {
      return NextResponse.json(
        {
          error: "Failed to create signed upload URL",
          details: error?.message,
        },
        { status: 500 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${data.path}`

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      publicUrl,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Storage error", details: message },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handler)
