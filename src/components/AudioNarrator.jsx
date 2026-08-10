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
  UserCheck
} from 'lucide-react';
import { 
  extractSpeechSections, 
  chunkTextIntoSentences, 
  getAvailableVoices 
} from '../utils/speechNarrator';

export default function AudioNarrator({ markdownText, renderedHtml, documentTitle = 'Ders Planı' }) {
  // Speech synthesis support check
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

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
  const [gender, setGender] = useState('female'); // 'female' (Kadın) or 'male' (Erkek)
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

  // Helper to find female / male voice from list
  const findVoiceByGender = (voices, targetGender) => {
    if (!voices.length) return null;
    const femaleKeywords = ['emel', 'filiz', 'dilara', 'gul', 'gül', 'yelda', 'female', 'seda', 'zeynep', 'ayse', 'woman', 'google'];
    const maleKeywords = ['tolga', 'ahmet', 'cem', 'male', 'man', 'mustafa'];
    
    const targetKeywords = targetGender === 'female' ? femaleKeywords : maleKeywords;
    
    // First search in Turkish voices
    const trVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('tr'));
    const searchPool = trVoices.length > 0 ? trVoices : voices;

    const matched = searchPool.find(v => {
      const name = v.name.toLowerCase();
      return targetKeywords.some(k => name.includes(k));
    });

    if (matched) return matched;

    // If looking for male and none matched, return first Turkish voice
    if (targetGender === 'male') {
      return searchPool[0];
    }

    // If looking for female and no female voice found, return null so pitch manipulation applies cleanly
    return null;
  };

  // Load voices when available
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const trVoices = allVoices.filter(v => v.lang && v.lang.toLowerCase().startsWith('tr'));
      const list = trVoices.length > 0 ? trVoices : allVoices;
      setAvailableVoices(list);

      // Default to female voice on initial load
      const preferred = findVoiceByGender(list, genderRef.current);
      if (preferred) {
        setSelectedVoiceURI(preferred.voiceURI);
        voiceRef.current = preferred;
      } else if (list.length > 0) {
        setSelectedVoiceURI(list[0].voiceURI);
        voiceRef.current = null; // Use browser pitch engine
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [isSupported]);

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
      if (isSupported && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported, markdownText]);

  // Reset when document content changes
  useEffect(() => {
    stopPlayback();
    setCurrentSectionIndex(0);
    setCurrentChunkIndex(0);
  }, [markdownText]);

  // Core speech execution function
  const playCurrentChunk = (secIdx, chkIdx) => {
    if (!isSupported || !sections.length) return;

    window.speechSynthesis.cancel();

    if (secIdx >= sections.length) {
      // Completed all sections
      stopPlayback();
      return;
    }

    const currentSection = sections[secIdx];
    const chunks = chunkTextIntoSentences(currentSection.text);

    if (chkIdx >= chunks.length) {
      // Move to next section
      const nextSec = secIdx + 1;
      setCurrentSectionIndex(nextSec);
      setCurrentChunkIndex(0);
      playCurrentChunk(nextSec, 0);
      return;
    }

    const textToSpeak = chunks[chkIdx];
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'tr-TR';
    
    // Distinct pitch and speed modulation for clear gender distinction
    if (genderRef.current === 'female') {
      utterance.pitch = 1.38; // Tiz, akıcı kadın tonu
      utterance.rate = rateRef.current * 1.05;
    } else {
      utterance.pitch = 0.80; // Tok, bas erkek tonu
      utterance.rate = rateRef.current * 0.95;
    }
    
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
      console.warn("Speech synthesis error:", e);
      setSpeechActive(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Switch Voice Gender (Kadın / Erkek)
  const handleGenderChange = (targetGender) => {
    setGender(targetGender);
    genderRef.current = targetGender;
    
    const matchedVoice = findVoiceByGender(availableVoices, targetGender);
    if (matchedVoice) {
      setSelectedVoiceURI(matchedVoice.voiceURI);
      voiceRef.current = matchedVoice;
    } else {
      // If no explicit female voice is installed in OS, fallback to browser pitch engine
      if (targetGender === 'female') {
        voiceRef.current = null;
      } else if (availableVoices.length > 0) {
        voiceRef.current = availableVoices[0];
      }
    }

    if (isPlaying && !isPaused) {
      playCurrentChunk(sectionIdxRef.current, chunkIdxRef.current);
    }
  };

  // Play / Resume
  const handlePlayPause = () => {
    if (!isSupported || !sections.length) return;

    if (isPlaying && !isPaused) {
      // Pause
      window.speechSynthesis.pause();
      setIsPaused(true);
      setSpeechActive(false);
    } else if (isPlaying && isPaused) {
      // Resume
      window.speechSynthesis.resume();
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
    if (isSupported && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
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
      // Restart current chunk with new rate
      playCurrentChunk(sectionIdxRef.current, chunkIdxRef.current);
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

  // Select section directly
  const handleSelectSection = (index) => {
    setCurrentSectionIndex(index);
    setCurrentChunkIndex(0);
    if (isPlaying) {
      playCurrentChunk(index, 0);
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-2xl text-xs flex items-center gap-2 mb-4">
        <VolumeX className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span>Tarayıcınız yerel sesli okuma özelliğini desteklemiyor. Güncel Chrome veya Edge tarayıcı kullanabilirsiniz.</span>
      </div>
    );
  }

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
                Erişilebilirlik Modu
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate max-w-md">
              {isPlaying ? (
                <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Bölüm {currentSectionIndex + 1}/{sections.length}: <strong>{activeSection?.title}</strong>
                </span>
              ) : (
                <span>Tüm planı veya istediğiniz bölümü akıcı Türkçe sesle dinleyin.</span>
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
            className="bg-slate-800/90 text-xs text-indigo-100 border border-indigo-500/40 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all max-w-[220px] truncate"
          >
            {sections.map((sec, idx) => (
              <option key={sec.id} value={idx}>
                {idx + 1}. {sec.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
        {/* Playback Buttons */}
        <div className="flex items-center gap-2">
          {/* Previous Section */}
          <button
            onClick={handlePreviousSection}
            disabled={currentSectionIndex === 0}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 border border-slate-700"
            title="Önceki Bölüme Geç"
            aria-label="Önceki Bölüm"
          >
            <SkipBack className="w-4 h-4" />
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
            title="Sonraki Bölüme Geç"
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
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                gender === 'female'
                  ? 'bg-pink-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              title="Kadın Sesi Tonu"
              aria-label="Kadın Sesi ile Dinle"
            >
              <span>👩 Kadın</span>
            </button>
            <button
              onClick={() => handleGenderChange('male')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                gender === 'male'
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              title="Erkek Sesi Tonu"
              aria-label="Erkek Sesi ile Dinle"
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
                aria-label={`Okuma hızı ${s} katı`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Voice selector */}
          {availableVoices.length > 0 && (
            <div className="flex items-center">
              <label htmlFor="voice-select" className="sr-only">Ses Motoru</label>
              <select
                id="voice-select"
                value={selectedVoiceURI}
                onChange={(e) => {
                  const uri = e.target.value;
                  setSelectedVoiceURI(uri);
                  const v = availableVoices.find(item => item.voiceURI === uri);
                  if (v) voiceRef.current = v;
                  if (isPlaying && !isPaused) {
                    playCurrentChunk(sectionIdxRef.current, chunkIdxRef.current);
                  }
                }}
                className="bg-slate-800/90 text-xs text-indigo-200 border border-indigo-500/40 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all max-w-[170px] truncate"
                title="Sisteminizdeki Ses Motorunu Seçin"
              >
                {availableVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name.replace(/(Desktop|Natural)/gi, '').trim()}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
