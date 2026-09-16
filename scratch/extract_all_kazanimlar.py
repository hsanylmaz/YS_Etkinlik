import os
import sys
import re
import json
import unicodedata
import fitz # PyMuPDF

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pdf_dir = os.path.join(BASE_DIR, "Ogretim_Programlari")
output_file = os.path.join(BASE_DIR, "public", "kazanimlar.json")

TURKISH_ALPHABET = ['a', 'b', 'c', 'ç', 'd', 'e', 'f', 'g', 'ğ', 'h', 'ı', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'ö', 'p', 'r', 's', 'ş', 't', 'u', 'ü', 'v', 'y', 'z']
ENGLISH_ALPHABET = [chr(c) for c in range(ord('a'), ord('z')+1)]

def clean_text(text):
    if not text:
        return ""
    text = unicodedata.normalize('NFC', text)
    text = text.replace('\xad', '')
    text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
    text = re.sub(r'(\w+)-\s+(\w+)', r'\1\2', text)
    truncate_pattern = re.compile(
        r'\b(İÇERİK\s+ÇERÇEVESİ|CONTENT\s+FRAMEWORK|İçerik\s+Çerçevesi|ANAHTAR\s+KAVRAMLAR|'
        r'Anahtar\s+Kavramlar|KAVRAMSAL\s+BECERİLER|Kavramsal\s+Beceriler|EĞİLİMLER|Eğilimler|'
        r'PROGRAMLAR\s+ARASI\s+BİLEŞENLER|ÖĞRENME\s+KANITLARI|Öğrenme\s+Kanıtları|'
        r'LEARNING-TEACHING\s+EXPERIENCES|ÖĞRENME-ÖĞRETME\s+UYGULAMALARI|ÖĞRENME-ÖĞRETME\s+YAŞANTILARI)\b',
        re.IGNORECASE
    )
    match = truncate_pattern.search(text)
    if match:
        text = text[:match.start()].strip()
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_desc_and_surec(desc_text, is_english=False):
    alphabet = ENGLISH_ALPHABET if is_english else TURKISH_ALPHABET
    current_index = 0
    splits = []
    pos = 0
    
    while pos < len(desc_text) and current_index < len(alphabet):
        expected_letter = alphabet[current_index]
        pattern = re.compile(rf'(?:^|\s+)({expected_letter})\s*\)\s*')
        match = pattern.search(desc_text, pos)
        if match:
            splits.append({
                'letter': expected_letter,
                'start': match.start(),
                'end': match.end()
            })
            pos = match.end()
            current_index += 1
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
        end_content = splits[idx+1]['start'] if idx + 1 < len(splits) else len(desc_text)
        val = clean_text(desc_text[start_content:end_content])
        if val:
            surec_list.append(f"{letter}) {val}")
            
    return main_desc, surec_list

# Load existing database to preserve other subjects (Fizik, Kimya, Biyoloji, etc.)
existing_database = {}
if os.path.exists(output_file):
    try:
        with open(output_file, 'r', encoding='utf-8') as f:
            existing_database = json.load(f)
        print(f"Loaded existing database with {len(existing_database)} subjects.")
    except Exception as e:
        print(f"Warning: Could not read existing database: {e}")

database = dict(existing_database)

# Enforce strict 5-12 grade restriction across all subjects
for subj in list(database.keys()):
    for g in list(database[subj].keys()):
        if not g.isdigit() or int(g) < 5 or int(g) > 12:
            del database[subj][g]

def add_outcome(subject, grade, code, desc, surec):
    if not code or not desc:
        return
    grade_str = str(grade)
    # Strictly limit to grades 5-12 as instructed by the user
    if not grade_str.isdigit() or int(grade_str) < 5 or int(grade_str) > 12:
        return
        
    if subject not in database:
        database[subject] = {}
    if grade_str not in database[subject]:
        database[subject][grade_str] = []
        
    existing_idx = next((i for i, x in enumerate(database[subject][grade_str]) if x['code'] == code), None)
    if existing_idx is not None:
        item = database[subject][grade_str][existing_idx]
        if len(surec) > len(item.get('surecBilesenleri', [])):
            database[subject][grade_str][existing_idx] = {
                'code': code,
                'description': desc,
                'surecBilesenleri': surec
            }
    else:
        database[subject][grade_str].append({
            'code': code,
            'description': desc,
            'surecBilesenleri': surec
        })

