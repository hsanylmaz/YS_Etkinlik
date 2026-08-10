// src/utils/speechNarrator.js

/**
 * Parses raw markdown or text into clean, human-readable sections suitable for speech synthesis.
 * Intelligent breakdown into individual plan components:
 * 1. Başlık ve Genel Bilgiler
 * 2. Ders ve Kazanım Bilgileri
 * 3. Donanım ve Materyaller
 * 4. Hazırlık Süreci
 * 5. Uygulama Aşamaları
 * 6. Etkinlik Sonu
 * 7. Ölçme ve Değerlendirme
 * 8. Kaynakça
 * 9. Ekler ve Yönergeler
 */
export function extractSpeechSections(markdownText, rawHtml = '') {
  if (!markdownText && !rawHtml) return [];

  let text = markdownText || '';

  // If we only have raw HTML, do a basic text conversion
  if (!text && rawHtml) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHtml;
    text = tempDiv.innerText || tempDiv.textContent || '';
  }

  const sections = [];
  const lines = text.split('\n');

  let currentCategory = '';
  let currentTitle = '';
  let currentParagraphs = [];

  const flushSection = () => {
    if (currentParagraphs.length > 0) {
      const combinedText = cleanTextForSpeech(currentParagraphs.join(' '));
      if (combinedText.trim().length > 0) {
        sections.push({
          id: sections.length + 1,
          category: currentCategory || 'Genel',
          title: currentTitle || 'Bölüm',
          text: combinedText
        });
      }
      currentParagraphs = [];
    }
  };

  const startNewSection = (title, category) => {
    flushSection();
    currentTitle = title;
    currentCategory = category || title;
  };

  startNewSection('Başlık ve Genel Bilgiler', 'Genel');

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Ignore markdown code block fences
    if (trimmed.startsWith('```')) continue;

    // Major Markdown headings (##, ###, ####) - usually for Appendices / Ekler
    if (/^#{2,4}\s+/.test(trimmed)) {
      const headerText = cleanTextForSpeech(trimmed.replace(/^#+\s*/, ''));
      if (headerText.toLowerCase() === 'ekler') {
        startNewSection('Ekler ve Yönergeler', 'Ekler');
      } else {
        startNewSection(headerText, 'Ekler');
      }
      continue;
    }

    // Markdown Table Rows (| Col1 | Col2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Ignore separator lines (|---|---|)
      if (/^\|[-:| ]+\|$/.test(trimmed)) continue;

      const cells = trimmed
        .split('|')
        .map(c => c.trim())
        .filter(c => c !== '');

      if (cells.length >= 2) {
        const rawKey = cells[0].replace(/\*\*/g, '').trim().toLowerCase();
        const rawVal = cells.slice(1).join(' - ').trim();

        // 1. Title / General Info
        if (
          rawKey.includes('etkinlik başlığı') || 
          rawKey.includes('senaryo adı') || 
          rawKey.includes('etkinlik id') || 
          rawKey.includes('senaryo id') || 
          rawKey.includes('genel bakış') || 
          rawKey.includes('etkinlik süresi') ||
          rawKey.includes('ders/kademe/süre')
        ) {
          if (currentTitle !== 'Başlık ve Genel Bilgiler') {
            startNewSection('Başlık ve Genel Bilgiler', 'Genel');
          }
          currentParagraphs.push(`${cells[0].replace(/\*\*/g, '')}: ${rawVal}.`);
          continue;
        }

        // 2. Curriculum & Outcomes
        if (
          rawKey.includes('ders adı') || 
          rawKey.includes('ünite') || 
          rawKey.includes('öğrenme alanı') || 
          rawKey.includes('tema') || 
          rawKey.includes('konu') || 
          rawKey.includes('içerik çerçevesi') || 
          rawKey.includes('öğrenme çıktıları') || 
          rawKey.includes('kazanım') || 
          rawKey.includes('sınıf seviyesi') || 
          rawKey.includes('kademe') ||
          rawKey.includes('öğrenme hedefleri') ||
          rawKey.includes('beceriler')
        ) {
          if (currentTitle !== 'Ders ve Kazanım Bilgileri') {
            startNewSection('Ders ve Kazanım Bilgileri', 'Müfredat');
          }
          currentParagraphs.push(`${cells[0].replace(/\*\*/g, '')}: ${rawVal}.`);
          continue;
        }

        // 3. Hardware, Tools & Space
        if (
          rawKey.includes('donanım') || 
          rawKey.includes('çevrim içi araç') || 
          rawKey.includes('öğretim materyalleri') || 
          rawKey.includes('etkinlik alanı') || 
          rawKey.includes('öğrencilerin konumu') || 
          rawKey.includes('öğretmenin rolü') || 
          rawKey.includes('araçlar/teknolojiler') ||
          rawKey.includes('öğrenme yaklaşımı') ||
          rawKey.includes('görevler')
        ) {
          if (currentTitle !== 'Donanım ve Materyaller') {
            startNewSection('Donanım ve Materyaller', 'Ortam');
          }
          currentParagraphs.push(`${cells[0].replace(/\*\*/g, '')}: ${rawVal}.`);
          continue;
        }

        // 4. Preparation (Hazırlık)
        if (rawKey.startsWith('hazırlık')) {
          startNewSection('Hazırlık Süreci', 'Hazırlık');
          currentParagraphs.push(`Hazırlık Süreci: ${rawVal}`);
          continue;
        }

        // 5. Implementation (Uygulama)
        if (rawKey.startsWith('uygulama') || rawKey.includes('öğrenme etkinlikleri')) {
          startNewSection('Uygulama Aşamaları', 'Uygulama');
          currentParagraphs.push(`Uygulama Aşamaları: ${rawVal}`);
          continue;
        }

        // 6. Conclusion (Etkinlik Sonu)
        if (rawKey.includes('etkinlik sonu') || rawKey.includes('kapanış')) {
          startNewSection('Etkinlik Sonu', 'Kapanış');
          currentParagraphs.push(`Etkinlik Sonu: ${rawVal}`);
          continue;
        }

        // 7. Assessment (Ölçme ve Değerlendirme)
        if (rawKey.includes('ölçme') || rawKey.includes('değerlendirme')) {
          startNewSection('Ölçme ve Değerlendirme', 'Değerlendirme');
          currentParagraphs.push(`Ölçme ve Değerlendirme: ${rawVal}`);
          continue;
        }

        // 8. Bibliography (Kaynakça)
        if (rawKey.includes('kaynakça') || rawKey.includes('referans') || rawKey.includes('bağlantılar')) {
          startNewSection('Kaynakça', 'Kaynakça');
          currentParagraphs.push(`Kaynakça: ${rawVal}`);
          continue;
        }

        if (rawKey.includes('ekler')) {
          continue;
        }

        // Fallback for general table row
        currentParagraphs.push(`${cells[0].replace(/\*\*/g, '')}: ${rawVal}.`);
        continue;
      }
    }

    // List items or regular lines
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*]\s+|\d+\.\s+/, '');
      currentParagraphs.push(itemText + '.');
    } else {
      currentParagraphs.push(trimmed);
    }
  }

  // Push final remaining section
  flushSection();

  // If no structured sections were created, fallback to single section
  if (sections.length === 0 && text.trim()) {
    sections.push({
      id: 1,
      category: 'Genel',
      title: 'Ders Planı',
      text: cleanTextForSpeech(text)
    });
  }

  return sections;
}

