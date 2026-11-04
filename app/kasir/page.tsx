'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

type Produk = {
  id: string
  nama: string
  harga: number
  stok: number
}

type Keranjang = Produk & {
  qty: number
}

type HasilCheckout = {
  no_nota: string
  total: number
  kembalian: number
}

export default function KasirPage() {
  const supabase = supabaseBrowser()
  const router = useRouter()

  const [produk, setProduk] = useState<Produk[]>([])
  const [keranjang, setKeranjang] = useState<Keranjang[]>([])
  const [bayar, setBayar] = useState('')
  const [cari, setCari] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingProduk, setLoadingProduk] = useState(true)

  // Receipt modal state
  const [showNota, setShowNota] = useState(false)
  const [hasilNota, setHasilNota] = useState<HasilCheckout | null>(null)
  const [notaItems, setNotaItems] = useState<Keranjang[]>([])
  const [notaBayar, setNotaBayar] = useState(0)

  const rp = (n: number) => n.toLocaleString('id-ID')

  async function ambilProduk() {
    setLoadingProduk(true)
    const { data, error } = await supabase
      .from('produk')
      .select('id,nama,harga,stok')
      .eq('aktif', true)
      .order('nama')

    if (!error) {
      setProduk(data || [])
    }
    setLoadingProduk(false)
  }

  const produkFiltered = produk.filter(item =>
    item.nama.toLowerCase().includes(cari.toLowerCase())
  )

  function tambahKeranjang(item: Produk) {
    if (item.stok <= 0) {
      alert('Stok habis')
      return
    }

    setKeranjang(old => {
      const ditemukan = old.find(x => x.id === item.id)

      if (ditemukan) {
        if (ditemukan.qty >= item.stok) {
          alert('Stok tidak mencukupi')
          return old
        }

        return old.map(x =>
          x.id === item.id
            ? { ...x, qty: x.qty + 1 }
            : x
        )
      }

      return [...old, { ...item, qty: 1 }]
    })
  }

  function ubahQty(id: string, delta: number) {
    setKeranjang(old => {
      return old
        .map(item => {
          if (item.id !== id) return item
          const newQty = item.qty + delta
          if (newQty <= 0) return null
          if (newQty > item.stok) {
            alert('Stok tidak mencukupi')
            return item
          }
          return { ...item, qty: newQty }
        })
        .filter((item): item is Keranjang => item !== null)
    })
  }

  function hapusItem(id: string) {
    setKeranjang(old => old.filter(item => item.id !== id))
  }

  function kosongkanKeranjang() {
    setKeranjang([])
    setBayar('')
  }

  const total = keranjang.reduce(
    (jumlah, item) =>
      jumlah + item.harga * item.qty,
    0
  )

  const jumlahItem = keranjang.reduce((j, item) => j + item.qty, 0)

  async function checkout() {
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: keranjang.map(item => ({
            produk_id: item.id,
            nama: item.nama,
            qty: item.qty
          })),
          bayar: Number(bayar),
          metode: 'tunai'
        })
      })

      const hasil = await res.json()

      if (!res.ok) {
        alert(hasil.error)
        return
      }

      if (hasil.dapurOk === false) {
        alert('⚠️ Pesanan tersimpan di kasir, namun antrian dapur gagal terhubung ke Firebase. Cek koneksi Firebase!')
      }

      // Show receipt modal
      setHasilNota({
        no_nota: hasil.no_nota,
        total: hasil.total,
        kembalian: hasil.kembalian,
      })
      setNotaItems([...keranjang])
      setNotaBayar(Number(bayar))
      setShowNota(true)

      setKeranjang([])
      setBayar('')
      ambilProduk()
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  useEffect(() => {
    ambilProduk()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-gradient-to-r from-amber-600 to-orange-500 text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <h1 className="text-xl font-bold tracking-wide">🍽️ POS — Kasir</h1>
        <button
          onClick={logout}
          className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          🚪 Logout
        </button>
      </header>

      {/* ── Main two‑panel layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT: Product Grid ── */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Search */}
          <div className="relative mb-5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔍</span>
            <input
              type="text"
              placeholder="Cari produk..."
              value={cari}
              onChange={e => setCari(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-orange-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
            />
          </div>

          {/* Product grid */}
          {loadingProduk ? (
            <div className="flex items-center justify-center h-64 text-orange-400">
              <p className="text-lg">⏳ Memuat produk...</p>
            </div>
          ) : produkFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <p className="text-5xl mb-3">📦</p>
              <p className="text-lg font-medium">
                {cari ? 'Produk tidak ditemukan' : 'Belum ada produk'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {produkFiltered.map(item => {
                const habis = item.stok <= 0
                return (
                  <button
                    key={item.id}
                    onClick={() => tambahKeranjang(item)}
                    disabled={habis}
                    className={`relative bg-white rounded-2xl p-4 text-left shadow-md border border-orange-100 transition-all cursor-pointer
                      ${habis
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:shadow-xl hover:-translate-y-1 hover:border-amber-300 active:scale-[0.97]'
                      }`}
                  >
                    {habis && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        HABIS
                      </span>
                    )}
                    <h3 className="font-bold text-gray-800 text-sm mb-2 line-clamp-2">{item.nama}</h3>
                    <p className="text-amber-600 font-bold text-base">Rp{rp(item.harga)}</p>
                    <p className="text-xs text-gray-400 mt-1">Stok: {item.stok}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: Cart Sidebar ── */}
        <aside className="w-[380px] bg-white border-l border-orange-100 flex flex-col shadow-xl">
          {/* Cart header */}
          <div className="px-5 py-4 border-b border-orange-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800 text-lg">🛒 Keranjang <span className="text-amber-500 text-sm font-normal">({jumlahItem} item)</span></h2>
            {keranjang.length > 0 && (
              <button
                onClick={kosongkanKeranjang}
                className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors cursor-pointer"
              >
                🗑️ Kosongkan
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {keranjang.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300">
                <p className="text-5xl mb-3">🛒</p>
                <p className="text-sm font-medium">Keranjang kosong</p>
                <p className="text-xs mt-1">Pilih produk untuk memulai</p>
              </div>
            ) : (
              <div className="space-y-3">
                {keranjang.map(item => (
                  <div
                    key={item.id}
                    className="bg-orange-50 rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{item.nama}</p>
                      <p className="text-amber-600 text-xs font-medium">Rp{rp(item.harga)}</p>
                    </div>
                    {/* Qty controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => ubahQty(item.id, -1)}
                        className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                      >
                        ➖
                      </button>
                      <span className="w-8 text-center font-bold text-sm text-gray-800">{item.qty}</span>
                      <button
                        onClick={() => ubahQty(item.id, 1)}
                        className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                      >
                        ➕
                      </button>
                    </div>
                    {/* Subtotal + delete */}
                    <div className="text-right flex flex-col items-end gap-1">
                      <p className="font-bold text-sm text-gray-800">Rp{rp(item.harga * item.qty)}</p>
                      <button
                        onClick={() => hapusItem(item.id)}
                        className="text-red-300 hover:text-red-500 text-xs transition-colors cursor-pointer"
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart footer: total, payment, checkout */}
          <div className="border-t border-orange-100 px-5 py-4 space-y-3 bg-orange-50/50">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium text-sm">Total</span>
              <span className="text-xl font-bold text-gray-800">Rp{rp(total)}</span>
            </div>

            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">💵 Bayar (Rp)</label>
              <input
                type="number"
                placeholder="Masukkan jumlah uang"
                className="w-full px-4 py-3 rounded-xl border border-orange-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                value={bayar}
                onChange={e => setBayar(e.target.value)}
              />
            </div>

            {bayar && Number(bayar) >= total && total > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Kembalian</span>
                <span className="font-bold text-green-600">Rp{rp(Number(bayar) - total)}</span>
              </div>
            )}

            <button
              onClick={checkout}
              disabled={
                keranjang.length === 0 ||
                Number(bayar) < total ||
                loading
              }
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer text-sm"
            >
              {loading ? '⏳ Memproses...' : '💰 Bayar Sekarang'}
            </button>
          </div>
        </aside>
      </div>

      {/* ── Receipt Modal ── */}
      {showNota && hasilNota && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4 text-center">
              <p className="text-3xl mb-1">✅</p>
              <h3 className="text-lg font-bold">Transaksi Berhasil!</h3>
              <p className="text-sm opacity-90">No. Nota: {hasilNota.no_nota}</p>
            </div>

            {/* Items */}
            <div className="px-6 py-4 max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left py-2 font-medium">Item</th>
                    <th className="text-center py-2 font-medium">Qty</th>
                    <th className="text-right py-2 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {notaItems.map(item => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="py-2 text-gray-700">{item.nama}</td>
                      <td className="py-2 text-center text-gray-500">{item.qty}</td>
                      <td className="py-2 text-right font-medium text-gray-700">Rp{rp(item.harga * item.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="px-6 py-3 bg-orange-50 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total</span>
                <span className="font-bold text-gray-800">Rp{rp(hasilNota.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Bayar</span>
                <span className="font-medium text-gray-700">Rp{rp(notaBayar)}</span>
              </div>
              <div className="flex justify-between border-t border-orange-200 pt-1.5">
                <span className="text-gray-500">Kembalian</span>
                <span className="font-bold text-green-600 text-base">Rp{rp(hasilNota.kembalian)}</span>
              </div>
            </div>

            {/* Close button */}
            <div className="px-6 py-4">
              <button
                onClick={() => setShowNota(false)}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 rounded-xl transition-all cursor-pointer text-sm"
              >
                🆗 Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