def extract_code_first(pdf_path, subject, code_prefix_regex, grades_to_reset=None, is_english=False):
    if not os.path.exists(pdf_path):
        print(f"Warning: File not found: {pdf_path}")
        return
        
    print(f"Parsing {os.path.basename(pdf_path)} for '{subject}'...")
    
    if grades_to_reset:
        if subject not in database:
            database[subject] = {}
        for g in grades_to_reset:
            database[subject][str(g)] = []

    doc = fitz.open(pdf_path)
    page_texts = []
    for p in range(len(doc)):
        t = unicodedata.normalize('NFC', doc[p].get_text('text'))
        t = t.replace('\xad', '')
        page_texts.append(t)
        
    full_text = "\n".join(page_texts)
    pattern = re.compile(
        rf'\b({code_prefix_regex}\.(\d+)\.(\d+)\.([A-Za-z0-9]+))\.\s*(.*?)(?=\b{code_prefix_regex}\.\d+\.\d+\.[A-Za-z0-9]+\.|\bİÇERİK\s+ÇERÇEVESİ|\bCONTENT\s+FRAMEWORK|\bGenellemeler|\bDisipline\s+ait|\Z)',
        re.DOTALL
    )
    
    count = 0
    for m in pattern.finditer(full_text):
        code_str = m.group(1)
        grade = m.group(2)
        content_block = m.group(5)
        
        if code_str.startswith("TA."):
            code_str = code_str.replace("TA.", "İTA.")
            
        main_desc, surec = parse_desc_and_surec(content_block, is_english=is_english)
        if len(main_desc) > 10 or surec:
            add_outcome(subject, grade, code_str, main_desc, surec)
            count += 1
            
    print(f"[{subject}] Parsed {count} outcome blocks.")

def extract_turkce(pdf_path):
    if not os.path.exists(pdf_path):
        print(f"Warning: File not found: {pdf_path}")
        return
        
    print(f"Parsing {os.path.basename(pdf_path)} for 'Türkçe'...")
    database['Türkçe'] = {'5': [], '6': [], '7': [], '8': []}
    
    doc = fitz.open(pdf_path)
    all_lines = []
    for p in range(31, 56):
        txt = unicodedata.normalize('NFC', doc[p].get_text('text')).replace('\xad', '')
        for l in txt.split('\n'):
            l = l.strip()
            if not l: continue
            if l in [
                'ORTAOKUL TÜRKÇE DERSİ ÖĞRETİM PROGRAMI',
                'ALAN BECERİSİ: DİNLEME/İZLEME', 'ALAN BECERİSİ: OKUMA',
                'ALAN BECERİSİ: KONUŞMA', 'ALAN BECERİSİ: YAZMA',
                'ÖĞRENME ÇIKTISI VE SÜREÇ BİLEŞENLERİ',
                'ÖĞRENME ÇIKTISI SINIF SEVİYESİNE GÖRE KODLARI VE AÇIKLAMALARI',
                '5', '6', '7', '8'
            ]:
                continue
            if l.isdigit() and len(l) <= 3:
                continue
            if l.startswith('9. Tablo:'):
                continue
            all_lines.append(l)

    code_re = re.compile(r'^(T\.[DOKY]\.([5678])\.(\d+))\b\.?')
    segments = []
    current_lines = []

    i = 0
    while i < len(all_lines):
        line = all_lines[i]
        m = code_re.match(line)
        if m:
            run_codes = []
            while i < len(all_lines) and code_re.match(all_lines[i]):
                run_codes.append(code_re.match(all_lines[i]).group(1))
                i += 1
            segments.append((current_lines, run_codes))
            current_lines = []
        else:
            current_lines.append(line)
            i += 1

    for text_lines, codes in segments:
        joined_text = ' '.join(text_lines)
        m_a = re.search(r'(?:^|\s+)a\)\s*', joined_text)
        if m_a:
            title = clean_text(joined_text[:m_a.start()])
            surec_part = joined_text[m_a.start():]
            splits = []
            pos = 0
            c_idx = 0
            while pos < len(surec_part) and c_idx < len(TURKISH_ALPHABET):
                let = TURKISH_ALPHABET[c_idx]
                bm = re.search(rf'(?:^|\s+)({let})\)\s*', surec_part[pos:])
                if bm:
                    splits.append((let, pos + bm.start(), pos + bm.end()))
                    pos += bm.end()
                    c_idx += 1
                else:
                    break
            surec_list = []
            for s_idx, (let, st, ed) in enumerate(splits):
                nxt = splits[s_idx+1][1] if s_idx + 1 < len(splits) else len(surec_part)
                chunk = clean_text(surec_part[ed:nxt])
                if chunk:
                    surec_list.append(f"{let}) {chunk}")
            for c in codes:
                gr = c.split('.')[2]
                add_outcome('Türkçe', gr, c, title, surec_list)
        else:
            # Code without explicit process bullet
            title = clean_text(joined_text)
            for c in codes:
                gr = c.split('.')[2]
                add_outcome('Türkçe', gr, c, title, [])