/**
 * Cleans markdown formatting, links, URLs, emojis, and symbols for natural Turkish pronunciation.
 */
export function cleanTextForSpeech(raw) {
  if (!raw) return '';

  let clean = raw;

  // Remove markdown images ![alt](url)
  clean = clean.replace(/!\[.*?\]\(.*?\)/g, '');

  // Replace markdown links [text](url) with just text
  clean = clean.replace(/\[([^\]]+)\]\(.*?\)/g, '$1');

  // Remove HTML tags
  clean = clean.replace(/<[^>]*>/g, ' ');

  // Remove bold/italics markers
  clean = clean.replace(/\*\*(.*?)\*\*/g, '$1');
  clean = clean.replace(/\*(.*?)\*/g, '$1');
  clean = clean.replace(/__(.*?)__/g, '$1');
  clean = clean.replace(/_(.*?)_/g, '$1');

  // Remove code blocks and inline code
  clean = clean.replace(/```[\s\S]*?```/g, '');
  clean = clean.replace(/`([^`]+)`/g, '$1');

  // Remove remaining markdown headers
  clean = clean.replace(/^#+\s+/gm, '');

  // Remove special symbols like pipes, blockquote markers
  clean = clean.replace(/[|>\\]/g, ' ');

  // Standardize abbreviations for better Turkish pronunciation
  clean = clean.replace(/\bMEB-KİT\b/gi, 'Meb Kit');
  clean = clean.replace(/\bMEB\b/g, 'Milli Eğitim Bakanlığı');
  clean = clean.replace(/\b3B\b/gi, '3 Boyutlu');
  clean = clean.replace(/\b3D\b/gi, '3 Boyutlu');
  clean = clean.replace(/\b(dk|dak)\b/gi, 'dakika');
  clean = clean.replace(/\b(sn)\b/gi, 'saniye');
  clean = clean.replace(/\b(örn|ör)\b/gi, 'örneğin');
  clean = clean.replace(/\b(vb)\b/gi, 've benzeri');
  clean = clean.replace(/\b(vs)\b/gi, 've saire');

  // Clean excessive spaces and newlines
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

/**
 * Splits a long text into shorter, natural sentence chunks to prevent browser SpeechSynthesis timeouts and enable cloud TTS streaming.
 */
export function chunkTextIntoSentences(text, maxLength = 130) {
  if (!text) return [];

  // Match sentences ending in punctuation
  const rawSentences = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [text];
  const chunks = [];
  let currentChunk = '';

  for (let s of rawSentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    if ((currentChunk + ' ' + trimmed).length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmed;
    } else {
      currentChunk = currentChunk ? `${currentChunk} ${trimmed}` : trimmed;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Returns available voices matching the target language (default: tr-TR).
 */
export function getAvailableVoices(langPrefix = 'tr') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const voices = window.speechSynthesis.getVoices();
  const filtered = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
  return filtered.length > 0 ? filtered : voices;
}
