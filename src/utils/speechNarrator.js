// src/utils/speechNarrator.js

/**
 * Parses raw markdown or text into clean, human-readable sections suitable for speech synthesis.
 * Removes markdown syntax, table pipes, markdown links, images, and special symbols.
 */
export function extractSpeechSections(markdownText, rawHtml = '') {
  if (!markdownText && !rawHtml) return [];

  let text = markdownText || '';

  // If we only have raw HTML, do a basic conversion
  if (!text && rawHtml) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHtml;
    text = tempDiv.innerText || tempDiv.textContent || '';
  }

  const sections = [];
  const lines = text.split('\n');

  let currentTitle = 'Genel Bilgiler ve Başlık';
  let currentParagraphs = [];

  const pushCurrentSection = () => {
    const combinedText = cleanTextForSpeech(currentParagraphs.join(' '));
    if (combinedText.trim().length > 0) {
      sections.push({
        id: sections.length + 1,
        title: currentTitle,
        text: combinedText
      });
    }
    currentParagraphs = [];
  };

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line is a major Markdown heading (## or ###)
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      pushCurrentSection();
      currentTitle = cleanTextForSpeech(trimmed.replace(/^#+\s*/, ''));
      continue;
    }

    // If it's a table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Ignore separator lines (|---|---|)
      if (/^\|[-:| ]+\|$/.test(trimmed)) continue;
      
      const cells = trimmed
        .split('|')
        .map(c => c.trim())
        .filter(c => c !== '');
      
      if (cells.length > 0) {
        // If 2 cells, format like "Label: Value"
        if (cells.length === 2) {
          currentParagraphs.push(`${cells[0]}: ${cells[1]}.`);
        } else {
          currentParagraphs.push(cells.join(', ') + '.');
        }
      }
      continue;
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
  pushCurrentSection();

  // If no structured sections were created, fallback to single section
  if (sections.length === 0 && text.trim()) {
    sections.push({
      id: 1,
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
 * Returns direct cloud stream URL for real Turkish female voice (Google TTS).
 */
export function getGoogleTTSUrl(text, lang = 'tr') {
  return `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;
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
