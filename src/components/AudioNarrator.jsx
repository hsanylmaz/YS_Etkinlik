// src/components/AudioNarrator.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Square, 
  SkipForward, 
  SkipBack, 
  Gauge, 
  Sparkles, 
  AudioLines,
  ListOrdered,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { 
  extractSpeechSections, 
  chunkTextIntoSentences, 
  getAvailableVoices 
} from '../utils/speechNarrator';

// Icons mapped to section titles
const SECTION_ICONS = {
  'Başlık ve Genel Bilgiler': '📋',
  'Ders ve Kazanım Bilgileri': '🎯',
  'Donanım ve Materyaller': '🛠️',
  'Hazırlık Süreci': '⏳',
  'Uygulama Aşamaları': '🚀',
  'Etkinlik Sonu': '🏁',
  'Ölçme ve Değerlendirme': '📊',
  'Kaynakça': '📚',
  'Ekler ve Yönergeler': '📎'
};

export default function AudioNarrator({ markdownText, renderedHtml, documentTitle = 'Ders Planı' }) {
  // Extract structured chapters from content
  const sections = useMemo(() => {
    return extractSpeechSections(markdownText, renderedHtml);
  }, [markdownText, renderedHtml]);

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [rate, setRate] = useState(1.0); // 0.75, 1.0, 1.25, 1.5, 2.0
  const [gender, setGender] = useState('female'); // 'female' (Doğal Kadın Sesi) or 'male' (Erkek Sesi)
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [speechActive, setSpeechActive] = useState(false);

  // Refs for tracking execution state across callbacks
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const sectionIdxRef = useRef(0);
  const chunkIdxRef = useRef(0);
  const rateRef = useRef(1.0);
  const genderRef = useRef('female');
  const voiceRef = useRef(null);

  // Keep refs synchronized
  isPlayingRef.current = isPlaying;
  isPausedRef.current = isPaused;
  sectionIdxRef.current = currentSectionIndex;
  chunkIdxRef.current = currentChunkIndex;
  rateRef.current = rate;
  genderRef.current = gender;

  // Load native voices when available
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const trVoices = allVoices.filter(v => v.lang && v.lang.toLowerCase().startsWith('tr'));
      const list = trVoices.length > 0 ? trVoices : allVoices;
      setAvailableVoices(list);

      if (list.length > 0 && !selectedVoiceURI) {
        setSelectedVoiceURI(list[0].voiceURI);
        voiceRef.current = list[0];
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Update selected voice object
  useEffect(() => {
    if (!availableVoices.length) return;
    const found = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
    if (found) {
      voiceRef.current = found;
    }
  }, [selectedVoiceURI, availableVoices]);

  // Stop playback when document changes or component unmounts
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [markdownText]);

  // Reset when document content changes
  useEffect(() => {
    stopPlayback();
    setCurrentSectionIndex(0);
    setCurrentChunkIndex(0);
  }, [markdownText]);

  // Core speech execution function
  const playCurrentChunk = (secIdx, chkIdx) => {
    if (!sections.length) return;

    // Stop ongoing speech
    stopAudioEngines();

    if (secIdx >= sections.length) {
      // Completed all sections
      stopPlayback();
      return;
    }

    const currentSection = sections[secIdx];
    const chunks = chunkTextIntoSentences(currentSection.text, 140);

    if (chkIdx >= chunks.length) {
      // Move to next section
      const nextSec = secIdx + 1;
      setCurrentSectionIndex(nextSec);
      setCurrentChunkIndex(0);
      playCurrentChunk(nextSec, 0);
      return;
    }

    const textToSpeak = chunks[chkIdx];

    // Priority 1: ResponsiveVoice (Guarantees authentic Turkish Female voice anywhere)
    if (typeof window !== 'undefined' && window.responsiveVoice) {
      const voiceName = genderRef.current === 'female' ? "Turkish Female" : "Turkish Male";
      
      try {
        setSpeechActive(true);
        window.responsiveVoice.speak(textToSpeak, voiceName, {
          rate: rateRef.current,
          pitch: 1.0,
          volume: 1.0,
          onstart: () => {
            setSpeechActive(true);
          },
          onend: () => {
            if (!isPlayingRef.current || isPausedRef.current) return;
            const nextChunk = chkIdx + 1;
            setCurrentChunkIndex(nextChunk);
            playCurrentChunk(secIdx, nextChunk);
          },
          onerror: () => {
            fallbackSpeechSynthesis(textToSpeak, secIdx, chkIdx);
          }
        });
        return;
      } catch (e) {
        console.warn("ResponsiveVoice error, using fallback:", e);
      }
    }

    // Priority 2: Fallback to Native SpeechSynthesis
    fallbackSpeechSynthesis(textToSpeak, secIdx, chkIdx);
  };

  // Stop all active engines
  const stopAudioEngines = () => {
    if (typeof window !== 'undefined' && window.responsiveVoice) {
      try { window.responsiveVoice.cancel(); } catch(e) {}
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  // SpeechSynthesis fallback runner
  const fallbackSpeechSynthesis = (textToSpeak, secIdx, chkIdx) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'tr-TR';
    utterance.rate = rateRef.current;
    utterance.pitch = genderRef.current === 'female' ? 1.25 : 0.85;
    
    if (voiceRef.current) {
      utterance.voice = voiceRef.current;
    }

    utterance.onstart = () => {
      setSpeechActive(true);
    };

    utterance.onend = () => {
      if (!isPlayingRef.current || isPausedRef.current) return;
      const nextChunk = chkIdx + 1;
      setCurrentChunkIndex(nextChunk);
      playCurrentChunk(secIdx, nextChunk);
    };

    utterance.onerror = (e) => {
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      setSpeechActive(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Switch Voice Gender (Kadın / Erkek)
  const handleGenderChange = (targetGender) => {
    setGender(targetGender);
    genderRef.current = targetGender;

    if (isPlaying && !isPaused) {
      playCurrentChunk(sectionIdxRef.current, chunkIdxRef.current);
    }
  };

  // Play / Resume
  const handlePlayPause = () => {
    if (!sections.length) return;

    if (isPlaying && !isPaused) {
      // Pause
      if (window.responsiveVoice) {
        try { window.responsiveVoice.pause(); } catch(e) {}
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.pause();
      }
      setIsPaused(true);
      setSpeechActive(false);
    } else if (isPlaying && isPaused) {
      // Resume
      if (window.responsiveVoice) {
        try { window.responsiveVoice.resume(); } catch(e) {}
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.resume();
      }
      setIsPaused(false);
      setSpeechActive(true);
    } else {
      // Start fresh
      setIsPlaying(true);
      setIsPaused(false);
      playCurrentChunk(currentSectionIndex, currentChunkIndex);
    }
  };

  // Stop & Reset
  const stopPlayback = () => {
    stopAudioEngines();
    setIsPlaying(false);
    setIsPaused(false);
    setSpeechActive(false);
    setCurrentChunkIndex(0);
  };

  // Change Speed
  const handleRateChange = (newRate) => {
    setRate(newRate);
    rateRef.current = newRate;
    if (isPlaying && !isPaused) {
      playCurrentChunk(sectionIdxRef.current, chunkIdxRef.current);
    }
  };

  // Skip to previous sentence chunk
  const handlePreviousChunk = () => {
    if (currentChunkIndex > 0) {
      const prev = currentChunkIndex - 1;
      setCurrentChunkIndex(prev);
      if (isPlaying) playCurrentChunk(currentSectionIndex, prev);
    } else {
      handlePreviousSection();
    }
  };

  // Skip to next sentence chunk
  const handleNextChunk = () => {
    const currentSection = sections[currentSectionIndex];
    const chunks = chunkTextIntoSentences(currentSection?.text || '', 140);
    if (currentChunkIndex < chunks.length - 1) {
      const next = currentChunkIndex + 1;
      setCurrentChunkIndex(next);
      if (isPlaying) playCurrentChunk(currentSectionIndex, next);
    } else {
      handleNextSection();
    }
  };

  // Skip to previous section
  const handlePreviousSection = () => {
    const prevIdx = Math.max(0, currentSectionIndex - 1);
    setCurrentSectionIndex(prevIdx);
    setCurrentChunkIndex(0);
    if (isPlaying) {
      playCurrentChunk(prevIdx, 0);
    }
  };

  // Skip to next section
  const handleNextSection = () => {
    const nextIdx = Math.min(sections.length - 1, currentSectionIndex + 1);
    setCurrentSectionIndex(nextIdx);
    setCurrentChunkIndex(0);
    if (isPlaying) {
      playCurrentChunk(nextIdx, 0);
    }
  };

  // Select and immediately play section directly
  const handleSelectSection = (index) => {
    setCurrentSectionIndex(index);
    setCurrentChunkIndex(0);
    setIsPlaying(true);
    setIsPaused(false);
    playCurrentChunk(index, 0);
  };

  if (!sections.length) return null;

  const activeSection = sections[currentSectionIndex] || sections[0];

  return (
    <div 
      className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-indigo-500/30 mb-6 transition-all"
      role="region"
      aria-label="Ders Planı Sesli Okuyucu Paneli"
    >
      {/* Header Bar: Status & Section Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-800/40">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${isPlaying && !isPaused ? 'bg-emerald-500 text-white animate-pulse' : 'bg-indigo-600/60 text-indigo-200'}`}>
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-indigo-200">
                🎙️ Planı Sesli Dinle
              </span>
              <span className="bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-indigo-400/30">
                {sections.length} Bölüm
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate max-w-md mt-0.5">
              {isPlaying ? (
                <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Okunan Bölüm ({currentSectionIndex + 1}/{sections.length}): <strong>{activeSection?.title}</strong>
                </span>
              ) : (
                <span>Tüm planı baştan sona dinleyin veya istediğiniz bölüme tıklayarak oradan başlatın.</span>
              )}
            </p>
          </div>
        </div>

        {/* Section Selector Dropdown */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <label htmlFor="section-select" className="sr-only">Bölüm Seç</label>
          <select
            id="section-select"
            value={currentSectionIndex}
            onChange={(e) => handleSelectSection(Number(e.target.value))}
            className="bg-slate-800/90 text-xs text-indigo-100 border border-indigo-500/40 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all max-w-[240px] truncate"
          >
            {sections.map((sec, idx) => (
              <option key={sec.id} value={idx}>
                {idx + 1}. {SECTION_ICONS[sec.title] || '📌'} {sec.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
        {/* Playback & Skipping Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Previous Section */}
          <button
            onClick={handlePreviousSection}
            disabled={currentSectionIndex === 0}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 border border-slate-700"
            title="Önceki Bölüm"
            aria-label="Önceki Bölüm"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Previous Sentence Chunk */}
          <button
            onClick={handlePreviousChunk}
            className="px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold border border-slate-700 active:scale-95"
            title="Önceki Cümle / Parça"
          >
            ⏪ Cümle
          </button>

          {/* Play / Pause / Resume Primary Button */}
          <button
            onClick={handlePlayPause}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 ${
              isPlaying && !isPaused
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20'
            }`}
            aria-label={isPlaying && !isPaused ? "Okumayı Duraklat" : "Sesli Okumayı Başlat"}
          >
            {isPlaying && !isPaused ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Duraklat</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{isPaused ? "Devam Et" : "Sesli Oku"}</span>
              </>
            )}
          </button>

          {/* Next Sentence Chunk */}
          <button
            onClick={handleNextChunk}
            className="px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold border border-slate-700 active:scale-95"
            title="Sonraki Cümle / Parça"
          >
            Cümle ⏩
          </button>

          {/* Stop Button */}
          {isPlaying && (
            <button
              onClick={stopPlayback}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-all active:scale-95"
              title="Okumayı Durdur"
              aria-label="Okumayı Durdur"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          )}

          {/* Next Section */}
          <button
            onClick={handleNextSection}
            disabled={currentSectionIndex >= sections.length - 1}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 border border-slate-700"
            title="Sonraki Bölüm"
            aria-label="Sonraki Bölüm"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Speed & Voice Options */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Gender (Kadın / Erkek) Selector Pills */}
          <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-indigo-500/30 text-xs">
            <button
              onClick={() => handleGenderChange('female')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                gender === 'female'
                  ? 'bg-pink-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              title="Doğal Kadın Sesi (ResponsiveVoice)"
            >
              <span>👩 Kadın</span>
            </button>
            <button
              onClick={() => handleGenderChange('male')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all ${
                gender === 'male'
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              title="Erkek Sesi (Microsoft Tolga / Erkek Spiker)"
            >
              <span>👨 Erkek</span>
            </button>
          </div>

          {/* Speed Selector Pills */}
          <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-indigo-500/30 text-xs">
            <span className="text-[11px] text-slate-400 px-2 flex items-center gap-1 font-semibold">
              <Gauge className="w-3 h-3" /> Hız:
            </span>
            {[0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
              <button
                key={s}
                onClick={() => handleRateChange(s)}
                className={`px-2 py-1 rounded-lg font-medium transition-all ${
                  rate === s
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Quick Chapter Jump Pills (Tıklanabilir Hızlı Bölüm Başlıkları) */}
      <div className="mt-3.5 pt-3 border-t border-indigo-800/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
            <ListOrdered className="w-3.5 h-3.5" /> Hızlı Bölüm Seçimi (İstediğiniz Aşamaya Tıklayın):
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {sections.map((sec, idx) => {
            const isActive = currentSectionIndex === idx;
            const isCurrentlyPlaying = isActive && isPlaying && !isPaused;
            const icon = SECTION_ICONS[sec.title] || '📌';

            return (
              <button
                key={sec.id}
                onClick={() => handleSelectSection(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                  isCurrentlyPlaying
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30 font-bold scale-[1.02]'
                    : isActive
                    ? 'bg-indigo-700 text-white border-indigo-400 font-semibold'
                    : 'bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 hover:text-white border-slate-700/60'
                }`}
                title={`${sec.title} bölümünü dinle`}
              >
                <span>{icon}</span>
                <span>{sec.title}</span>
                {isCurrentlyPlaying && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}