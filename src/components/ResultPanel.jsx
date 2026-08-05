// src/components/ResultPanel.jsx
import React, { useRef, useEffect } from 'react';
import { Save, Copy, Download, Share2, Trash2, HelpCircle } from 'lucide-react';

export default function ResultPanel({
  renderedHtml,
  onSaveToBrowser,
  onCopyOnlyText,
  onDownloadWord,
  onCopyForWord,
  onSaveToDrive,
  onDeleteFromDrive,
  driveStatus, // 'idle', 'uploading', 'uploaded', 'deleting'
  onDrawLayout
}) {
  const contentRef = useRef(null);

  useEffect(() => {
    const contentDiv = contentRef.current;
    if (!contentDiv || !renderedHtml) return;

    // Add inline copy buttons to cells, same as the original
    const tds = contentDiv.querySelectorAll('td');
    tds.forEach(td => {
      // Check if button already exists to prevent duplicate additions
      if (td.querySelector('.cell-copy-btn')) return;

      const btn = document.createElement('button');
      btn.className = "cell-copy-btn absolute right-1 bottom-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1 shadow-sm";
      btn.innerHTML = `📋 Kopyala`;
      btn.title = "Sadece bu hücrenin metnini kopyala (Başlıksız)";
      
      // Make cell relative to position button correctly
      td.classList.add('relative', 'group', 'pr-8');

      btn.onclick = function(e) {
        e.stopPropagation();
        const clone = td.cloneNode(true);
        const copyBtn = clone.querySelector('.cell-copy-btn');
        if (copyBtn) copyBtn.remove();
        
        const textToCopy = clone.innerText.trim();
        
        navigator.clipboard.writeText(textToCopy).then(() => {
          btn.innerHTML = "✅";
          btn.style.color = "#16a34a";
          setTimeout(() => {
            btn.innerHTML = "📋 Kopyala";
            btn.style.color = "";
          }, 2000);
        });
      };
      
      td.appendChild(btn);
    });
  }, [renderedHtml]);

  if (!renderedHtml) return null;

  return (
    <div id="output" className="space-y-6 mb-16">
      <div className="glass-panel rounded-3xl p-6 md:p-10 border-t-8 border-indigo-500 bg-white shadow-lg">
        <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4 flex-wrap gap-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            📄 Üretilen Doküman
          </h3>
          <div className="flex flex-wrap gap-3">
            {/* Tarayıcıya Kaydet Butonu */}
            <button
              onClick={onSaveToBrowser}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-600 transition-all shadow-md active:scale-95"
              title="Senaryoyu tarayıcınıza kaydeder. Yukarıdaki menüden dilediğiniz zaman ulaşabilirsiniz."
            >
              <Save className="w-4 h-4" />
              Senaryoyu Kaydet
            </button>

            {/* Google Drive İşlemleri */}
            {driveStatus === 'uploaded' ? (
              <button
                onClick={onDeleteFromDrive}
                disabled={driveStatus === 'deleting'}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                title="Bu dosyayı Google Drive klasöründen siler."
              >
                <Trash2 className="w-4 h-4" />
                {driveStatus === 'deleting' ? "⌛ Siliniyor..." : "🗑 Drive'dan Sil"}
              </button>
            ) : (
              <button
                onClick={onSaveToDrive}
                disabled={driveStatus === 'uploading'}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                title="Senaryoyu Google Drive klasörüne yükler."
              >
                <Share2 className="w-4 h-4" />
                {driveStatus === 'uploading' ? "⌛ Yükleniyor..." : "▲ Drive'a Kaydet"}
              </button>
            )}

            {/* Drive Klasörü Görüntüleme */}
            <button
              onClick={() => window.open("https://drive.google.com/drive/folders/1O3TVQP_i8sZfpBStbSlgwZk3U7kL0du3?usp=drive_link", '_blank')}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95"
              title="Google Drive klasörünü görüntüler."
            >
              👁 Drive Klasörü
            </button>

            {/* 2D Çizim Butonu */}
            <button
              onClick={onDrawLayout}
              className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-200 transition-all active:scale-95"
            >
              📐 2D Yerleşim Çiz
            </button>

            {/* Word Olarak İndir Butonu */}
            <button
              onClick={onDownloadWord}
              className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-200 transition-all active:scale-95"
              title="Şablonu tabloları ve renkleriyle beraber tam bir Word belgesi olarak indirir."
            >
              <Download className="w-4 h-4" />
              Word Olarak İndir
            </button>
          </div>
        </div>

        <p className="text-sm text-amber-600 font-medium mb-4 bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-start gap-2">
          <HelpCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>İpucu:</strong> Kendi Word şablonunuzu dolduruyorsanız, tabloların içindeki hücrelerin üzerine farenizi getirdiğinizde beliren <strong>"Kopyala"</strong> butonunu kullanarak sadece o hücrenin içeriğini kopyalayabilirsiniz.
          </span>
        </p>

        <div
          ref={contentRef}
          id="resultContent"
          className="markdown-content text-slate-700 space-y-4"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    </div>
  );
}
