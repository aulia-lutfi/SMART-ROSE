import { apiClient } from "../../lib/apiClient"; // sesuaikan path relatif dengan lokasi file kamu

// ── Chatbot Publik (tanpa login) ──────────────────────────────────────────────
// Dipakai di form pengisian laporan insiden (semua step), yang selalu diakses
// tanpa login (sama seperti /lapor). Endpoint ini rule-based di backend
// (Fuse.js + Redis) — bukan AI generatif, jadi jawabannya cocok-cocokan
// dengan knowledge base yang sudah disiapkan admin, bukan jawaban bebas.
//
// Alur backend (dari smartrose-api-spec.json):
// - Kalau pertanyaan cocok dengan knowledge base/cache → jawaban langsung balik.
// - Kalau tidak cocok → pertanyaan dieskalasi ke admin (dijawab manual nanti,
//   TIDAK real-time — user tidak akan dapat balasan lanjutan di sesi yang sama).
//
// KONFIRMASI 20 Juli 2026 (dicek langsung dari tab Network saat testing real):
// bentuk `data` di response sukses adalah:
//   { logId: string, jawaban: string, sumber: "ESKALASI" | ... }
// - `jawaban` selalu berisi teks jawaban lengkap dari backend — termasuk saat
//   pertanyaan tidak ketemu di knowledge base, backend SUDAH mengirim teks
//   "Maaf, saya belum menemukan jawaban... diteruskan kepada Admin..." lewat
//   field ini juga, jadi FE tidak perlu bikin teks fallback sendiri.
// - `sumber` menandai asal jawaban. Nilai "ESKALASI" dikonfirmasi muncul saat
//   tidak ada kecocokan di knowledge base. Nilai lain (mis. "FAQ"/"CACHE")
//   untuk kasus ketemu langsung belum dikonfirmasi — kalau nanti ketemu nilai
//   lain yang belum tercakup, cukup tambah ke ESCALATED_SOURCES di bawah.

const ESCALATED_SOURCES = new Set(["ESKALASI"]);

function extractJawaban(data) {
  if (!data) return null;
  return data.jawaban ?? null;
}

function isEscalated(data) {
  if (!data) return false;
  return ESCALATED_SOURCES.has(data.sumber);
}

/**
 * Kirim pertanyaan ke chatbot publik (tanpa login).
 * @param {string} pertanyaan - 3 sampai 500 karakter (dibatasi backend & UI).
 * @returns {Promise<{ text: string, escalated: boolean }>}
 */
export async function askPublicChatbot(pertanyaan) {
  const trimmed = pertanyaan?.trim();

  if (!trimmed || trimmed.length < 3) {
    return {
      text: "Pertanyaan minimal 3 karakter ya, coba tulis lebih lengkap.",
      escalated: false,
    };
  }

  try {
    const response = await apiClient.post("/chatbot/public/ask", {
      pertanyaan: trimmed,
    });

    const { success, message, data } = response.data;

    if (!success) {
      return {
        text: message || "Maaf, terjadi kesalahan. Coba tanyakan lagi.",
        escalated: false,
      };
    }

    const jawaban = extractJawaban(data);
    const escalated = isEscalated(data);

    if (!jawaban) {
      // Jaga-jaga kalau suatu saat field `jawaban` kosong/hilang — seharusnya
      // tidak pernah terjadi berdasarkan testing, tapi tetap dikasih fallback
      // biar chat tidak nampilin bubble kosong.
      return {
        text: "Pertanyaan Anda sudah kami catat dan akan dijawab oleh tim admin. Untuk saat ini, silakan lanjutkan pengisian form sesuai panduan yang tersedia.",
        escalated: true,
      };
    }

    // Backend sudah kirim teks lengkap & sesuai lewat `jawaban`, baik untuk
    // jawaban ketemu langsung maupun kasus eskalasi — tinggal ditampilkan
    // apa adanya. `escalated` tetap dikembalikan buat kebutuhan UI (mis.
    // kasih badge/ikon beda di chat bubble kalau mau).
    return { text: jawaban, escalated };
  } catch (error) {
    const status = error?.response?.status;

    if (status === 429) {
      return {
        text: "Terlalu banyak pertanyaan dalam waktu singkat. Coba lagi sebentar lagi ya.",
        escalated: false,
      };
    }

    if (status === 400) {
      return {
        text:
          error?.response?.data?.message ||
          "Pertanyaan tidak valid, coba tulis ulang dengan lebih jelas.",
        escalated: false,
      };
    }

    console.error("Gagal menghubungi chatbot:", error);
    return {
      text: "Maaf, chatbot sedang tidak bisa dihubungi. Silakan coba lagi sebentar lagi.",
      escalated: false,
    };
  }
}

// ── Chatbot Eskalasi (Admin) ──────────────────────────────────────────────
// Dipakai NotifikasiAdminPage.jsx saat admin klik notifikasi tipe CHATBOT.
// referensiId pada notifikasi tipe CHATBOT = id pertanyaan (dipakai di :id
// kedua endpoint di bawah). Status pertanyaan (BELUM_TERJAWAB/TERJAWAB)
// TIDAK bisa diambil dari notifikasi itu sendiri (tipe sama untuk 2 event
// berbeda) — makanya harus fetch detail dulu tiap kali modal dibuka.

/**
 * Ambil detail 1 pertanyaan chatbot yang dieskalasi ke admin.
 * ✅ DIKONFIRMASI 26 Juli 2026 via Network tab: endpoint ini TIDAK
 * dibungkus {success,message,data} seperti endpoint lain — response.data
 * langsung berisi objek pertanyaan itu sendiri:
 * { id, pertanyaan, namaUser, createdAt, status, jawaban? }
 * @param {string} pertanyaanId
 */
export async function getPertanyaanEskalasi(pertanyaanId) {
  const response = await apiClient.get(`/chatbot/pertanyaan/${pertanyaanId}`);
  return response.data;
}

/**
 * Kirim jawaban admin untuk 1 pertanyaan eskalasi. Setelah sukses, backend
 * otomatis memasukkan jawaban ini ke knowledge base — pertanyaan serupa
 * berikutnya akan langsung terjawab otomatis tanpa eskalasi lagi.
 * ⚠️ Bentuk response POST ini belum dikonfirmasi testing nyata — kode di
 * bawah menangani 2 kemungkinan: dibungkus {success,message,data} ATAU
 * objek langsung (seperti GET di atas, yang sudah dikonfirmasi 26 Juli
 * 2026). Cek Network tab setelah submit pertama kali, dan kalau sudah
 * pasti bentuknya, hapus cabang yang tidak terpakai biar lebih ringkas.
 * @param {string} pertanyaanId
 * @param {string} jawaban - 3 sampai 2000 karakter (dibatasi backend).
 */
export async function jawabPertanyaanEskalasi(pertanyaanId, jawaban) {
  const trimmed = jawaban?.trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 2000) {
    throw new Error("Jawaban harus 3–2000 karakter.");
  }

  const response = await apiClient.post(
    `/chatbot/pertanyaan/${pertanyaanId}/jawab`,
    { jawaban: trimmed },
  );

  const payload = response.data;
  if (payload && typeof payload === "object" && "success" in payload) {
    if (!payload.success) {
      throw new Error(payload.message || "Gagal mengirim jawaban.");
    }
    return payload.data;
  }
  return payload;
}
