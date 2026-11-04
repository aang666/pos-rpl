import { NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase/server'
import { rtdb } from '@/lib/firebase-admin'

type ItemMasuk = {
  produk_id: string
  qty: number
  nama?: string
}

export async function POST(req: Request) {
  const supabase = await supabaseServer()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Harus login terlebih dahulu' },
      { status: 401 }
    )
  }

  try {
    const {
      items,
      bayar,
      metode
    } = await req.json() as {
      items: ItemMasuk[]
      bayar: number
      metode?: string
    }

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      !Number.isFinite(bayar) ||
      bayar < 0 ||
      items.some(item =>
        typeof item.produk_id !== 'string' ||
        !Number.isInteger(item.qty) ||
        item.qty <= 0
      )
    ) {
      return NextResponse.json(
        { error: 'Data pembayaran tidak valid' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.rpc(
      'buat_transaksi',
      {
        p_items: items.map(i => ({ produk_id: i.produk_id, qty: i.qty })),
        p_bayar: bayar,
        p_metode: metode ?? 'tunai'
      }
    )

    if (error || !data?.length) {
      console.error('❌ RPC buat_transaksi error:', error)
      return NextResponse.json(
        { error: error?.message ?? 'Transaksi gagal' },
        { status: 400 }
      )
    }

    const trx = data[0]

    // Ambil detail transaksi dari Supabase
    const { data: rows, error: rowError } = await supabase
      .from('detail_transaksi')
      .select('qty, produk(nama, perlu_dapur)')
      .eq('transaksi_id', trx.o_transaksi_id)

    if (rowError) {
      console.warn('⚠️ Gagal query detail_transaksi:', rowError.message)
    }

    // Susun item untuk dapur:
    // 1. Cek apakah ada produk dengan perlu_dapur === true
    // 2. Jika tidak ada / null, fallback ke seluruh item yang dibeli agar dapur tetap menerima pesanan
    let itemDapur: { nama: string; qty: number }[] = []

    if (rows && rows.length > 0) {
      const itemsDenganPerluDapur = rows.filter((r: any) => r.produk?.perlu_dapur === true)
      if (itemsDenganPerluDapur.length > 0) {
        itemDapur = itemsDenganPerluDapur.map((r: any) => ({
          nama: r.produk?.nama ?? 'Item',
          qty: r.qty
        }))
      } else {
        // Fallback: sertakan semua item jika kolom perlu_dapur tidak bernilai true
        itemDapur = rows.map((r: any) => ({
          nama: r.produk?.nama ?? 'Item',
          qty: r.qty
        }))
      }
    }

    // 3. Fallback cadangan: jika query detail_transaksi kosong (misal kendala RLS), gunakan data items dari kasir
    if (itemDapur.length === 0 && items.length > 0) {
      itemDapur = items.map(item => ({
        nama: item.nama ?? 'Item Pesanan',
        qty: item.qty
      }))
    }

    let dapurOk = true

    if (itemDapur.length > 0) {
      try {
        console.log(`📡 Mengirim pesanan ${trx.o_no_nota} ke antrian_dapur Firebase...`, itemDapur)
        await rtdb.ref(
          `antrian_dapur/${trx.o_transaksi_id}`
        ).set({
          no_nota: trx.o_no_nota,
          items: itemDapur,
          status: 'baru',
          waktu: Date.now()
        })
        console.log(`✅ Pesanan ${trx.o_no_nota} berhasil terkirim ke Firebase!`)
      } catch (err: any) {
        console.error('❌ Gagal menulis ke Firebase RTDB:', err?.message || err)
        dapurOk = false
      }
    } else {
      console.warn('⚠️ Tidak ada item yang dikirim ke dapur.')
    }

    return NextResponse.json({
      ok: true,
      no_nota: trx.o_no_nota,
      total: trx.o_total,
      kembalian: trx.o_kembalian,
      dapurOk
    })

  } catch (err: any) {
    console.error('❌ Kesalahan server checkout:', err)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
