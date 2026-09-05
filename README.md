<div align="center">

# Noir Translator

**High-Performance Offline-First AI Novel Translator**  
*The translation companion engineered for seamless synergy with Noir Reader.*

</div>

---

## 📖 Tentang Noir Translator

**Noir Translator** adalah sistem penerjemah novel AI berbasis web *full-stack* yang dirancang khusus untuk kenyamanan penerjemahan literatur bertahap, retensi glosarium kontekstual dinamis, dan efisiensi daya tinggi pada perangkat bergerak (khususnya Android Termux).

### ✨ Fitur Utama
- **AI Translation Engine:** Dukungan model AI terdepan (Google Gemini & OpenRouter) dengan pemeliharaan nuansa sastra (*prose flow*) dan konsistensi istilah.
- **Dynamic Context & Glossary:** Ekstraksi otomatis istilah kunci, nama tokoh, dan lore per novel untuk mencegah inkonsistensi terjemahan antar-bab.
- **Granular Storage Engine:** Penyimpanan modular per bab berbasis Markdown (`.md`) dan indeks JSON yang hemat I/O.
- **Termux & Battery Optimized:** Dilengkapi *HTTP keep-alive dispatcher*, *lazy rate-limit pruning*, dan *focus refetch throttling* untuk menghemat daya baterai dan radio modem.
- **Format Export Terstandar:** Ekspor langsung ke struktur folder Markdown atau file `.zip` yang kompatibel dan siap dibaca di **Noir Reader**.

---

## 🚀 Menjalankan Secara Lokal

**Prasyarat:** Node.js (v18+) atau Bun

1. **Kloning repositori:**
   ```bash
   git clone https://github.com/QadimilAwaly/noir-translator.git
   cd noir-translator
   ```
2. **Instal dependensi:**
   ```bash
   npm install
   ```
3. **Konfigurasi Environment:**
   Salin `.env.example` ke `.env.local` dan isi API key Anda:
   ```bash
   cp .env.example .env.local
   # Masukkan GEMINI_API_KEY atau OPENROUTER_API_KEY
   ```
4. **Jalankan aplikasi (Development):**
   ```bash
   npm run dev
   ```

---

## 📱 Panduan Khusus Android (Termux)

Noir Translator dioptimalkan secara mendalam untuk berjalan di lingkungan Termux Android tanpa membebani sistem.

### 1. Persiapan Termux
```bash
pkg update && pkg upgrade -y
pkg install nodejs-lts git esbuild -y
termux-wake-lock
```

### 2. Atur Binary esbuild
```bash
export ESBUILD_BINARY_PATH=$(which esbuild)
```
*(Tambahkan baris di atas ke `~/.bashrc` agar otomatis aktif).*

### 3. Build & Jalankan Mode Production
> **Rekomendasi:** Mode Production hanya mengonsumsi **~35MB RAM** (dibandingkan ~400MB pada dev mode) dan sangat tahan terhadap pembunuhan proses oleh Android Low Memory Killer (LMK).

```bash
# Build aplikasi:
npm run build

# Jalankan server:
npm start
```

Buka browser Anda dan akses: `http://localhost:3131`  
Untuk akses jaringan lokal (Wi-Fi): `HOST=0.0.0.0 npm start` lalu buka `http://<IP-HP>:3131`.

---

## 🧪 Testing & Quality Gates

Suit pengujian mandiri menggunakan Bun:
```bash
# Menjalankan seluruh test suite
bun run test:all

# Pengujian spesifik
bun run test:security
bun run test:client
bun run test:unit
```

---

## 📄 Lisensi
Didistribusikan di bawah lisensi MIT. Dikembangkan bersama ekosistem **Noir Reader**.
