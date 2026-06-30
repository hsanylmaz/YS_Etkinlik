// src/components/SettingsModal.jsx
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, apiKey, onSave }) {
  const [keyValue, setKeyValue] = useState(apiKey);
  const [testResult, setTestResult] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    setKeyValue(apiKey);
    setTestResult('');
  }, [apiKey, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(keyValue.trim());
    onClose();
  };

  const handleTestConnection = async () => {
    if (!keyValue.trim()) {
      setTestResult("Lütfen önce bir API anahtarı girin.");
      return;
    }
    setIsTesting(true);
    setTestResult('');
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyValue.trim()}`);
      if (!res.ok) {
        let errText = `HTTP Hatası: ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson.error && errJson.error.message) errText = errJson.error.message;
        } catch(e) {}
        throw new Error(errText);
      }
      const data = await res.json();
      const models = data.models || [];
      const geminiModels = models
        .filter(m => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
      
      if (geminiModels.length === 0) {
        setTestResult("Bağlantı kuruldu fakat generateContent destekli Gemini modeli bulunamadı.");
      } else {
        setTestResult(`Başarılı! Kullanabileceğiniz modeller:\n• ${geminiModels.join('\n• ')}`);
      }
    } catch(err) {
      setTestResult(`Bağlantı hatası: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            ⚙️ Gemini API Ayarları
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-4 bg-white">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 block">Gemini API Anahtarı (API Key)</label>
            <input
              type="password"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50 font-mono text-sm"
            />
            <p className="text-xs text-slate-500 leading-normal">
              API anahtarınız <strong>sadece tarayıcınızın yerel hafızasında</strong> (localStorage) saklanır. Google AI Studio üzerinden ücretsiz bir API anahtarı alabilirsiniz.
            </p>
          </div>

          {testResult && (
            <div className={`p-3.5 rounded-xl text-xs leading-relaxed border ${
              testResult.startsWith('Başarılı') 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            } whitespace-pre-line font-medium`}>
              {testResult}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 gap-2">
            <div className="flex gap-2">
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-3 py-2 border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 rounded-xl text-xs font-bold transition-all"
              >
                {isTesting ? "Test Ediliyor..." : "Bağlantıyı Test Et"}
              </button>

              <a
                href="https://aistudio.google.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                🔑 Anahtar Al
              </a>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all"
              >
                Vazgeç
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/10"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
