import { NextResponse } from 'next/server'
import { rtdb } from '@/lib/firebase-admin'

// Mengambil seluruh antrian pesanan dapur via Firebase Admin SDK
export async function GET(_req: Request) {
  try {
    const snapshot = await rtdb.ref('antrian_dapur').once('value')
    const data = snapshot.val() ?? {}
    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    console.error('❌ Gagal mengambil antrian_dapur via Admin:', error)
    return NextResponse.json(
      { ok: false, error: error?.message || 'Gagal mengambil antrian' },
      { status: 500 }
    )
  }
}

// Mengubah status pesanan dapur via Firebase Admin SDK
export async function POST(req: Request) {
  try {
    const { id, status } = await req.json()

    if (!id || !status) {
      return NextResponse.json(
        { error: 'ID pesanan dan status wajib diisi' },
        { status: 400 }
      )
    }

    await rtdb.ref(`antrian_dapur/${id}/status`).set(status)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('❌ Gagal update status via Admin:', error)
    return NextResponse.json(
      { ok: false, error: error?.message || 'Gagal update status' },
      { status: 500 }
    )
  }
}
