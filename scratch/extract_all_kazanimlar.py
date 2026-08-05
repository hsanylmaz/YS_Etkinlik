import os
import fitz # PyMuPDF
import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

pdf_dir = r"C:\Users\hasan\Desktop\YS_Etkinlik-main\ders_programlari"
output_file = r"C:\Users\hasan\Desktop\YS_Etkinlik-main\public\kazanimlar.json"

CODE_TO_SUBJECT = {
    "MAT": "Matematik",
    "FB": "Fen Bilimleri",
    "TDE": "Türk Dili ve Edebiyatı",
    "TÜR": "Türkçe",
    "TUR": "Türkçe",
    "T.D": "Türkçe",
    "T.O": "Türkçe",
    "T.K": "Türkçe",
    "T.Y": "Türkçe",
    "SB": "Sosyal Bilgiler",
    "FZ": "Fizik",
    "FİZ": "Fizik",
    "KM": "Kimya",
    "KİM": "Kimya",
    "BY": "Biyoloji",
    "BİY": "Biyoloji",
    "CO": "Coğrafya",
    "COĞ": "Coğrafya",
    "TA": "T.C. İnkılap Tarihi ve Atatürkçülük",
    "TAR": "Tarih",
    "FL": "Felsefe",
    "FEL": "Felsefe",
    "İTA": "T.C. İnkılap Tarihi ve Atatürkçülük",
    "MÜZ": "Müzik",
    "GS": "Görsel Sanatlar",
    "BED": "Beden Eğitimi ve Spor",
    "DO": "Din Kültürü ve Ahlak Bilgisi",
    "DKAB": "Din Kültürü ve Ahlak Bilgisi",
    "BTY": "Bilişim Teknolojileri ve Yazılım",
    "İNG": "İngilizce",
    "ENG": "İngilizce",
    "ALM": "Almanca",
    "DE": "Almanca",
    "ARP": "Arapça",
    "KB": "Kur'an-ı Kerim",
    "KY": "Çoklu Yaşantılı İngilizce"
}

code_pattern = re.compile(
    r'\b(?:'
    r'([A-ZÇĞİÖŞÜ]{2,5})\.(\d{1,2})\.(\d{1,2})\.([A-Z]?\d{1,2})'
    r'|'
    r'(T)\.([DOKY])\.(\d{1,2})\.(\d{1,2})'
    r')\b\.?'
)

TURKISH_ALPHABET = ['a', 'b', 'c', 'ç', 'd', 'e', 'f', 'g', 'ğ', 'h', 'ı', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'ö', 'p', 'r', 's', 'ş', 't', 'u', 'ü', 'v', 'y', 'z']

def should_skip_line(line_clean):
    if not line_clean:
        return True
    if line_clean.isdigit():
        return True
    lower_line = line_clean.lower()
    skip_keywords = [
        "öğretim programı",
        "öğretim programları",
        "curriculum",
        "türkiye yüzyılı",
        "maarif modeli",
        "millî eğitim bakanlığı",
        "milli eğitim bakanliği",
        "bakanlığı"
    ]
    for kw in skip_keywords:
        if kw in lower_line:
            return True
    return False

def clean_text(text):
    if not text:
        return ""
    text = text.replace('\u0307', '') # Clean Unicode combining dot above
    text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
    text = re.sub(r'(\w+)-\s*(\w+)', r'\1\2', text)
    truncate_pattern = re.compile(r'\b(İÇERİK\s+ÇERÇEVESİ|İçerik\s+Çerçevesi|ANAHTAR\s+KAVRAMLAR|Anahtar\s+Kavramlar|KAVRAMSAL\s+BECERİLER|Kavramsal\s+Beceriler|EĞİLİMLER|Eğilimler|PROGRAMLAR\s+ARASI\s+BİLEŞENLER|Programlar\s+Arası\s+Bileşenler)\b', re.IGNORECASE)
    match = truncate_pattern.search(text)
    if match:
        text = text[:match.start()].strip()
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_desc_and_surec(desc_text):
    current_index = 0
    splits = []
    text_len = len(desc_text)
    pos = 0
    expected_letter = TURKISH_ALPHABET[current_index]
    
    while pos < text_len:
        pattern = re.compile(rf'(?:^|\s+)({expected_letter})\)\s*')
        match = pattern.search(desc_text, pos)
        if match:
            match_start, match_end = match.span()
            splits.append({
                'letter': expected_letter,
                'start': match_start,
                'end': match_end
            })
            pos = match_end
            current_index += 1
            if current_index >= len(TURKISH_ALPHABET):
                break
            expected_letter = TURKISH_ALPHABET[current_index]
        else:
            break
            
    if not splits:
        return clean_text(desc_text), []
        
    first_split_start = splits[0]['start']
    main_desc = clean_text(desc_text[:first_split_start])
    
    surec_list = []
    for idx, split in enumerate(splits):
        letter = split['letter']
        start_content = split['end']
        if idx + 1 < len(splits):
            end_content = splits[idx+1]['start']
        else:
            end_content = text_len
        val = clean_text(desc_text[start_content:end_content])
        if val:
            surec_list.append(f"{letter}) {val}")
            
    return main_desc, surec_list

