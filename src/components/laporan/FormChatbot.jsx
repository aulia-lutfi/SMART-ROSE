import { useState, useRef, useEffect } from "react";
import { X, Send, Clock } from "lucide-react";
import { askPublicChatbot } from "../../services/chatbot/chatbotService"; // sesuaikan path sesuai lokasi file kamu

// File-file ini ada di folder public/, jadi cukup direferensikan lewat path
// absolut dari root ("/nama-file.svg"), TIDAK di-import seperti modul JS
// biasa. Vite menyalin isi public/ apa adanya ke root saat build/serve.
const LogoAI = "/LOGOAI.svg";
const LogoSRose = "/LOGO_S-ROSE.svg";

// ── Konteks pesan per step ────────────────────────────────────────────────────
const STEP_CONTEXT = {
  1: {
    salam:
      "Halo! Saya asisten SMART-ROSE 👋\n\nSaya siap membantu Anda mengisi **Data Insiden** dengan benar.",
    quickReplies: [
      "Apa yang dimaksud dengan No. Rekam Medis?",
      "Bagaimana jika pasien tidak diketahui identitasnya?",
      "Apa perbedaan status rawat inap dan rawat jalan?",
    ],
  },
  2: {
    salam:
      "Butuh bantuan mengisi **Kronologi Kejadian**? 📋\n\nSaya siap memandu Anda mendeskripsikan insiden secara objektif.",
    quickReplies: [
      "Bagaimana cara menulis kronologi yang baik?",
      "Apa yang dimaksud dengan grading keparahan?",
      "Siapa saja yang termasuk pihak terlibat?",
    ],
  },
  3: {
    salam:
      "Saya siap membantu mengisi **Tindakan & Analisis** 🔍\n\nBagian ini penting untuk investigasi Komite Keselamatan Pasien.",
    quickReplies: [
      "Apa itu akar penyebab masalah (root cause)?",
      "Bagaimana menulis rekomendasi yang efektif?",
      "Apa contoh tindakan segera setelah insiden?",
    ],
  },
  4: {
    salam:
      "Bingung memilih **Jenis Insiden** yang tepat? ⚠️\n\nSaya bantu Anda menentukan kategori yang sesuai.",
    quickReplies: [
      "Apa perbedaan KPC, KNC, KTC, dan KTD?",
      "Kapan suatu insiden dikategorikan Sentinel?",
      "Bagaimana jika insiden belum jelas kategorinya?",
    ],
  },
  5: {
    salam:
      "Hampir selesai! 🎉 Saya bantu cek laporan Anda sebelum dikirim.\n\nAda bagian yang ingin dikonfirmasi?",
    quickReplies: [
      "Apakah data saya sudah lengkap?",
      "Apa yang terjadi setelah laporan dikirim?",
      "Bisakah laporan diubah setelah dikirim?",
    ],
  },
};

// ── Komponen Utama ────────────────────────────────────────────────────────────
export default function FormChatbot({ step = 1 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const ctx = STEP_CONTEXT[step] || STEP_CONTEXT[1];

  // Reset chat saat step berubah
  useEffect(() => {
    setMessages([
      {
        id: 1,
        from: "bot",
        text: ctx.salam,
      },
    ]);
    setInput("");
    setCharCount(0);
  }, [step]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Fokus input saat dibuka
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const handleSend = async (text) => {
    const msg = text || input.trim();
    if (!msg || isTyping) return; // cegah kirim dobel selagi nunggu jawaban

    const userMsg = { id: Date.now(), from: "user", text: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setCharCount(0);
    setIsTyping(true);

    // `escalated` datang dari chatbotService.js — true kalau backend tidak
    // menemukan jawaban di knowledge base (sumber: "ESKALASI") dan
    // pertanyaan sudah diteruskan ke Admin untuk dijawab manual (tidak
    // real-time, jadi tidak akan ada balasan lanjutan di sesi chat ini).
    const { text: jawaban, escalated } = await askPublicChatbot(msg);

    setIsTyping(false);
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + 1, from: "bot", text: jawaban, escalated },
    ]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (val.length <= 500) {
      setInput(val);
      setCharCount(val.length);
    }
  };

  return (
    <>
      {/* ── Popup Chat ── */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:right-6 sm:bottom-24 sm:w-96 lg:bottom-32">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={LogoSRose}
              alt="SMART-ROSE"
              className="h-8 w-auto object-contain"
            />
            <div className="w-7" />
          </div>

          {/* Area Chat */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{ maxHeight: "380px" }}
          >
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.from === "bot" ? (
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                        <img
                          src={LogoAI}
                          alt="SMART-ROSE AI"
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                        {msg.text}
                        {msg.escalated && (
                          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                            <Clock className="h-3 w-3 shrink-0" />
                            Menunggu jawaban Admin
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-blue-600 px-3.5 py-2.5 text-sm leading-relaxed text-white">
                        {msg.text}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                    <img
                      src={LogoAI}
                      alt="SMART-ROSE AI"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Quick Replies — muncul setelah pesan awal */}
            {messages.length === 1 && (
              <div className="mt-4 space-y-2">
                {ctx.quickReplies.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs text-slate-700 hover:bg-blue-50 hover:border-blue-200 transition active:scale-95"
                  >
                    <span className="text-blue-500">›</span>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Tanyakan apa saja"
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
                  input.trim() && !isTyping
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-right text-[10px] text-slate-400">
              {charCount}/500
            </p>
          </div>
        </div>
      )}

      {/* ── Floating Button ── */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fixed bottom-4 right-4 z-50 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg transition active:scale-95 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14 lg:h-16 lg:w-16 ${
          isOpen
            ? "bg-slate-700 hover:bg-slate-800"
            : "bg-white hover:opacity-90"
        }`}
      >
        {isOpen ? (
          <X className="h-8 w-8 text-white sm:h-6 sm:w-6 lg:h-10 lg:w-10" />
        ) : (
          <img
            src={LogoAI}
            alt="Buka SMART-ROSE AI Assistant"
            className="h-full w-full object-contain p-1"
          />
        )}
      </button>
    </>
  );
}
