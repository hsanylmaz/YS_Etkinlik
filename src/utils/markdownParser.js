// src/utils/markdownParser.js

export function formatMarkdown(text) {
    if (!text) return "";
    
    let html = text + "\n"; 
    
    // Parse tables (supports empty headers | | |)
    html = html.replace(/(\|.*\|)\n(\|[-:| ]+\|)\n((\|.*\|(\n|$))+)/g, function(match, headerLine, separatorLine, bodyLines) {
        const headerTextClean = headerLine.replace(/\|/g, '').trim();
        const headers = headerLine.split('|').filter(c => c.trim() !== '').map(c => `<th>${c.trim()}</th>`).join('');
        const thead = headerTextClean ? `<thead><tr class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">${headers}</tr></thead>` : '';
        const rows = bodyLines.trim().split('\n').map(row => {
            const cells = row.split('|').filter((c, i, arr) => !(i===0 && c.trim()==='') && !(i===arr.length-1 && c.trim()==='')).map(c => `<td>${c.trim()}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');
        return `<div class="overflow-x-auto my-4"><table class="w-full text-sm border-collapse">${thead}<tbody>${rows}</tbody></table></div>`;
    });
    
    // Parse headings
    html = html.replace(/^###\s*(.*$)/gim, '<h3 class="text-lg font-bold text-slate-800 mt-6 mb-3 border-b border-slate-100 pb-1">$1</h3>')
               .replace(/^##\s*(.*$)/gim, '<h2 class="text-xl font-bold text-indigo-700 mt-8 mb-4 border-b border-indigo-100 pb-1.5">$1</h2>');

    // Format bold, italics, lists, links, paragraphs, and line breaks
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
               .replace(/\*(.*?)\*/g, '<em>$1</em>')
               .replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>')
               .replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>')
               .replace(/<\/ul>\n<ul>/g, '\n')
               .replace(/\n\n/g, '<p class="my-3 text-slate-700 leading-relaxed"></p>')
               .replace(/\n/g, '<br>');
               
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="my-3 text-center"><img src="$2" alt="$1" class="max-w-md h-auto rounded-xl shadow-md border border-slate-200 mx-auto" /></div>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 font-medium transition-colors underline">$1</a>');
    html = html.replace(/(<br>)*<ul>/g, '<ul class="list-disc pl-5 my-2 space-y-1">').replace(/<\/ul>(<br>)*/g, '</ul>');
    
    return html;
}

function getStandardizedKey(key) {
    const k = key.toLowerCase();
    
    // Etkinlik ID / Senaryo ID
    if (k.includes("etkinlik id") || k.includes("senaryo id") || k.includes("activity id") || k.includes("aktivitäts-id") || k.includes("id de l'activité") || k.includes("معرف النشاط")) {
        return "etkinlikId";
    }
    // Etkinlik Başlığı / Senaryo Adı
    if (k.includes("etkinlik başlığı") || k.includes("senaryo adı") || k.includes("activity title") || k.includes("scenario name") || k.includes("aktivitätstitel") || k.includes("szenario-name") || k.includes("titre de l'activité") || k.includes("nom du scénario") || k.includes("عنوان النشاط") || k.includes("اسم السيناريو")) {
        return "baslik";
    }
    // Genel Bakış
    if (k.includes("genel bakış") || k.includes("overview") || k.includes("überblick") || k.includes("aperçu") || k.includes("نظرة عامة")) {
        return "genelBakis";
    }
    // Etkinlik Süresi
    if (k.includes("etkinlik süresi") || k.includes("activity duration") || k.includes("aktivitätsdauer") || k.includes("durée de l'activité") || k.includes("مدة النشاط") || k.includes("durée")) {
        return "sure";
    }
    // Ders/Kademe/Süre (TOÖS)
    if (k.includes("ders/kademe/süre") || k.includes("course/level/duration") || k.includes("fach/stufe/dauer") || k.includes("cours/niveau/durée") || k.includes("المادة/المرحلة/المدة")) {
        return "ders_kademe_sure";
    }
    // Kademe
    if (k.includes("kademe") || k.includes("level") || k.includes("stufe") || k.includes("niveau") || k.includes("المرحلة")) {
        return "kademe";
    }
    // Sınıf Seviyesi
    if (k.includes("sınıf seviyesi") || k.includes("grade level") || k.includes("klassenstufe") || k.includes("niveau de classe") || k.includes("المستوى الصفi") || k.includes("المستوى الصفي")) {
        return "sinifSeviyesi";
    }
    // Ders Adı
    if (k.includes("ders adı") || k.includes("course name") || k.includes("fachname") || k.includes("nom du cours") || k.includes("اسم المادة")) {
        return "dersAdi";
    }
    // Ünite/Tema/Öğrenme Alanı
    if (k.includes("ünite/tema") || k.includes("öğrenme alanı") || k.includes("unit/theme") || k.includes("learning area") || k.includes("einheit/thema") || k.includes("lernbereich") || k.includes("unité/thème") || k.includes("domaine d'apprentissage") || k.includes("الوحدة/الموضوع") || k.includes("مجال التعلم")) {
        return "unite";
    }
    // Konu/İçerik Çerçevesi
    if (k.includes("konu/içerik") || k.includes("konu") || k.includes("subject/content") || k.includes("topic") || k.includes("thema/inhalt") || k.includes("sujet/cadre") || k.includes("الموضوع/إطار المحتوى")) {
        return "konu";
    }
    // Kazanımlar / Öğrenme Hedefleri / Amaçları
    if (k.includes("kazanımlar") || k.includes("öğrenme çıktıları") || k.includes("öğrenme hedefleri") || k.includes("amaçlar") || k.includes("amaçları") || k.includes("learning outcomes") || k.includes("objectives") || k.includes("lernergebnisse") || k.includes("ziele") || k.includes("résultats d'apprentissage") || k.includes("objectifs") || k.includes("النواتج التعليمية") || k.includes("المخرجات") || k.includes("الأهداف")) {
        return "kazanimlar";
    }
    // Donanım
    if (k.includes("donanım") || k.includes("hardware") || k.includes("equipment") || k.includes("ausstattung") || k.includes("matériel") || k.includes("الأجهزة") || k.includes("المعدats") || k.includes("المعدات")) {
        return "donanim";
    }
    // Çevrim İçi Araçlar / Araçlar & Teknolojiler
    if (k.includes("çevrim içi") || k.includes("online tools") || k.includes("online-tools") || k.includes("outils en ligne") || k.includes("أدوات عبر الإنترنت") || k.includes("araçlar/teknolojiler") || k.includes("araçlar") || k.includes("tools & technologies")) {
        return "cevrimIci";
    }
    // Öğretim Materyalleri
    if (k.includes("öğretim materyalleri") || k.includes("teaching materials") || k.includes("lehrmaterialien") || k.includes("matériel didactique") || k.includes("المواد التعليمية")) {
        return "ogretimMateryalleri";
    }
    // Etkinlik Alanı / Yaklaşım
    if (k.includes("etkinlik alanı") || k.includes("öğrenme yaklaşımı") || k.includes("activity area") || k.includes("learning approach") || k.includes("aktivitätsbereich") || k.includes("lernansatz") || k.includes("zone d'activité") || k.includes("approche d'apprentissage") || k.includes("منطقة النشاط") || k.includes("نهj") || k.includes("نهg") || k.includes("نهج التعلم")) {
        return "etkinlikAlani";
    }
    // Öğrencilerin Konumu
    if (k.includes("öğrencilerin konumu") || k.includes("students' placement") || k.includes("students placement") || k.includes("schülerposition") || k.includes("position des élèves") || k.includes("موقع الطلاب")) {
        return "ogrencilerinKonumu";
    }
    // Öğretmenin Rolü
    if (k.includes("öğretmenin rolü") || k.includes("teacher's role") || k.includes("teacher role") || k.includes("rolle des lehrers") || k.includes("rôle de l'enseignant") || k.includes("دور المعلم")) {
        return "ogretmeninRolü";
    }
    // Hazırlık / Görevler
    if (k.includes("hazırlık") || k.includes("görevler") || k.includes("preparation") || k.includes("tasks") || k.includes("vorbereitung") || k.includes("aufgaben") || k.includes("préparation") || k.includes("tâches") || k.includes("التحضير") || k.includes("المهام")) {
        return "hazirlik";
    }
    // Uygulama / Öğrenme Etkinlikleri
    if (k.startsWith("uygulama") || k.includes("uygulama") || k.includes("öğrenme etkinlikleri") || k.startsWith("implementation") || k.includes("learning activities") || k.startsWith("durchführung") || k.includes("lernaktivitäten") || k.startsWith("mise en œuvre") || k.includes("activités d'apprentissage") || k.startsWith("التنفيذ") || k.includes("أنشطة التعلم")) {
        return "uygulama";
    }
    // Etkinlik Sonu
    if (k.includes("etkinlik sonu") || k.includes("closure") || k.includes("conclusion") || k.includes("aktivitätsende") || k.includes("fin de l'activité") || k.includes("نهاية النشاط")) {
        return "etkinlikSonu";
    }
    // Beceriler
    if (k.includes("beceriler") || k.includes("skills") || k.includes("fertigkeiten") || k.includes("compétences") || k.includes("المهارات")) {
        return "beceriler";
    }
    // Değerlendirme
    if (k.includes("değerlendirme") || k.includes("ölçme") || k.includes("assessment") || k.includes("evaluation") || k.includes("bewertung")) {
        return "degerlendirme";
    }
    // Kaynakça / İlgili Bağlantılar
    if (k.includes("kaynakça") || k.includes("kaynakca") || k.includes("referans") || k.includes("references") || k.includes("literatur") || k.includes("المراجع") || k.includes("ilgili bağlantılar") || k.includes("related links")) {
        return "kaynakca";
    }
    
    return null;
}

function sanitizeMarkdownTables(markdown) {
    if (!markdown) return "";
    const lines = markdown.split('\n');
    const resultLines = [];
    let insideTable = false;
    let currentTableLine = "";

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Auto-fix STL link row to always show all 4 search options vertically
        if (line.includes("Düzenlenebilir Dosya Linki") && line.includes(".STL")) {
            const urlMatch = line.match(/(?:q=|keyword=)([^)&\s"|]+)/i);
            let keyword = "3d+model";
            if (urlMatch) {
                keyword = urlMatch[1];
            }
            const cleanKeyword = keyword.replace(/[\/\(\)\<\>\@\#\$\%\^\&\*\+\=\[\]\{\}\:\;\'\"\|\,\?\~\`]/g, "");
            line = `| **Örnek Tasarımın Düzenlenebilir Dosya Linki (.STL)** | • [🔍 Thingiverse'de Ara](https://www.thingiverse.com/search?q=${cleanKeyword}) <br> • [🔍 Printables'da Ara](https://www.printables.com/search/models?q=${cleanKeyword}) <br> • [🔍 Tinkercad'de Ara](https://www.tinkercad.com/search?q=${cleanKeyword}) <br> • [🔍 Creality Cloud'da Ara](https://www.crealitycloud.com/search-results/model?keyword=${cleanKeyword}) |`;
        }
        
        // Auto-fix GCODE link row to always show standard instruction text
        if (line.includes("Basılabilir Dosya Linki") && line.includes(".GCODE")) {
            line = `| **Örnek Tasarımın Basılabilir Dosya Linki (.GCODE)** | Örnek tasarımı dilimletip gcode dışa aktarıp buraya ekleyebilirsiniz. |`;
        }

        const trimmed = line.trim();

        const startsWithPipe = trimmed.startsWith('|');
        const isHeaderSeparator = trimmed.match(/^\|?\s*[-:| ]+\s*\|?$/);

        if (startsWithPipe && !isHeaderSeparator) {
            if (insideTable) {
                if (currentTableLine) {
                    if (!currentTableLine.trim().endsWith('|')) {
                        // Append to current table line
                        currentTableLine += "<br>" + trimmed.replace(/^\|/, "").trim();
                    } else {
                        // Previous table line is complete, flush it and start new row
                        resultLines.push(currentTableLine);
                        currentTableLine = trimmed;
                    }
                } else {
                    currentTableLine = trimmed;
                }
            } else {
                insideTable = true;
                currentTableLine = trimmed;
            }
        } else if (isHeaderSeparator) {
            if (currentTableLine) {
                resultLines.push(currentTableLine);
            }
            resultLines.push(line);
            currentTableLine = "";
            insideTable = true;
        } else {
            // Does not start with pipe
            if (insideTable && currentTableLine) {
                // Continuation of cell
                if (trimmed) {
                    if (trimmed.endsWith('|')) {
                        currentTableLine += "<br>" + trimmed.substring(0, trimmed.length - 1).trim() + " |";
                    } else {
                        currentTableLine += "<br>" + trimmed;
                    }
                } else {
                    currentTableLine += "<br>";
                }
            } else {
                if (insideTable) {
                    if (currentTableLine) {
                        resultLines.push(currentTableLine);
                        currentTableLine = "";
                    }
                    insideTable = false;
                }
                resultLines.push(line);
            }
        }
    }

    if (currentTableLine) {
        resultLines.push(currentTableLine);
    }

    return resultLines.join('\n');
}

export function parseGeneratedMarkdown(markdown) {
    const sanitizedMarkdown = sanitizeMarkdownTables(markdown || "");
    const data = {
        etkinlikId: "",
        baslik: "",
        genelBakis: "",
        sure: "",
        kademe: "",
        sinifSeviyesi: "",
        dersAdi: "",
        unite: "",
        konu: "",
        kazanimlar: "",
        donanim: "",
        cevrimIci: "",
        ogretimMateryalleri: "",
        etkinlikAlani: "",
        ogrencilerinKonumu: "",
        ogretmeninRolü: "",
        hazirlik: "",
        uygulama: "",
        etkinlikSonu: "",
        degerlendirme: "",
        kaynakca: "",
        ekler: ""
    };
    
    const eklerMatch = sanitizedMarkdown.match(/###\s*EKLER[\s\S]+/i) || sanitizedMarkdown.match(/###\s*APPENDICES[\s\S]+/i) || sanitizedMarkdown.match(/###\s*ANHÄNGE[\s\S]+/i) || sanitizedMarkdown.match(/###\s*الملhقات[\s\S]+/i);
    if (eklerMatch) {
        data.ekler = eklerMatch[0].replace(/###\s*EKLER/i, "").replace(/###\s*APPENDICES/i, "").replace(/###\s*ANHÄNGE/i, "").replace(/###\s*الملحقات/i, "").trim();
    } else {
        // Fallback: search for MEB-KİT or 3B headings directly
        const mebIndex = sanitizedMarkdown.search(/###\s*MEB-KİT/i);
        const printerIndex = sanitizedMarkdown.search(/###\s*3B\s*TASARIM/i);
        
        let startIndex = -1;
        if (mebIndex !== -1 && printerIndex !== -1) {
            startIndex = Math.min(mebIndex, printerIndex);
        } else if (mebIndex !== -1) {
            startIndex = mebIndex;
        } else if (printerIndex !== -1) {
            startIndex = printerIndex;
        }
        
        if (startIndex !== -1) {
            data.ekler = sanitizedMarkdown.substring(startIndex).trim();
        }
    }
    
    const lines = sanitizedMarkdown.split('\n');
    let currentTableKey = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('|')) continue;
        if (line.includes('|---|') || line.includes('| :---') || line.includes('|:---|')) continue;
        
        const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
        if (cells.length === 2) {
            const rawKey = cells[0].replace(/\*\*/g, '').trim();
            const val = cells[1];
            const keyType = getStandardizedKey(rawKey);
            
            if (keyType === "etkinlikId") {
                data.etkinlikId = val;
            } else if (keyType === "baslik") {
                data.baslik = val;
            } else if (keyType === "genelBakis") {
                data.genelBakis = val;
            } else if (keyType === "sure") {
                data.sure = val;
            } else if (keyType === "ders_kademe_sure") {
                const parts = val.split('/').map(p => p.trim());
                if (parts.length >= 3) {
                    data.dersAdi = parts[0];
                    data.kademe = parts[1];
                    data.sure = parts[2];
                }
            } else if (keyType === "kademe") {
                data.kademe = val;
            } else if (keyType === "sinifSeviyesi") {
                data.sinifSeviyesi = val;
            } else if (keyType === "dersAdi") {
                data.dersAdi = val;
            } else if (keyType === "unite") {
                data.unite = val;
            } else if (keyType === "konu") {
                data.konu = val;
            } else if (keyType === "kazanimlar") {
                data.kazanimlar = val;
            } else if (keyType === "donanim") {
                data.donanim = val;
            } else if (keyType === "cevrimIci") {
                data.cevrimIci = val;
            } else if (keyType === "ogretimMateryalleri") {
                data.ogretimMateryalleri = val;
            } else if (keyType === "etkinlikAlani") {
                data.etkinlikAlani = val;
            } else if (keyType === "ogrencilerinKonumu") {
                data.ogrencilerinKonumu = val;
            } else if (keyType === "ogretmeninRolü") {
                data.ogretmeninRolü = val;
            } else if (keyType === "hazirlik") {
                data.hazirlik = val;
            } else if (keyType === "uygulama") {
                data.uygulama = val;
            } else if (keyType === "etkinlikSonu") {
                data.etkinlikSonu = val;
            } else if (keyType === "beceriler") {
                data.kazanimlar += "\n\nHedeflenen Beceriler: " + val;
            } else if (keyType === "degerlendirme") {
                data.degerlendirme = val;
            } else if (keyType === "kaynakca") {
                data.kaynakca = val;
            }
        } else if (cells.length === 1) {
            const val = cells[0];
            const lowerVal = val.toLowerCase();
            
            if (lowerVal.includes("ölçme") || lowerVal.includes("değerlendirme") || lowerVal.includes("assessment") || lowerVal.includes("evaluation") || lowerVal.includes("bewertung")) {
                currentTableKey = "degerlendirme";
            } else if (lowerVal.includes("kaynakca") || lowerVal.includes("kaynakça") || lowerVal.includes("referans") || lowerVal.includes("references") || lowerVal.includes("literatur") || lowerVal.includes("المراجع")) {
                currentTableKey = "kaynakca";
            } else if (lowerVal.includes("ekler") || lowerVal.includes("appendices") || lowerVal.includes("anhänge") || lowerVal.includes("الملحقات")) {
                currentTableKey = "ekler_header";
            } else {
                if (currentTableKey === "degerlendirme") {
                    data.degerlendirme += (data.degerlendirme ? "\n" : "") + val;
                } else if (currentTableKey === "kaynakca") {
                    data.kaynakca += (data.kaynakca ? "\n" : "") + val;
                }
            }
        }
    }
    
    return data;
}
