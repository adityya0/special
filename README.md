# Hammy Co-op 🐹 (Pixel Virtual Pet)

Website virtual pet hamster bergaya **pixel art** yang ringan, hamsternya aktif jalan/lari terus (*ga bisa diem*), tersimpan di browser (`localStorage`), dan mendukung **2 orang join bareng** lewat **Supabase Realtime (Broadcast & Presence) tanpa tabel database**.

## Fitur
- **Pixel Art Hamster Aktif**: Jalan, lari zoomies, naik roda lari, masuk terowongan, mandi pasir, makan, tidur, dan bisa dielus.
- **Data Ringan di Browser**: Status & profil hamster disimpan di `localStorage` (tanpa database).
- **Co-op 2 Orang (Supabase Realtime)**: Sinkronisasi aksi, kursor hati live, dan kirim emote/catatan lewat link invite `?room=KODE`.
- **8-bit Sound Effects**: Suara cicit & makan via Web Audio API (bisa di-mute).

## Cara Menjalankan Lokal
```bash
npm install
npm run dev
```

## Setup Co-op 2 Orang dengan Supabase (Tanpa Database)
1. Buat project gratis di [Supabase](https://supabase.com) (tidak perlu membuat tabel SQL apa pun).
2. Ambil **Project URL** dan **anon public key** dari **Project Settings → API**.
3. Isi di file `.env` (atau langsung di menu **👥 Join / Invite → Pengaturan Supabase** di website):
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## Deploy ke Vercel
1. Push folder ini ke GitHub.
2. Import repository di [Vercel](https://vercel.com) (Framework: **Vite**).
3. Tambahkan Environment Variables `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`, lalu klik **Deploy**.
