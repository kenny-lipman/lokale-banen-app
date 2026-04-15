import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

interface RevalidateBody {
  tags?: string[]
  paths?: string[]
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-revalidate-secret')
  const expected = process.env.REVALIDATE_SECRET

  if (!expected) {
    return NextResponse.json(
      { error: 'REVALIDATE_SECRET not configured on public-sites' },
      { status: 500 }
    )
  }

  if (!secret || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: RevalidateBody
  try {
    body = (await req.json()) as RevalidateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const tags = Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === 'string') : []
  const paths = Array.isArray(body.paths) ? body.paths.filter((p) => typeof p === 'string') : []

  for (const tag of tags) revalidateTag(tag, { expire: 0 })
  for (const path of paths) revalidatePath(path)

  return NextResponse.json({
    revalidated: true,
    tags,
    paths,
    timestamp: new Date().toISOString(),
  })
}