def is_valid_prefix(before_clean):
    if not before_clean:
        return True
    if re.match(r'^\d+(?:\.\d+)*\.?$', before_clean):
        return True
        
    allowed_terms = {
        "öğrenme", "öğrenme:", "öğrenme-öğretme", "öğrenme-öğretme:",
        "öğrenme-ögretme", "öğrenme-ögretme:",
        "çıktıları", "çıktıları:", "çiktilari", "çiktilari:",
        "süreç", "süreç:", "surec", "surec:",
        "bileşenleri", "bileşenleri:", "bilesenleri", "bilesenleri:",
        "ve", "de", "da", "den", "dan", "in", "ın", "un", "ün",
        "kazanım", "kazanım:", "kazanim", "kazanim:",
        "konu", "konu:", "alanı", "alanı:", "alani", "alani:",
        "dersi", "dersi:", "programı", "programı:", "programi", "programi:",
        "ortaokul", "lise", "sınıf", "sınıf:", "sinif", "sinif:",
        "seviyesi", "seviyesi:", "ders", "ders:", "atölyesi", "atolyesi",
        "uygulamaları", "uygulamaları:", "uygulamalari", "uygulamalari:",
        "teması", "teması:", "temasi", "temasi:", "tema", "tema:",
        "veya", "ile", "için", "icin", "ve/veya",
        "t.c.", "t.c", "inkılap", "inkilap", "tarihi", "tarihi:",
        "atatürkçülük", "ataturkculuk", "almanca", "ingilizce",
        "türkçe", "turkce", "matematik", "fizik", "kimya", "biyoloji"
    }
    
    words = before_clean.split(' ')
    return all(w in allowed_terms or w.isdigit() or re.match(r'^\d+(?:\.\d+)*\.?$', w) for w in words)

database = {}

print("Scanning directory for PDFs...")
pdf_files = [f for f in os.listdir(pdf_dir) if f.lower().endswith('.pdf')]
print(f"Found {len(pdf_files)} PDF files.")

