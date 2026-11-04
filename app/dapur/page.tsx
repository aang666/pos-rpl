"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { onValue, ref, set } from "firebase/database";
import { db } from "@/lib/firebase-client";

type Pesanan = {
  id: string;
  no_nota: string;
  items: {
    nama: string;
    qty: number;
  }[];
  status: "baru" | "diproses" | "siap";
  waktu: number;
};

function waktuRelatif(waktu: number): string {
  const selisih = Math.floor((Date.now() - waktu) / 1000);
  if (selisih < 60) return "Baru saja";
  const menit = Math.floor(selisih / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  return `${jam} jam ${menit % 60} menit lalu`;
}

function formatJam(date: Date): string {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function DapurPage() {
  const [mounted, setMounted] = useState(false);
  const [antrian, setAntrian] = useState<Pesanan[]>([]);
  const [jam, setJam] = useState<Date | null>(null);
  const [adaPesananBaru, setAdaPesananBaru] = useState(false);
  const [jumlahBaruSebelumnya, setJumlahBaruSebelumnya] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modeKoneksi, setModeKoneksi] = useState<"realtime" | "api">("realtime");
  const [, setTick] = useState(0);
  const fallbackPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Ambil data antrian via Next.js API (Admin SDK Firebase)
  const ambilDariApi = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch("/api/dapur", { cache: "no-store" });
      const json = await res.json();

      if (json.ok && json.data) {
        const tigaPuluhMenitMs = 30 * 60 * 1000;
        const sekarang = Date.now();
        const hasil = Object.entries(json.data).map(([id, p]: [string, any]) => ({
          id,
          ...p,
        })) as Pesanan[];

        const filtered = hasil.filter(
          (p) =>
            p.status !== "siap" || sekarang - p.waktu < tigaPuluhMenitMs,
        );

        setAntrian(filtered.sort((a, b) => a.waktu - b.waktu));
      }
    } catch (err) {
      console.error("Gagal ambil antrian via API:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Jam berjalan setiap detik di sisi client
  useEffect(() => {
    setMounted(true);
    setJam(new Date());
    const interval = setInterval(() => {
      setJam(new Date());
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listener Firebase Realtime Database + Fallback API Polling
  useEffect(() => {
    const tigaPuluhMenitMs = 30 * 60 * 1000;

    // 1. Ambil data pertama kali via API Admin segera setelah dimuat
    ambilDariApi();

    // 2. Hubungkan listener realtime Firebase Client
    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = onValue(
        ref(db, "antrian_dapur"),
        (snapshot) => {
          const data = snapshot.val() ?? {};
          const hasil = Object.entries(data).map(([id, p]: [string, any]) => ({
            id,
            ...p,
          })) as Pesanan[];

          const sekarang = Date.now();
          const filtered = hasil.filter(
            (p) =>
              p.status !== "siap" || sekarang - p.waktu < tigaPuluhMenitMs,
          );

          setAntrian(filtered.sort((a, b) => a.waktu - b.waktu));
          setModeKoneksi("realtime");
        },
        (error) => {
          console.warn("⚠️ Firebase Client realtime listener dibatasi/gagal:", error.message);
          setModeKoneksi("api");

          // Jalankan fallback polling API setiap 4 detik jika realtime ditolak
          if (!fallbackPollingRef.current) {
            fallbackPollingRef.current = setInterval(ambilDariApi, 4000);
          }
        }
      );
    } catch (e) {
      console.warn("Firebase listener exception, beralih ke mode polling API:", e);
      setModeKoneksi("api");
      fallbackPollingRef.current = setInterval(ambilDariApi, 4000);
    }

    // Polling berkala cadangan setiap 10 detik agar data selalu sinkron
    const periodicSync = setInterval(ambilDariApi, 10000);

    return () => {
      if (unsubscribe) unsubscribe();
      if (fallbackPollingRef.current) clearInterval(fallbackPollingRef.current);
      clearInterval(periodicSync);
    };
  }, [ambilDariApi]);

  // Efek kedip notifikasi pesanan baru
  useEffect(() => {
    const jumlahBaru = antrian.filter((p) => p.status === "baru").length;
    if (jumlahBaru > jumlahBaruSebelumnya && jumlahBaruSebelumnya >= 0) {
      setAdaPesananBaru(true);
      const timeout = setTimeout(() => setAdaPesananBaru(false), 5000);
      return () => clearTimeout(timeout);
    }
    setJumlahBaruSebelumnya(jumlahBaru);
  }, [antrian, jumlahBaruSebelumnya]);

  // Fungsi ubah status pesanan
  const ubahStatus = useCallback(
    async (id: string, status: Pesanan["status"]) => {
      // Update optimistik di layar seketika
      setAntrian((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status } : p))
      );

      // Kirim via Next.js API (Admin SDK Firebase) untuk jaminan tersimpan
      try {
        await fetch("/api/dapur", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status }),
        });
      } catch (e) {
        console.warn("Gagal update via API dapur:", e);
      }

      // Coba juga via Firebase Client
      try {
        await set(ref(db, `antrian_dapur/${id}/status`), status);
      } catch {
        // Ignored, API route already handled it
      }
    },
    [],
  );

  const pesananBaru = antrian.filter((p) => p.status === "baru");
  const pesananDiproses = antrian.filter((p) => p.status === "diproses");
  const pesananSiap = antrian.filter((p) => p.status === "siap");

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col select-none">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🍳</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
                POS — Monitor Dapur
              </h1>
              {adaPesananBaru && (
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400">
                Koneksi: {modeKoneksi === "realtime" ? "🟢 Realtime" : "🟡 Auto-Sync API"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => ambilDariApi()}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 active:scale-95 text-xs md:text-sm font-semibold px-3 py-2 rounded-lg border border-gray-700 transition cursor-pointer disabled:opacity-50"
          >
            <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
            {isRefreshing ? "Memuat..." : "Segarkan"}
          </button>

          <div className="text-right">
            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest">
              Waktu Sekarang
            </p>
            <p
              suppressHydrationWarning
              className="text-xl md:text-2xl font-mono font-bold tabular-nums text-amber-400"
            >
              {jam ? formatJam(jam) : "--:--:--"}
            </p>
          </div>
        </div>
      </header>

      {/* ── Three‑column grid ── */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-0 overflow-hidden">
        {/* ===== Kolom: Pesanan Baru ===== */}
        <KolomPesanan
          judul="🆕 Pesanan Baru"
          jumlah={pesananBaru.length}
          warnaBg="bg-red-950/30"
          warnaBadge="bg-red-600"
          warnaHeader="border-red-700"
          daftar={pesananBaru}
          renderAksi={(p) => (
            <button
              onClick={() => ubahStatus(p.id, "diproses")}
              className="w-full mt-4 py-3 rounded-xl text-lg font-bold bg-orange-600 hover:bg-orange-500 active:scale-95 transition-all duration-150 cursor-pointer shadow-lg shadow-orange-900/30"
            >
              🔥 Mulai Masak
            </button>
          )}
          warnaKartu="border-red-800/60 bg-red-950/50"
        />

        {/* ===== Kolom: Sedang Dimasak ===== */}
        <KolomPesanan
          judul="🔥 Sedang Dimasak"
          jumlah={pesananDiproses.length}
          warnaBg="bg-yellow-950/20"
          warnaBadge="bg-yellow-600"
          warnaHeader="border-yellow-700"
          daftar={pesananDiproses}
          renderAksi={(p) => (
            <button
              onClick={() => ubahStatus(p.id, "siap")}
              className="w-full mt-4 py-3 rounded-xl text-lg font-bold bg-green-600 hover:bg-green-500 active:scale-95 transition-all duration-150 cursor-pointer shadow-lg shadow-green-900/30"
            >
              ✅ Selesai Masak
            </button>
          )}
          warnaKartu="border-yellow-800/60 bg-yellow-950/40"
        />

        {/* ===== Kolom: Siap Disajikan ===== */}
        <KolomPesanan
          judul="✅ Siap Disajikan"
          jumlah={pesananSiap.length}
          warnaBg="bg-emerald-950/20"
          warnaBadge="bg-emerald-600"
          warnaHeader="border-emerald-700"
          daftar={pesananSiap}
          renderAksi={() => (
            <div className="w-full mt-4 py-2.5 rounded-xl text-center text-sm font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-800/50">
              ✓ Menunggu Diambil Pelayan
            </div>
          )}
          warnaKartu="border-emerald-800/60 bg-emerald-950/40"
        />
      </div>
    </main>
  );
}

/* ────────────────────────────────────────────
   Komponen: Kolom Pesanan
   ──────────────────────────────────────────── */

function KolomPesanan({
  judul,
  jumlah,
  warnaBg,
  warnaBadge,
  warnaHeader,
  warnaKartu,
  daftar,
  renderAksi,
}: {
  judul: string;
  jumlah: number;
  warnaBg: string;
  warnaBadge: string;
  warnaHeader: string;
  warnaKartu: string;
  daftar: Pesanan[];
  renderAksi: (p: Pesanan) => React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col ${warnaBg} border-r border-gray-800 last:border-r-0 h-full overflow-hidden`}
    >
      {/* Column header */}
      <div
        className={`flex items-center justify-between px-5 py-3 border-b-2 ${warnaHeader} bg-gray-900/60 shrink-0`}
      >
        <h2 className="text-lg md:text-xl font-bold tracking-wide">
          {judul}
        </h2>
        <span
          className={`${warnaBadge} text-white text-sm md:text-base font-bold rounded-full min-w-[2rem] h-8 px-2 flex items-center justify-center`}
        >
          {jumlah}
        </span>
      </div>

      {/* Scrollable card list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {daftar.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 opacity-40 py-12">
            <span className="text-4xl mb-2">📭</span>
            <p className="text-sm">Tidak ada pesanan</p>
          </div>
        ) : (
          daftar.map((p) => (
            <KartuPesanan
              key={p.id}
              pesanan={p}
              warnaKartu={warnaKartu}
              renderAksi={renderAksi}
            />
          ))
        )}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   Komponen: Kartu Pesanan
   ──────────────────────────────────────────── */

function KartuPesanan({
  pesanan,
  warnaKartu,
  renderAksi,
}: {
  pesanan: Pesanan;
  warnaKartu: string;
  renderAksi: (p: Pesanan) => React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${warnaKartu} transition-all duration-300 shadow-md`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
        <span className="text-xl md:text-2xl font-extrabold tracking-wide text-amber-300">
          #{pesanan.no_nota}
        </span>
        <span suppressHydrationWarning className="text-xs text-gray-400 font-mono">
          {waktuRelatif(pesanan.waktu)}
        </span>
      </div>

      {/* Item list */}
      <ul className="space-y-2 mb-2">
        {pesanan.items.map((item, i) => (
          <li
            key={`${item.nama}-${i}`}
            className="flex items-center gap-3 text-base md:text-lg"
          >
            <span className="font-extrabold text-amber-400 bg-black/40 px-2 py-0.5 rounded text-sm min-w-[2rem] text-center">
              {item.qty}×
            </span>
            <span className="font-medium text-gray-100">{item.nama}</span>
          </li>
        ))}
      </ul>

      {/* Action button */}
      {renderAksi(pesanan)}
    </div>
  );
}