print("\n--- Starting Curriculum Extraction ---")

# 1. Din Kültürü ve Ahlak Bilgisi (5, 6, 7, 8)
extract_code_first(
    os.path.join(pdf_dir, 'din-kulturu-ve-ahlak-bilgisi-dersi.pdf'),
    'Din Kültürü ve Ahlak Bilgisi',
    'DKAB',
    grades_to_reset=['5', '6', '7', '8']
)

# 2. Fen Bilimleri (5, 6, 7, 8)
extract_code_first(
    os.path.join(pdf_dir, 'fen-bilimleri-dersi_20260902_111309_119.pdf'),
    'Fen Bilimleri',
    'FB',
    grades_to_reset=['5', '6', '7', '8']
)

# 3. Matematik (5, 6, 7, 8 ortaokul güncellenir, 9-12 lise korunur)
extract_code_first(
    os.path.join(pdf_dir, 'ortaokul-matematik-dersi_20260902_111111_630.pdf'),
    'Matematik',
    'MAT',
    grades_to_reset=['5', '6', '7', '8']
)

# 4. T.C. İnkılap Tarihi ve Atatürkçülük (8)
extract_code_first(
    os.path.join(pdf_dir, 'tc-inkilap-tarihi-ve-ataturkculuk-dersi_8.pdf'),
    'T.C. İnkılap Tarihi ve Atatürkçülük',
    '(?:İTA|TA)',
    grades_to_reset=['8']
)

# 5. T.C. İnkılap Tarihi ve Atatürkçülük (12)
extract_code_first(
    os.path.join(pdf_dir, 'tc-inkilap-tarihi-ve-ataturkculuk-dersi_12.pdf'),
    'T.C. İnkılap Tarihi ve Atatürkçülük',
    'İTA',
    grades_to_reset=['12']
)

# 6. İngilizce (9, 10, 11, 12 lise güncellenir, 5-8 ortaokul korunur)
extract_code_first(
    os.path.join(pdf_dir, 'ingilizce_9_12_ogretim_programi.pdf'),
    'İngilizce',
    'ENG',
    grades_to_reset=['9', '10', '11', '12'],
    is_english=True
)

# 7. Türkçe (5, 6, 7, 8)
extract_turkce(os.path.join(pdf_dir, 'ortaokul-turkce-dersi_20260902_111157_977.pdf'))

# Sort database alphabetically by subject, and numerically by grade
sorted_database = {}
for subj in sorted(database.keys()):
    sorted_database[subj] = {}
    for gr in sorted(database[subj].keys(), key=lambda x: int(x) if x.isdigit() else 99):
        sorted_database[subj][gr] = sorted(database[subj][gr], key=lambda x: x['code'])

print("\n--- Writing final database to public/kazanimlar.json ---")
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(sorted_database, f, ensure_ascii=False, indent=2)

print(f"Successfully saved database to {output_file}!")
print("\nFinal Subject Summary:")
for subj in sorted(sorted_database.keys()):
    gr_summary = {g: len(items) for g, items in sorted_database[subj].items()}
    print(f"  {subj}: {gr_summary}")
