import { useState } from "react";
import { Save, X, Upload, FileText, Image } from "lucide-react";
import * as edukasiService from "../../services/admin/edukasiService";

export default function FormEdukasiPage({
  mode = "add",
  modul = null,
  onBack,
}) {
  const isEditMode = mode === "edit" && modul;

  const [formData, setFormData] = useState({
    judul: modul?.judul || "",
    kategori: modul?.kategori || "",
    tipe: modul?.tipe || "Video",
    deskripsi: modul?.deskripsi || "",
    konten: modul?.konten || "",
    durasi: modul?.durasi || "",
    media: null,
  });

  const [dragActive, setDragActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleFileSelect = (file) => {
    if (file) {
      setFormData({
        ...formData,
        media: file,
      });
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleSave = async () => {
    if (!formData.judul.trim()) {
      setFormError("Judul modul tidak boleh kosong!");
      return;
    }
    if (!formData.kategori) {
      setFormError("Kategori wajib dipilih!");
      return;
    }
    if (!formData.konten.trim()) {
      setFormError("Isi/Deskripsi materi tidak boleh kosong!");
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      if (isEditMode) {
        await edukasiService.updateModulEdukasi(modul.id, formData);
      } else {
        await edukasiService.createModulEdukasi(formData);
      }
      onBack();
    } catch (err) {
      setFormError(
        err.message ||
          `Gagal ${isEditMode ? "memperbarui" : "menambahkan"} modul edukasi.`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const categories = [
    "Pengenalan Jenis Insiden",
    "Keamanan Pemberian Obat",
    "Komunikasi Efektif",
    "Prosedur Bedah",
    "Pencegahan Infeksi",
  ];

  const types = ["Video", "Dokumen", "Interaktif"];

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // Get file icon based on type
  const getFileIcon = (type) => {
    if (type.includes("image")) return Image;
    if (type.includes("video")) return FileText;
    if (type.includes("pdf")) return FileText;
    return FileText;
  };

  return (
    <>
      {/* Overlay Background */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onBack} />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <h1 className="text-lg font-bold text-slate-800">
              {isEditMode ? "Edit Modul Edukasi" : "Tambah Materi Edukasi Baru"}
            </h1>
            <button
              onClick={onBack}
              className="rounded-lg p-1 hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>

          {/* Form Content */}
          <div className="px-6 py-5">
            {formError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            )}
            <form className="space-y-5">
              {/* Judul Modul */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Judul Materi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="judul"
                  value={formData.judul}
                  onChange={handleInputChange}
                  placeholder="Masukkan judul materi edukasi..."
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                />
              </div>

              {/* Kategori & Jenis Konten */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="kategori"
                    value={formData.kategori}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                  >
                    <option value="">Pilih Kategori</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Jenis Konten <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="tipe"
                    value={formData.tipe}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                  >
                    {types.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Durasi */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Durasi Pembelajaran
                </label>
                <input
                  type="text"
                  name="durasi"
                  value={formData.durasi}
                  onChange={handleInputChange}
                  placeholder="Contoh: 15 Menit"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Deskripsi Singkat
                </label>
                <textarea
                  name="deskripsi"
                  value={formData.deskripsi}
                  onChange={handleInputChange}
                  placeholder="Jelaskan secara singkat apa isi dari modul ini..."
                  rows="2"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                />
              </div>

              {/* Upload Media */}
              <div>
                <label className="mb-3 block text-sm font-semibold text-slate-700">
                  Upload Media (Dokumen/Video/Gambar)
                </label>
                {isEditMode && modul?.mediaName && !formData.media && (
                  <p className="mb-2 text-xs text-slate-500">
                    File saat ini:{" "}
                    <span className="font-semibold text-slate-700">
                      {modul.mediaName}
                    </span>{" "}
                    — pilih file baru di bawah untuk menggantinya.
                  </p>
                )}
                <div
                  className={`relative rounded-xl border-2 border-dashed transition ${
                    dragActive
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-300 bg-slate-50"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    id="fileInput"
                    onChange={handleFileInputChange}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.mp4,.avi,.mov,.jpg,.jpeg,.png,.gif"
                  />

                  {!formData.media ? (
                    <label
                      htmlFor="fileInput"
                      className="flex cursor-pointer flex-col items-center justify-center gap-3 px-6 py-8"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                        <Upload className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-slate-700">
                          Tarik dan lepas file di sini
                        </p>
                        <p className="text-xs text-slate-500">
                          atau klik untuk memilih file
                        </p>
                      </div>
                      <p className="text-xs text-slate-400">
                        Format: PDF, DOC, MP4, JPG, PNG (Max 100MB)
                      </p>
                    </label>
                  ) : (
                    <div className="flex items-center justify-between px-6 py-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                          {getFileIcon(formData.media.type) === Image ? (
                            <Image className="h-5 w-5 text-blue-600" />
                          ) : (
                            <FileText className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            {formData.media.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatFileSize(formData.media.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, media: null });
                          document.getElementById("fileInput").value = "";
                        }}
                        className="rounded-lg p-2 hover:bg-slate-200 transition"
                      >
                        <X className="h-4 w-4 text-slate-600" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Konten Utama */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Isi/Deskripsi Materi <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="konten"
                  value={formData.konten}
                  onChange={handleInputChange}
                  placeholder="Tuliskan konten utama dari modul ini..."
                  rows="4"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                />
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <button
              onClick={onBack}
              disabled={isSaving}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition active:scale-95 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving
                ? "Menyimpan..."
                : isEditMode
                  ? "Update Modul"
                  : "Simpan Materi"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
