// src/utils/docxGenerator.js
import JSZip from 'jszip';
import { parseGeneratedMarkdown } from './markdownParser';

export async function generateDocxBlob(lastResponseText, renderedHtmlContent, options = {}) {
    const { selectedZones = [], sure = "40" } = options;

    // 1. Fetch template from public folder
    const templateUrl = `${import.meta.env.BASE_URL}docx_template.docx?v=${Date.now()}`;
    const response = await fetch(templateUrl);
    if (!response.ok) {
        throw new Error("Word şablon dosyası (docx_template.docx) yüklenemedi. Lütfen public klasöründe olduğundan emin olun.");
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Verify ZIP magic signature (50 4B 03 04) to catch SPA HTML fallbacks
    const arr = new Uint8Array(arrayBuffer).subarray(0, 4);
    const header = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    if (header !== "504b0304") {
        let preview = "";
        try {
            const decoder = new TextDecoder("utf-8");
            preview = decoder.decode(new Uint8Array(arrayBuffer).subarray(0, 150));
        } catch (e) {
            preview = "(ikili veri)";
        }
        throw new Error(`Şablon yüklenemedi (Sunucu dosya yerine web sayfası döndürdü). URL: ${templateUrl} - Önizleme: ${preview}`);
    }
    
    // 2. Parse the markdown or HTML to reconstruct dataset
    let lastResponse = lastResponseText || "";
    if (!lastResponse) {
        // Fallback: parse from rendered HTML
        lastResponse = "";
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderedHtmlContent;
        const htmlRows = tempDiv.querySelectorAll("table tr");
        htmlRows.forEach(tr => {
            const th = tr.querySelector("th, td:first-child");
            const td = tr.querySelector("td:last-child");
            if (th && td) {
                const key = th.innerText.trim();
                const val = td.innerText.trim().replace(/\n/g, "<br>");
                lastResponse += `| **${key}** | ${val} |\n`;
            }
        });
    }

    const data = parseGeneratedMarkdown(lastResponse);
    
    // 3. Load zip template and edit word/document.xml
    const zip = new JSZip();
    const zipFile = await zip.loadAsync(arrayBuffer);
    const xmlString = await zipFile.file("word/document.xml").async("string");
    // Remove UTF-8 BOM (\uFEFF) and leading/trailing whitespace to prevent Safari XML parsing crashes
    const cleanXmlString = xmlString.replace(/^\uFEFF/, "").trim();
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanXmlString, "application/xml");
    
    // Check for XML parsing errors (common on some WebKit/Safari engines)
    const parserErrors = xmlDoc.getElementsByTagName("parsererror");
    if (parserErrors.length > 0) {
        throw new Error("XML Ayrıştırma Hatası: " + parserErrors[0].textContent);
    }
    
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    
    function getXmlElements(parent, tagName) {
        let list = parent.getElementsByTagNameNS(ns, tagName);
        if (!list || list.length === 0) {
            // Wildcard namespace fallback for WebKit/Safari compatibility
            list = parent.getElementsByTagNameNS("*", tagName);
        }
        if (!list || list.length === 0) {
            list = parent.getElementsByTagName(`w:${tagName}`);
        }
        if (!list || list.length === 0) {
            list = parent.getElementsByTagName(tagName);
        }
        return Array.from(list);
    }

    const tables = getXmlElements(xmlDoc, "tbl");
    if (tables.length === 0) throw new Error("Şablonda tablo bulunamadı.");
    
    const table = tables[0];
    const rows = getXmlElements(table, "tr");
    
    function fillCell(rowIdx, cellIdx, text, isBold = false) {
        if (rowIdx >= rows.length) return;
        const row = rows[rowIdx];
        const cells = getXmlElements(row, "tc");
        if (cellIdx >= cells.length) return;
        const cell = cells[cellIdx];
        
        // Remove existing paragraphs
        const paras = getXmlElements(cell, "p");
        paras.forEach(p => {
            if (p.parentNode) p.parentNode.removeChild(p);
        });
        
        const cleanText = text.replace(/<br\s*\/?>/gi, "\n");
        const lines = cleanText.split('\n');
        lines.forEach(line => {
            cell.appendChild(createWp(line.trim(), xmlDoc, isBold));
        });
    }

    function fillCellWithMarkdown(rowIdx, cellIdx, text) {
        if (rowIdx >= rows.length) return;
        const row = rows[rowIdx];
        const cells = getXmlElements(row, "tc");
        if (cellIdx >= cells.length) return;
        const cell = cells[cellIdx];
        
        // Remove existing paragraphs and nested tables
        const paras = getXmlElements(cell, "p");
        paras.forEach(p => {
            if (p.parentNode) p.parentNode.removeChild(p);
        });
        const tbls = getXmlElements(cell, "tbl");
        tbls.forEach(t => {
            if (t.parentNode) t.parentNode.removeChild(t);
        });

        const cleanText = text.replace(/<br\s*\/?>/gi, "\n");
        const lines = cleanText.split('\n');
        let i = 0;
        
        while (i < lines.length) {
            const line = lines[i].trim();
            
            if (line.startsWith('|')) {
                // Read all consecutive table lines
                const tableLines = [];
                while (i < lines.length && lines[i].trim().startsWith('|')) {
                    tableLines.push(lines[i].trim());
                    i++;
                }
                
                if (tableLines.length >= 2) {
                    const parsedTable = parseMdTable(tableLines);
                    if (parsedTable) {
                        cell.appendChild(createXmlTable(parsedTable, xmlDoc));
                        continue;
                    }
                }
                
                // Fallback: render as text if not a valid table
                tableLines.forEach(tl => {
                    cell.appendChild(createWp(tl, xmlDoc));
                });
            } else {
                if (line) {
                    const isCentered = line.includes('align="center"') || line.toLowerCase().includes('<center>');
                    const isBold = line.includes('<b>') || line.includes('<strong>') || line.startsWith('#') || line.startsWith('###');
                    const cleanLine = line.replace(/<[^>]*>/g, "").replace(/^#+\s*/, "").trim();
                    cell.appendChild(createWp(cleanLine, xmlDoc, isBold, isCentered));
                } else {
                    // Empty paragraph for spacing
                    cell.appendChild(createWp("", xmlDoc));
                }
                i++;
            }
        }

        // OpenXML standard requirement: Every table cell (<w:tc>) MUST end with a paragraph (<w:p>)
        if (cell.lastChild && cell.lastChild.nodeName !== "w:p") {
            cell.appendChild(createWp("", xmlDoc));
        }
    }

    function parseMdTable(lines) {
        const rowsData = [];
        // Filter out markdown separator line like |---|---|
        const filteredLines = lines.filter(l => !l.match(/^\|?\s*[-:| ]+\s*\|?$/));
        
        filteredLines.forEach(l => {
            const cells = l.split('|')
                .map(c => c.trim())
                .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (cells.length > 0 && !cells.every(c => c === '')) {
                rowsData.push(cells);
            }
        });
        
        if (rowsData.length === 0) return null;
        return rowsData;
    }

    function createXmlTable(rowsData, doc) {
        const tbl = doc.createElementNS(ns, "w:tbl");
        const tblPr = doc.createElementNS(ns, "w:tblPr");
        
        // Fit nested table to 100% of parent container cell width
        const tblW = doc.createElementNS(ns, "w:tblW");
        tblW.setAttribute("w:w", "5000");
        tblW.setAttribute("w:type", "pct");
        tblPr.appendChild(tblW);
        
        const tblBorders = doc.createElementNS(ns, "w:tblBorders");
        ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].forEach(borderName => {
            const border = doc.createElementNS(ns, "w:border");
            border.setAttribute("w:val", "single");
            border.setAttribute("w:sz", "4");
            border.setAttribute("w:space", "0");
            border.setAttribute("w:color", borderName.startsWith('inside') ? "E2E8F0" : "CCCCCC");
            tblBorders.appendChild(border);
        });
        tblPr.appendChild(tblBorders);
        tbl.appendChild(tblPr);
        
        rowsData.forEach((rowCells, rIdx) => {
            const tr = doc.createElementNS(ns, "w:tr");
            rowCells.forEach(cellText => {
                const tc = doc.createElementNS(ns, "w:tc");
                const tcPr = doc.createElementNS(ns, "w:tcPr");
                
                // Distribute column widths evenly in percentage (5000 = 100%)
                const tcW = doc.createElementNS(ns, "w:tcW");
                tcW.setAttribute("w:w", Math.floor(5000 / rowCells.length).toString());
                tcW.setAttribute("w:type", "pct");
                tcPr.appendChild(tcW);
                
                const tcMar = doc.createElementNS(ns, "w:tcMar");
                ['top', 'left', 'bottom', 'right'].forEach(side => {
                    const margin = doc.createElementNS(ns, `w:${side}`);
                    margin.setAttribute("w:w", "120");
                    margin.setAttribute("w:type", "dxa");
                    tcMar.appendChild(margin);
                });
                tcPr.appendChild(tcMar);
                tc.appendChild(tcPr);
                
                const isHeader = rIdx === 0;
                const cleanText = cellText.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?code>/gi, "");
                const lines = cleanText.split('\n');
                lines.forEach(line => {
                    tc.appendChild(createWp(line.trim(), doc, isHeader));
                });
                tr.appendChild(tc);
            });
            tbl.appendChild(tr);
        });
        return tbl;
    }
    
    function createWp(text, doc, isBold = false, isCentered = false) {
        const p = doc.createElementNS(ns, "w:p");
        const pPr = doc.createElementNS(ns, "w:pPr");
        const spacing = doc.createElementNS(ns, "w:spacing");
        spacing.setAttribute("w:line", "240");
        spacing.setAttribute("w:lineRule", "auto");
        pPr.appendChild(spacing);
        
        if (isCentered) {
            const jc = doc.createElementNS(ns, "w:jc");
            jc.setAttribute("w:val", "center");
            pPr.appendChild(jc);
        }
        
        const rPrP = doc.createElementNS(ns, "w:rPr");
        const rFontsP = doc.createElementNS(ns, "w:rFonts");
        rFontsP.setAttribute("w:ascii", "Times New Roman");
        rFontsP.setAttribute("w:hAnsi", "Times New Roman");
        rFontsP.setAttribute("w:eastAsia", "Times New Roman");
        rPrP.appendChild(rFontsP);
        
        const szP = doc.createElementNS(ns, "w:sz");
        szP.setAttribute("w:val", "22");
        rPrP.appendChild(szP);
        if (isBold) rPrP.appendChild(doc.createElementNS(ns, "w:b"));
        pPr.appendChild(rPrP);
        p.appendChild(pPr);
        
        if (text) {
            const r = doc.createElementNS(ns, "w:r");
            const rPr = doc.createElementNS(ns, "w:rPr");
            const rFonts = doc.createElementNS(ns, "w:rFonts");
            rFonts.setAttribute("w:ascii", "Times New Roman");
            rFonts.setAttribute("w:hAnsi", "Times New Roman");
            rPr.appendChild(rFonts);
            
            const sz = doc.createElementNS(ns, "w:sz");
            sz.setAttribute("w:val", "22");
            rPr.appendChild(sz);
            if (isBold) rPr.appendChild(doc.createElementNS(ns, "w:b"));
            r.appendChild(rPr);
            
            const t = doc.createElementNS(ns, "w:t");
            t.textContent = text;
            r.appendChild(t);
            p.appendChild(r);
        }
        return p;
    }

    // Dynamic duration calculations: Total = Uygulama + Etkinlik Sonu + Ölçme ve Değerlendirme
    const totalSure = parseInt(sure || data.sure || "40", 10) || 40;
    const evalSure = totalSure >= 60 ? 15 : (totalSure >= 40 ? 10 : 5);
    const sonuSure = totalSure >= 60 ? 10 : 5;
    const uygulamaSure = Math.max(0, totalSure - sonuSure - evalSure);

    // Fill standard cells
    fillCell(0, 1, data.etkinlikId || "ETK-01");
    fillCell(1, 1, data.baslik || "", true);
    fillCell(2, 1, data.genelBakis || "");
    fillCell(3, 1, `${totalSure} Dakika`);
    fillCell(4, 2, data.kademe || "");
    fillCell(5, 2, data.sinifSeviyesi || "");
    fillCell(6, 2, data.dersAdi || "");
    fillCell(7, 2, data.unite || "");
    fillCell(8, 2, data.konu || "");
    fillCell(9, 2, data.kazanimlar || "");
    fillCell(10, 2, data.donanim || "");
    fillCell(11, 2, data.cevrimIci || "");
    fillCell(12, 2, data.ogretimMateryalleri || "");
    
    // Etkinlik Alani: Fill with selected FCL zones instead of the AI description text
    const activeZones = selectedZones.length > 0 ? selectedZones : (data.etkinlikAlani ? [data.etkinlikAlani] : []);
    fillCell(13, 1, activeZones.join(", "));
    fillCell(13, 2, "");
    fillCell(13, 3, "");
    
    // Helper function to check if an option in checkbox format is selected
    function isOptionChecked(text, optionName, englishOptionName = "") {
        const normalized = (text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const opt = optionName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const engOpt = englishOptionName ? englishOptionName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

        if (!normalized.includes(opt) && (engOpt && !normalized.includes(engOpt))) {
            return false;
        }

        const hasCheckboxes = normalized.includes("☐") || normalized.includes("☒") || normalized.includes("☑") || normalized.includes("[ ]") || normalized.includes("[x]");
        if (!hasCheckboxes) {
            return true;
        }

        const optIdx = normalized.indexOf(opt) >= 0 ? normalized.indexOf(opt) : normalized.indexOf(engOpt);
        if (optIdx >= 0) {
            const sub = normalized.substring(Math.max(0, optIdx - 15), optIdx);
            const checkedMark = sub.includes("☒") || sub.includes("☑") || sub.includes("[x]") || sub.includes("[v]") || sub.includes("x ") || sub.includes("v ");
            const uncheckedMark = sub.includes("☐") || sub.includes("[ ]") || sub.includes("[]");
            
            if (checkedMark && uncheckedMark) {
                const lastChecked = Math.max(sub.lastIndexOf("☒"), sub.lastIndexOf("☑"), sub.lastIndexOf("[x]"), sub.lastIndexOf("[v]"));
                const lastUnchecked = Math.max(sub.lastIndexOf("☐"), sub.lastIndexOf("[ ]"), sub.lastIndexOf("[]"));
                return lastChecked > lastUnchecked;
            }
            if (checkedMark) return true;
            if (uncheckedMark) return false;
        }
        return true;
    }

    // Checkboxes for student layout
    const isBireysel = isOptionChecked(data.ogrencilerinKonumu, "Bireysel", "Individual") ? "☒ Bireysel" : "☐ Bireysel";
    const isGrup = isOptionChecked(data.ogrencilerinKonumu, "Küçük Gruplar", "Group") ? "☒ Küçük Gruplar" : "☐ Küçük Gruplar";
    const isSinif = isOptionChecked(data.ogrencilerinKonumu, "Tüm Sınıf", "Class") ? "☒ Tüm Sınıf" : "☐ Tüm Sınıf";
    fillCell(14, 1, isBireysel);
    fillCell(14, 2, isGrup);
    fillCell(14, 3, isSinif);
    
    // Checkboxes for teacher role
    const isLider = isOptionChecked(data.ogretmeninRolü, "Lider", "Leader") ? "☒ Lider" : "☐ Lider";
    const isRehber = isOptionChecked(data.ogretmeninRolü, "Rehber", "Guide") ? "☒ Rehber" : "☐ Rehber";
    const isGozlemci = isOptionChecked(data.ogretmeninRolü, "Gözlemci", "Observer") ? "☒ Gözlemci" : "☐ Gözlemci";
    fillCell(15, 1, isLider);
    fillCell(15, 2, isRehber);
    fillCell(15, 3, isGozlemci);

    // Fill process fields
    fillCell(16, 2, data.hazirlik || "");
    fillCell(17, 2, data.uygulama || "");
    fillCell(18, 2, data.etkinlikSonu || "");
    fillCell(19, 2, data.degerlendirme || "");
    fillCell(21, 1, data.kaynakca || "");
    // Split and separate MEB-KİT, 3B Design and standard appendices (Ek 1, Ek 2...) from data.ekler
    let rawEkler = data.ekler || "";
    let mebKitBlock = "";
    let printer3dBlock = "";
    const standardAppendices = [];
    const remainingSections = [];

    // Split by Markdown level 1-5 Headers or line starting with "Ek <digit>"
    const sections = rawEkler.split(/(?=^#{1,5}\s+|^Ek\s+\d+\b)/mi);

    sections.forEach(sec => {
        const secTrimmed = sec.trim();
        if (!secTrimmed) return;
        
        // Normalize Turkish characters and remove combining diacritics
        const normalized = secTrimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        
        if (normalized.includes("meb") && normalized.includes("kit")) {
            mebKitBlock = secTrimmed;
        } else if (normalized.includes("3b") || normalized.includes("3d")) {
            printer3dBlock = secTrimmed;
        } else if (/^ek\s+\d+\b/i.test(normalized)) {
            standardAppendices.push(secTrimmed);
        } else {
            remainingSections.push(secTrimmed);
        }
    });

    let mainEkler = remainingSections.join("\n\n").trim();
    
    // Build a nice summary list of all appendices for the main table cell
    const appendixItems = [];
    standardAppendices.forEach(app => {
        const lines = app.split('\n');
        const firstLine = lines[0].trim(); // e.g. "Ek 1"
        let title = "";
        
        const boldMatch = app.match(/<b>(.*?)<\/b>/i) || app.match(/<strong>(.*?)<\/strong>/i);
        if (boldMatch) {
            title = boldMatch[1].trim();
        } else {
            if (lines.length > 1) {
                title = lines[1].replace(/<[^>]*>/g, "").trim();
            }
        }
        
        if (title) {
            appendixItems.push(`${firstLine}: ${title}`);
        } else {
            appendixItems.push(firstLine);
        }
    });

    if (mebKitBlock) {
        appendixItems.push("MEB-KİT Uygulama Yönergesi");
    }
    if (printer3dBlock) {
        appendixItems.push("3B Tasarım Yönergesi");
    }

    if (appendixItems.length > 0) {
        mainEkler = "Etkinlikte kullanılan form, rubrik ve yönergeler ek sayfalarda sunulmuştur:\n" + 
                    appendixItems.map(item => `- ${item}`).join('\n');
    } else if (!mainEkler) {
        mainEkler = "Yönergeler ve formlar ek sayfalarda sunulmuştur.";
    }

    // Fill main Ekler cell
    fillCellWithMarkdown(22, 1, mainEkler);

    // Get body and sectPr for appending external pages
    const bodyList = xmlDoc.getElementsByTagNameNS(ns, "body");
    const body = bodyList.length > 0 ? bodyList[0] : xmlDoc.getElementsByTagName("body")[0] || table.parentNode;
    const sectPrs = body.getElementsByTagNameNS(ns, "sectPr");
    const sectPr = sectPrs.length > 0 ? sectPrs[0] : body.getElementsByTagName("sectPr")[0];

    function addPageBreak(doc, parentNode, beforeNode = null) {
        const p = doc.createElementNS(ns, "w:p");
        const r = doc.createElementNS(ns, "w:r");
        const br = doc.createElementNS(ns, "w:br");
        br.setAttribute("w:type", "page");
        r.appendChild(br);
        p.appendChild(r);
        if (beforeNode) {
            parentNode.insertBefore(p, beforeNode);
        } else {
            parentNode.appendChild(p);
        }
    }

    function appendMarkdownToNode(parentNode, text, beforeNode = null) {
        const cleanText = text.replace(/<br\s*\/?>/gi, "\n");
        const lines = cleanText.split('\n');
        let i = 0;
        
        const insertNode = (child) => {
            if (beforeNode) {
                parentNode.insertBefore(child, beforeNode);
            } else {
                parentNode.appendChild(child);
            }
        };

        while (i < lines.length) {
            const line = lines[i].trim();
            if (line.startsWith('|')) {
                const tableLines = [];
                while (i < lines.length && lines[i].trim().startsWith('|')) {
                    tableLines.push(lines[i].trim());
                    i++;
                }
                if (tableLines.length >= 2) {
                    const parsedTable = parseMdTable(tableLines);
                    if (parsedTable) {
                        insertNode(createXmlTable(parsedTable, xmlDoc));
                        continue;
                    }
                }
                tableLines.forEach(tl => {
                    insertNode(createWp(tl, xmlDoc));
                });
            } else {
                if (line) {
                    const isCentered = line.includes('align="center"') || line.toLowerCase().includes('<center>');
                    const isBold = line.includes('<b>') || line.includes('<strong>') || line.startsWith('#') || line.startsWith('###');
                    const cleanLine = line.replace(/<[^>]*>/g, "").replace(/^#+\s*/, "").trim();
                    insertNode(createWp(cleanLine, xmlDoc, isBold, isCentered));
                } else {
                    insertNode(createWp("", xmlDoc));
                }
                i++;
            }
        }
    }

    // Append standard appendices
    standardAppendices.forEach(app => {
        addPageBreak(xmlDoc, body, sectPr);
        appendMarkdownToNode(body, app, sectPr);
    });

    // Append MEB-KİT guideline
    if (mebKitBlock) {
        addPageBreak(xmlDoc, body, sectPr);
        appendMarkdownToNode(body, mebKitBlock, sectPr);
    }

    // Append 3B Printer guideline
    if (printer3dBlock) {
        addPageBreak(xmlDoc, body, sectPr);
        appendMarkdownToNode(body, printer3dBlock, sectPr);
    }

    // Replacements for minutes in row headers
    function replaceDurationInCellText(rowIdx, cellIdx, placeholder, replacement) {
        if (rowIdx >= rows.length) return;
        const cells = getXmlElements(rows[rowIdx], "tc");
        if (cellIdx >= cells.length) return;
        const cell = cells[cellIdx];
        const texts = getXmlElements(cell, "t");
        for (let i = 0; i < texts.length; i++) {
            if (texts[i].textContent.includes(placeholder)) {
                texts[i].textContent = texts[i].textContent.replace(placeholder, replacement);
            }
        }
    }

    // Apply exact mathematical duration replacements in Word table cell headers
    replaceDurationInCellText(16, 0, "(Süre: ... dk.)", "");
    replaceDurationInCellText(16, 0, "(... dk.)", "");
    replaceDurationInCellText(16, 0, "... dk.", "");
    replaceDurationInCellText(17, 1, "... dk.", `${uygulamaSure} dk.`);
    replaceDurationInCellText(18, 1, "... dk.", `${sonuSure} dk.`);
    replaceDurationInCellText(19, 0, "... dk.", `${evalSure} dk.`);
    replaceDurationInCellText(19, 1, "... dk.", `${evalSure} dk.`);

    const serializer = new XMLSerializer();
    const newXmlString = serializer.serializeToString(xmlDoc);
    zipFile.file("word/document.xml", newXmlString);
    // 4. Return as Blob with explicit DOCX MIME type
    return await zipFile.generateAsync({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
}

export async function downloadDocx(lastResponseText, renderedHtmlContent, defaultFilename = "Etkinlik_Plani.docx", options = {}) {
    try {
        const rawBlob = await generateDocxBlob(lastResponseText, renderedHtmlContent, options);
        // Explicitly enforce MIME type again
        const blob = new Blob([rawBlob], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        // Delay URL revocation to 60 seconds for iOS/Safari async download support
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            if (document.body.contains(a)) {
                document.body.removeChild(a);
            }
        }, 60000);
    } catch (e) {
        console.error(e);
        throw new Error("Word belgesi oluşturulurken bir hata oluştu: " + e.message);
    }
}