for file_idx, file_name in enumerate(pdf_files):
    pdf_path = os.path.join(pdf_dir, file_name)
    print(f"[{file_idx + 1}/{len(pdf_files)}] Parsing: {file_name}")
    
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"Error opening {file_name}: {e}")
        continue
        
    # Build continuous line list for the entire PDF
    raw_lines = []
    for page_idx in range(len(doc)):
        page_text = doc[page_idx].get_text("text")
        if page_text:
            raw_lines.extend(page_text.split('\n'))
            
    # Filter lines (headers, page numbers) and merge bullet-only lines
    all_lines = []
    line_idx = 0
    while line_idx < len(raw_lines):
        line_clean = raw_lines[line_idx].strip()
        if should_skip_line(line_clean):
            line_idx += 1
            continue
            
        # Check if line is just a bullet like a), b), c)
        if re.match(r'^[a-z]\)$', line_clean) and line_idx + 1 < len(raw_lines):
            next_idx = line_idx + 1
            while next_idx < len(raw_lines) and not raw_lines[next_idx].strip():
                next_idx += 1
            if next_idx < len(raw_lines):
                merged_line = line_clean + " " + raw_lines[next_idx].strip()
                all_lines.append(merged_line)
                line_idx = next_idx + 1
                continue
                
        all_lines.append(raw_lines[line_idx])
        line_idx += 1
        
    # Process sequentially
    i = 0
    while i < len(all_lines):
        line = all_lines[i].strip()
        
        matches = list(code_pattern.finditer(line))
        if matches:
            # Check prefix of first match in line to see if it is at the start of the line (or just a bullet)
            first_start = matches[0].span()[0]
            before_str = line[:first_start].strip()
            
            before_clean = re.sub(r'\s+', ' ', before_str).lower().replace('\u0307', '').strip()
            if not is_valid_prefix(before_clean):
                i += 1
                continue
            
            codes_in_line = []
            last_end = 0
            for m in matches:
                m_start, m_end = m.span()
                mb_str = line[:m_start].strip()
                na_str = line[m_end:].strip().lstrip('.').strip()
                mb = mb_str[-1] if mb_str else ""
                na = na_str[0] if na_str else ""
                
                # Skip parenthesized
                if mb in ('(', '[') or na in (')', ']'):
                    continue
                
                # Skip inline suffixes like T.D.5.1.deki
                if re.match(r'^\.[a-zA-ZçğışöüİĞÜŞÖÇ]', line[m_end:]):
                    continue
                    
                if m.group(1):
                    prefix = m.group(1)
                    grade = m.group(2)
                    code_str = f"{prefix}.{grade}.{m.group(3)}.{m.group(4)}"
                else:
                    prefix = f"{m.group(5)}.{m.group(6)}"
                    grade = m.group(7)
                    code_str = f"{prefix}.{grade}.{m.group(8)}"
                
                # Correct MEB's TA.8.2.5 typo inside İnkılap 8 PDF
                if prefix == "TA" and grade == "8":
                    prefix = "İTA"
                    code_str = "İTA.8.2.5"
                
                codes_in_line.append((code_str, prefix, grade))
                last_end = max(last_end, m_end)
                
            if not codes_in_line:
                i += 1
                continue
                
            desc = line[last_end:].strip()
            desc = re.sub(r'^[\s\.,;:\-–—\u2000-\u200b/]+', '', desc)
            
            j = i + 1
            while j < len(all_lines):
                next_line = all_lines[j].strip()
                
                # Skip empty lines
                if not next_line:
                    j += 1
                    continue
                                    
                if code_pattern.search(next_line):
                    # Ensure next code is not a parenthesized reference or inline suffix
                    nxt_match = code_pattern.search(next_line)
                    n_start, n_end = nxt_match.span()
                    nb_str = next_line[:n_start].strip()
                    na_str = next_line[n_end:].strip().lstrip('.').strip()
                    nb = nb_str[-1] if nb_str else ""
                    na = na_str[0] if na_str else ""
                    if nb in ('(', '[', '/') or na in (')', ']', '/') or re.match(r'^\.[a-zA-ZçğışöüİĞÜŞÖÇ]', next_line[n_end:]):
                        desc += " " + next_line
                        j += 1
                        continue
                    break
                if next_line.isupper() and len(next_line) > 5:
                    break
                if next_line.isdigit():
                    break
                    
                desc += " " + next_line
                j += 1
            
            main_desc, surec_list = parse_desc_and_surec(desc)
            
            for code_str, prefix, grade in codes_in_line:
                subject = CODE_TO_SUBJECT.get(prefix, prefix)
                
                # Only parse allowed grades 5-12
                if grade not in ['5', '6', '7', '8', '9', '10', '11', '12']:
                    continue
                    
                if subject not in database:
                    database[subject] = {}
                if grade not in database[subject]:
                    database[subject][grade] = []
                    
                # No process components for English subject as requested by the user
                actual_surec = [] if subject == "İngilizce" else surec_list
                
                # Check if we should update an existing outcome with a better/longer description
                existing_idx = next((idx for idx, k in enumerate(database[subject][grade]) if k["code"] == code_str), None)
                if existing_idx is not None:
                    existing_item = database[subject][grade][existing_idx]
                    existing_desc = existing_item["description"]
                    existing_surec = existing_item["surecBilesenleri"]
                    
                    if existing_surec and not actual_surec:
                        # Keep existing (which has processes)
                        pass
                    elif actual_surec and not existing_surec:
                        # Overwrite with new (which has processes)
                        database[subject][grade][existing_idx]["description"] = main_desc
                        database[subject][grade][existing_idx]["surecBilesenleri"] = actual_surec
                    else:
                        # Both have or both don't have processes -> prefer the shorter non-empty description
                        if len(main_desc) < len(existing_desc) and len(main_desc) > 15:
                            database[subject][grade][existing_idx]["description"] = main_desc
                            database[subject][grade][existing_idx]["surecBilesenleri"] = actual_surec
                else:
                    if main_desc or actual_surec:
                        database[subject][grade].append({
                            "code": code_str,
                            "description": main_desc,
                            "surecBilesenleri": actual_surec
                        })
                
            i = j - 1
        i += 1

print("Writing JSON database...")
sorted_database = {}
for subj in sorted(database.keys()):
    sorted_database[subj] = {}
    for gr in sorted(database[subj].keys(), key=int):
        sorted_database[subj][gr] = sorted(database[subj][gr], key=lambda x: x["code"])

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(sorted_database, f, ensure_ascii=False, indent=2)

print("Done! JSON database saved to:", output_file)
