// src/components/SavedScenariosModal.jsx
import React from 'react';
import { X, Clock, Trash2 } from 'lucide-react';

export default function SavedScenariosModal({ isOpen, onClose, scenarios, onLoad, onDelete }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            📂 Tarayıcınızda Kayıtlı Senaryolar
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-4 bg-slate-50 flex-1">
          {scenarios.length === 0 ? (
            <p className="text-center text-slate-500 py-12">
              Henüz tarayıcınıza kayıtlı bir senaryo bulunmuyor.
            </p>
          ) : (
            scenarios.map((scenario) => {
              const dateStr = new Date(scenario.timestamp).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={scenario.id}
                  className="border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-indigo-300 transition-colors bg-white shadow-sm"
                >
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-base">{scenario.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {dateStr}
                    </p>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button
                      onClick={() => {
                        onLoad(scenario);
                        onClose();
                      }}
                      className="flex-1 md:flex-none px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-bold transition-colors"
                    >
                      Görüntüle
                    </button>
                    <button
                      onClick={() => onDelete(scenario.id)}
                      className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
