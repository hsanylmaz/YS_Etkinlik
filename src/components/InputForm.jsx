// src/components/InputForm.jsx
import React, { useEffect } from 'react';

const FCL_ZONES = [
  { name: 'Araştırma', color: '#EF4444', emoji: '🔍' },
  { name: 'İş Birliği', color: '#F97316', emoji: '🤝' },
  { name: 'Geliştirme', color: '#EAB308', emoji: '💡' },
  { name: 'Üretim', color: '#22C55E', emoji: '🛠️' },
  { name: 'Etkileşim', color: '#3B82F6', emoji: '💬' },
  { name: 'Sunum', color: '#A855F7', emoji: '📢' }
];

const SKILLS_4C = [
  { name: 'İletişim', color: 'bg-indigo-500', emoji: '🗣️' },
  { name: 'İş Birliği', color: 'bg-teal-500', emoji: '🤝' },
  { name: 'Eleştirel Düşünme', color: 'bg-rose-500', emoji: '🤔' },
  { name: 'Yaratıcılık', color: 'bg-amber-500', emoji: '✨' }
];

export default function InputForm({
  belgeTuru, setBelgeTuru,
  ders, setDers,
  sinif, setSinif,
  teknik, setTeknik,
  sure, setSure,
  yapayZekaAraclari, setYapayZekaAraclari,
  belgeDili, setBelgeDili,
  kazanim, setKazanim,
  selectedZones, setSelectedZones,
  selectedSkills, setSelectedSkills,
  useMebKit, setUseMebKit,
  use3DPrinter, setUse3DPrinter,
  onSubmit, isLoading,
  kazanimlarDb,
  selectedSurec, setSelectedSurec
}) {

  // Parse current kazanım code from state (e.g., MAT.5.1.1)
  const currentCodeMatch = kazanim ? kazanim.match(/^([A-ZÇĞİÖŞÜ]{2,5})\.(\d{1,2})\.(\d{1,2})\.([LRSW]?\d{1,2})/) : null;
  const currentCode = currentCodeMatch ? `${currentCodeMatch[1]}.${currentCodeMatch[2]}.${currentCodeMatch[3]}.${currentCodeMatch[4]}` : '';
  
  // Find the outcome item in database
  const currentOutcomeItem = (ders && sinif && kazanimlarDb && kazanimlarDb[ders] && kazanimlarDb[ders][sinif]) 
    ? kazanimlarDb[ders][sinif].find(k => k.code === currentCode)
    : null;
     
  const surecBilesenleriList = currentOutcomeItem ? (currentOutcomeItem.surecBilesenleri || []) : [];

  // Resolve dynamic grades based on selected course, restricted to grades 5-12
  const availableGrades = (ders && kazanimlarDb && kazanimlarDb[ders])
    ? Object.keys(kazanimlarDb[ders])
        .map(Number)
        .filter(n => n >= 5 && n <= 12)
        .sort((a, b) => a - b)
    : [5, 6, 7, 8, 9, 10, 11, 12];

  // Automatically adjust selected grade if the current grade is not available for the newly selected course
  useEffect(() => {
    if (ders && kazanimlarDb && kazanimlarDb[ders]) {
      const grades = Object.keys(kazanimlarDb[ders])
        .map(Number)
        .filter(n => n >= 5 && n <= 12)
        .sort((a, b) => a - b);
      if (grades.length > 0 && !grades.includes(Number(sinif))) {
        setSinif(grades[0].toString());
      }
    }
  }, [ders, kazanimlarDb, sinif, setSinif]);

  const toggleZone = (zoneName) => {
    if (selectedZones.includes(zoneName)) {
      setSelectedZones(selectedZones.filter(z => z !== zoneName));
    } else {
      setSelectedZones([...selectedZones, zoneName]);
    }
  };

  const toggleSkill = (skillName) => {
    if (selectedSkills.includes(skillName)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skillName));
    } else {
      setSelectedSkills([...selectedSkills, skillName]);
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6 md:p-8 mb-8 bg-white shadow-xl border border-slate-100">
      {/* 1. Bölüm: Format Seçimi */}
      <div className="mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-4">1. Belge Türünü Seçin</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            onClick={() => setBelgeTuru("etkinlikPlani")}
            className={`cursor-pointer rounded-xl border-2 transition-all ${belgeTuru === "etkinlikPlani" ? "border-blue-500 bg-blue-50/30" : "border-slate-200 bg-white hover:border-slate-300"}`}
          >
            <div className="p-4 relative h-full">
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-slate-800 text-sm md:text-base">Teknoloji Destekli Aktif Öğrenme Etkinlik Planı</span>
                {belgeTuru === "etkinlikPlani" && <span className="text-blue-500">✅</span>}
              </div>
              <p className="text-xs text-slate-500 leading-snug">Özel 'Etkinlik Planı Şablonuna' göre birebir doldurulmuş plan.</p>
            </div>
          </div>

          <div 
            onClick={() => setBelgeTuru("ogrenmeSenaryosu")}
            className={`cursor-pointer rounded-xl border-2 transition-all ${belgeTuru === "ogrenmeSenaryosu" ? "border-blue-500 bg-blue-50/30" : "border-slate-200 bg-white hover:border-slate-300"}`}
          >
            <div className="p-4 relative h-full">
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-slate-800 text-sm md:text-base">Teknoloji Odaklı Öğrenme Senaryosu (TOÖS)</span>
                {belgeTuru === "ogrenmeSenaryosu" && <span className="text-blue-500">✅</span>}
              </div>
              <p className="text-xs text-slate-500 leading-snug">MEB 'TOÖS Şablonuna' göre 4C becerilerini merkeze alan senaryo.</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bölüm: Genel Bilgiler */}
      <div className="mb-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <h2 className="text-lg font-bold text-slate-800">2. Ders ve Pedagojik Çerçeve</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Ders Adı</label>
            <select 
              value={ders && kazanimlarDb && Object.keys(kazanimlarDb).includes(ders) ? ders : (ders ? "other" : "")}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "other") {
                  setDers("");
                } else {
                  setDers(val);
                }
                setKazanim('');
              }}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50 text-sm font-semibold text-slate-700"
            >
              <option value="">Ders Seçiniz...</option>
              {kazanimlarDb && Object.keys(kazanimlarDb).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
              <option value="other">✍️ Diğer (Serbest Yazım)...</option>
            </select>

            {/* Diğer seçildiğinde veya elle yazıldığında serbest metin girişi kutusu belirir */}
            {(ders === "" || (kazanimlarDb && !Object.keys(kazanimlarDb).includes(ders) && ders !== "")) && (
              <input 
                type="text" 
                value={ders}
                onChange={(e) => setDers(e.target.value)}
                placeholder="Ders adını yazınız (Örn: Mantık)" 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50 text-sm font-medium"
              />
            )}
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Sınıf Seviyesi</label>
            <select 
              value={sinif}
              onChange={(e) => setSinif(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50 text-sm font-semibold text-slate-700"
            >
              {availableGrades.map(n => (
                <option key={n} value={n.toString()}>{n}. Sınıf</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Aktif Öğrenme Tekniği (MEB Kılavuzu)</label>
            <select 
              value={teknik}
              onChange={(e) => setTeknik(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50 text-sm"
            >
              <option value="auto" className="font-bold text-blue-600">✨ Yapay Zeka Önersin (Kılavuza Uygun)</option>
              <option value="İş Birlikli Öğrenme">İş Birlikli Öğrenme</option>
              <option value="Probleme Dayalı Öğrenme">Probleme Dayalı Öğrenme</option>
              <option value="Sorgulamaya Dayalı Öğrenme">Sorgulamaya Dayalı Öğrenme</option>
              <option value="Yapılandırmacı Öğrenme">Yapılandırmacı Öğrenme</option>
              <option value="Tasarıma Dayalı Öğrenme">Tasarıma Dayalı Öğrenme</option>
              <option value="Oyun Temelli Öğrenme">Oyun Temelli Öğrenme</option>
              <option value="Proje Tabanlı Öğrenme">Proje Tabanlı Öğrenme</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Etkinlik Süresi (En fazla 80 Dk)</label>
            <input 
              type="number" 
              value={sure}
              onChange={(e) => setSure(e.target.value)}
              placeholder="Örn: 40" 
              min="1" 
              max="80" 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50 font-bold text-indigo-700 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Belge Dili (Document Language)</label>
            <select 
              value={belgeDili}
              onChange={(e) => setBelgeDili(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50 text-sm font-semibold"
            >
              <option value="tr">Türkçe</option>
              <option value="en">English (İngilizce)</option>
              <option value="de">Deutsch (Almanca)</option>
              <option value="fr">Français (Fransızca)</option>
              <option value="ar">العربية (Arapça)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">YZ / Web 2.0 Araçları (İsteğe Bağlı)</label>
            <input 
              type="text" 
              value={yapayZekaAraclari}
              onChange={(e) => setYapayZekaAraclari(e.target.value)}
              placeholder="Örn: ChatGPT, Canva (Boşsa YZ önerir)" 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-slate-50 text-sm"
            />
          </div>
        </div>

        {/* Dynamic Tool Exclusions Checkboxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MEB-KİT Option Checkbox */}
          <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-100/50 transition-all">
            <input
              id="useMebKit"
              type="checkbox"
              checked={useMebKit}
              onChange={(e) => setUseMebKit(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer mt-0.5"
            />
            <label htmlFor="useMebKit" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
              🎒 Plana MEB-KİT Kullanım Önerisini Dahil Et
              <span className="block text-xs font-normal text-slate-500 mt-0.5 leading-relaxed">
                İşaretlenirse, kodlama ve içerik geliştirme adımlarında MEB-KİT setlerinin kullanılması önerilir. İşaretlenmezse, Scratch, Tinkercad gibi standart ve basit araçlar tavsiye edilir.
              </span>
            </label>
          </div>

          {/* 3D Printer Option Checkbox */}
          <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-100/50 transition-all">
            <input
              id="use3DPrinter"
              type="checkbox"
              checked={use3DPrinter}
              onChange={(e) => setUse3DPrinter(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer mt-0.5"
            />
            <label htmlFor="use3DPrinter" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
              🖨️ Plana 3B Yazıcı Kullanım Önerisini Dahil Et
              <span className="block text-xs font-normal text-slate-500 mt-0.5 leading-relaxed">
                İşaretlenirse, etkinlik üretim süreçlerinde 3D modellerin fiziksel baskısının alınması önerilir. İşaretlenmezse, sadece dijital/ekran tasarımı önerilir, fiziksel yazıcı gerekmez.
              </span>
            </label>
          </div>
        </div>

        {/* Kazanım Seçim Alanı (Yalnızca Ders ve Sınıf Seçildiğinde ve veri mevcut olduğunda görünür) */}
        {ders && sinif && kazanimlarDb && kazanimlarDb[ders] && kazanimlarDb[ders][sinif] && (
          <div className="mb-6 bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-2">
            <label className="text-xs font-extrabold text-indigo-950 ml-1 flex items-center gap-1.5">
              <span>📖 Resmî Kazanım Seçin (Türkiye Yüzyılı Maarif Modeli)</span>
              <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                {kazanimlarDb[ders][sinif].length} Kazanım Mevcut
              </span>
            </label>
            <select 
              onChange={(e) => {
                setSelectedSurec([]); // Clear processes when outcome changes
                if (e.target.value) {
                  const selected = kazanimlarDb[ders][sinif].find(k => k.code === e.target.value);
                  if (selected) {
                    setKazanim(`${selected.code}. ${selected.description}`);
                  }
                } else {
                  setKazanim('');
                }
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white text-xs font-semibold text-slate-800"
            >
              <option value="">-- Kazanım Seçiniz (Aşağıdaki metin kutusu otomatik dolacaktır) --</option>
              {kazanimlarDb[ders][sinif].map(k => (
                <option key={k.code} value={k.code}>
                  {k.code} - {k.description.substring(0, 110)}...
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Süreç Bileşenleri Seçim Alanı */}
        {surecBilesenleriList && surecBilesenleriList.length > 0 && (
          <div className="mb-6 bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-800 ml-1 flex items-center gap-1.5">
                <span>⚡ Süreç Bileşenlerini Seçin (İstediğiniz kadar)</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                  {selectedSurec.length} / {surecBilesenleriList.length} Seçildi
                </span>
              </label>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allSurec = [...surecBilesenleriList];
                    setSelectedSurec(allSurec);
                    const mainDesc = currentOutcomeItem ? `${currentOutcomeItem.code}. ${currentOutcomeItem.description}` : '';
                    setKazanim(mainDesc + "\n\nSüreç Bileşenleri:\n- " + allSurec.join("\n- "));
                  }}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-bold transition-all"
                >
                  Tümünü Seç
                </button>
                <span className="text-slate-300 text-xs">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSurec([]);
                    const mainDesc = currentOutcomeItem ? `${currentOutcomeItem.code}. ${currentOutcomeItem.description}` : '';
                    setKazanim(mainDesc);
                  }}
                  className="text-[10px] text-rose-600 hover:text-rose-800 font-bold transition-all"
                >
                  Temizle
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
              {surecBilesenleriList.map((item, idx) => {
                const isChecked = selectedSurec.includes(item);
                return (
                  <div 
                    key={idx}
                    onClick={() => {
                      let nextSurec = [];
                      if (isChecked) {
                        nextSurec = selectedSurec.filter(s => s !== item);
                      } else {
                        nextSurec = [...selectedSurec, item];
                      }
                      setSelectedSurec(nextSurec);
                      
                      const mainDesc = currentOutcomeItem ? `${currentOutcomeItem.code}. ${currentOutcomeItem.description}` : '';
                      const newText = mainDesc + (nextSurec.length > 0 
                        ? "\n\nSüreç Bileşenleri:\n- " + nextSurec.join("\n- ") 
                        : "");
                      setKazanim(newText);
                    }}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none text-xs ${
                      isChecked 
                        ? "border-blue-500 bg-blue-50/20 text-slate-800 font-medium shadow-sm" 
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Controlled by parent click
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5 cursor-pointer"
                    />
                    <span className="leading-relaxed">{item}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Öğrenme Kazanımı / Konu</label>
          <textarea 
            value={kazanim}
            onChange={(e) => setKazanim(e.target.value)}
            rows={2} 
            placeholder="Örn: MAT.5.2.1. Eşitliğin korunumuna ve işlem özelliklerine yönelik çıkarım yapabilme..." 
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none bg-slate-50 text-sm"
          />
        </div>
      </div>

      {/* 3. Bölüm: Öğrenme Alanları ve Beceriler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Öğrenme Alanları */}
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
            📍 Esnek Öğrenme Alanları 
          </h2>
          <p class="text-xs text-slate-500 mb-4">Planınızda kullanmak istediğiniz öğrenme alanlarını seçin.</p>
          
          <div className="grid grid-cols-3 gap-3">
            {FCL_ZONES.map((zone) => {
              const isActive = selectedZones.includes(zone.name);
              return (
                <button
                  key={zone.name}
                  type="button"
                  onClick={() => toggleZone(zone.name)}
                  style={{ backgroundColor: zone.color }}
                  className={`p-2 rounded-2xl text-white font-bold text-[11px] md:text-xs flex flex-col items-center justify-center gap-1 h-20 transition-all ${
                    isActive ? 'opacity-100 scale-[1.03] ring-4 ring-white ring-inset shadow-lg' : 'opacity-40 hover:opacity-60'
                  }`}
                >
                  <span className="text-lg">{zone.emoji}</span>
                  <span>{zone.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4C Becerileri */}
        <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
          <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
            🎯 4C Becerileri 
          </h2>
          <p className="text-xs text-slate-500 mb-4">Senaryoya/Plana entegre edilecek temel becerileri seçin.</p>
          
          <div className="grid grid-cols-2 gap-3">
            {SKILLS_4C.map((skill) => {
              const isActive = selectedSkills.includes(skill.name);
              return (
                <button
                  key={skill.name}
                  type="button"
                  onClick={() => toggleSkill(skill.name)}
                  className={`p-2 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 h-16 transition-all ${
                    isActive 
                      ? `${skill.color} text-white opacity-100 scale-[1.03] shadow-md` 
                      : 'bg-slate-200 text-slate-500 opacity-60 hover:opacity-75'
                  }`}
                >
                  <span className="text-lg">{skill.emoji}</span>
                  <span className="text-xs md:text-sm leading-tight text-center">
                    {skill.name.includes(' ') ? <>{skill.name.split(' ')[0]}<br/>{skill.name.split(' ')[1]}</> : skill.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button 
        onClick={onSubmit} 
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/30 transform active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-80 disabled:cursor-not-allowed"
      >
        <span>{isLoading ? "Senaryo Planı Üretiliyor..." : "Senaryo / Plan Metnini Oluştur"}</span>
        {isLoading && (
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
      </button>
    </div>
  );
}
