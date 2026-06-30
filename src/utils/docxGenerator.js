// src/utils/docxGenerator.js
import JSZip from 'jszip';
import { parseGeneratedMarkdown } from './markdownParser';

export async function generateDocxBlob(lastResponseText, renderedHtmlContent, options = {}) {
    const { selectedZones = [], sure = "40" } = options;

    // 1. Fetch template from public folder
    const templateUrl = `${import.meta.env.BASE_URL}docx_template.docx`;
    const response = await fetch(templateUrl);
    if (!response.ok) {
        throw new Error("Word şablon dosyası (docx_template.docx) yüklenemedi. Lütfen public klasöründe olduğundan emin olun.");
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // 2. Parse the markdown or HTML to reconstruct dataset
    let lastResponse = lastResponseText || "";
    if (!lastResponse) {
        // Fallback: parse from rendered HTML
        lastResponse = "";
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderedHtmlContent;
        const rows = tempDiv.querySelectorAll("table tr");
        rows.forEach(tr => {
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
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");
    
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const tables = xmlDoc.getElementsByTagNameNS(ns, "tbl");
    if (tables.length === 0) throw new Error("Şablonda tablo bulunamadı.");
    
    const table = tables[0];
    const rows = table.getElementsByTagNameNS(ns, "tr");
    
    function fillCell(rowIdx, cellIdx, text, isBold = false) {
        if (rowIdx >= rows.length) return;
        const row = rows[rowIdx];
        const cells = row.getElementsByTagNameNS(ns, "tc");
        if (cellIdx >= cells.length) return;
        const cell = cells[cellIdx];
        
        // Remove existing paragraphs
        const paras = Array.from(cell.getElementsByTagNameNS(ns, "p"));
        paras.forEach(p => cell.removeChild(p));
        
        const cleanText = text.replace(/<br\s*\/?>/gi, "\n");
        const lines = cleanText.split('\n');
        lines.forEach(line => {
            cell.appendChild(createWp(line.trim(), xmlDoc, isBold));
        });
    }

    function fillCellWithMarkdown(rowIdx, cellIdx, text) {
        if (rowIdx >= rows.length) return;
        const row = rows[rowIdx];
        const cells = row.getElementsByTagNameNS(ns, "tc");
        if (cellIdx >= cells.length) return;
        const cell = cells[cellIdx];
        
        // Remove existing paragraphs and nested tables
        const paras = Array.from(cell.getElementsByTagNameNS(ns, "p"));
        paras.forEach(p => cell.removeChild(p));
        const tbls = Array.from(cell.getElementsByTagNameNS(ns, "tbl"));
        tbls.forEach(t => cell.removeChild(t));

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
                    const isHeading = line.startsWith('###') || line.startsWith('##') || line.startsWith('#');
                    const cleanLine = line.replace(/^#+\s*/, '');
                    cell.appendChild(createWp(cleanLine, xmlDoc, isHeading));
                } else {
                    // Empty paragraph for spacing
                    cell.appendChild(createWp("", xmlDoc));
                }
                i++;
            }
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
            if (cells.length > 0) {
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
        tblW.setAttributeNS(ns, "w:w", "5000");
        tblW.setAttributeNS(ns, "w:type", "pct");
        tblPr.appendChild(tblW);
        
        const tblBorders = doc.createElementNS(ns, "w:tblBorders");
        ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].forEach(borderName => {
            const border = doc.createElementNS(ns, "w:border");
            border.setAttributeNS(ns, "w:val", "single");
            border.setAttributeNS(ns, "w:sz", "4");
            border.setAttributeNS(ns, "w:space", "0");
            border.setAttributeNS(ns, "w:color", borderName.startsWith('inside') ? "E2E8F0" : "CCCCCC");
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
                tcW.setAttributeNS(ns, "w:w", Math.floor(5000 / rowCells.length).toString());
                tcW.setAttributeNS(ns, "w:type", "pct");
                tcPr.appendChild(tcW);
                
                const tcMar = doc.createElementNS(ns, "w:tcMar");
                ['top', 'left', 'bottom', 'right'].forEach(side => {
                    const margin = doc.createElementNS(ns, `w:${side}`);
                    margin.setAttributeNS(ns, "w:w", "120");
                    margin.setAttributeNS(ns, "w:type", "dxa");
                    tcMar.appendChild(margin);
                });
                tcPr.appendChild(tcMar);
                tc.appendChild(tcPr);
                
                const isHeader = rIdx === 0;
                tc.appendChild(createWp(cellText, doc, isHeader));
                tr.appendChild(tc);
            });
            tbl.appendChild(tr);
        });
        return tbl;
    }
    
    function createWp(text, doc, isBold = false) {
        const p = doc.createElementNS(ns, "w:p");
        const pPr = doc.createElementNS(ns, "w:pPr");
        const spacing = doc.createElementNS(ns, "w:spacing");
        spacing.setAttributeNS(ns, "w:line", "240");
        spacing.setAttributeNS(ns, "w:lineRule", "auto");
        pPr.appendChild(spacing);
        
        const rPrP = doc.createElementNS(ns, "w:rPr");
        const rFontsP = doc.createElementNS(ns, "w:rFonts");
        rFontsP.setAttributeNS(ns, "w:ascii", "Times New Roman");
        rFontsP.setAttributeNS(ns, "w:hAnsi", "Times New Roman");
        rFontsP.setAttributeNS(ns, "w:eastAsia", "Times New Roman");
        rPrP.appendChild(rFontsP);
        
        const szP = doc.createElementNS(ns, "w:sz");
        szP.setAttributeNS(ns, "w:val", "22");
        rPrP.appendChild(szP);
        if (isBold) rPrP.appendChild(doc.createElementNS(ns, "w:b"));
        pPr.appendChild(rPrP);
        p.appendChild(pPr);
        
        if (text) {
            const r = doc.createElementNS(ns, "w:r");
            const rPr = doc.createElementNS(ns, "w:rPr");
            const rFonts = doc.createElementNS(ns, "w:rFonts");
            rFonts.setAttributeNS(ns, "w:ascii", "Times New Roman");
            rFonts.setAttributeNS(ns, "w:hAnsi", "Times New Roman");
            rPr.appendChild(rFonts);
            
            const sz = doc.createElementNS(ns, "w:sz");
            sz.setAttributeNS(ns, "w:val", "22");
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

    // Dynamic duration calculations
    const totalSure = parseInt(sure || data.sure || "40", 10) || 40;
    const evalSure = 10;
    const guideSure = Math.max(0, totalSure - evalSure);
    const sonuSure = guideSure > 35 ? 10 : 5;
    const uygulamaSure = Math.max(0, guideSure - sonuSure);

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
    
    // Checkboxes for student layout (using standard Ballot boxes U+2612 ☒ and U+2610 ☐)
    const kon = (data.ogrencilerinKonumu || "").toLowerCase();
    const isBireysel = (kon.includes("bireysel") || kon.includes("individual")) ? "☒ Bireysel" : "☐ Bireysel";
    const isGrup = (kon.includes("grup") || kon.includes("ekip") || kon.includes("group") || kon.includes("team")) ? "☒ Küçük Gruplar" : "☐ Küçük Gruplar";
    const isSinif = (kon.includes("sınıf") || kon.includes("tüm") || kon.includes("class") || kon.includes("whole")) ? "☒ Tüm Sınıf" : "☐ Tüm Sınıf";
    fillCell(14, 1, isBireysel);
    fillCell(14, 2, isGrup);
    fillCell(14, 3, isSinif);
    
    // Checkboxes for teacher role
    const rol = (data.ogretmeninRolü || "").toLowerCase();
    const isLider = (rol.includes("lider") || rol.includes("leader")) ? "☒ Lider" : "☐ Lider";
    const isRehber = (rol.includes("rehber") || rol.includes("guide") || rol.includes("facilitator")) ? "☒ Rehber" : "☐ Rehber";
    const isGozlemci = (rol.includes("gözlemci") || rol.includes("gozlemci") || rol.includes("observer")) ? "☒ Gözlemci" : "☐ Gözlemci";
    fillCell(15, 1, isLider);
    fillCell(15, 2, isRehber);
    fillCell(15, 3, isGozlemci);

    // Fill process fields
    fillCell(16, 2, data.hazirlik || "");
    fillCell(17, 2, data.uygulama || "");
    fillCell(18, 2, data.etkinlikSonu || "");
    fillCell(19, 2, data.degerlendirme || "");
    fillCell(21, 1, data.kaynakca || "");
    fillCellWithMarkdown(22, 1, data.ekler || "");

    // Replacements for minutes in row headers
    function replaceDurationInCellText(rowIdx, cellIdx, placeholder, replacement) {
        if (rowIdx >= rows.length) return;
        const cells = rows[rowIdx].getElementsByTagNameNS(ns, "tc");
        if (cellIdx >= cells.length) return;
        const cell = cells[cellIdx];
        const texts = cell.getElementsByTagNameNS(ns, "t");
        for (let i = 0; i < texts.length; i++) {
            if (texts[i].textContent.includes(placeholder)) {
                texts[i].textContent = texts[i].textContent.replace(placeholder, replacement);
            }
        }
    }

    // Apply exact mathematical duration replacements in Word table cell headers
    replaceDurationInCellText(16, 0, "... dk.", `${guideSure} dk.`);
    replaceDurationInCellText(17, 1, "... dk.", `${uygulamaSure} dk.`);
    replaceDurationInCellText(18, 1, "... dk.", `${sonuSure} dk.`);
    replaceDurationInCellText(19, 0, "... dk.", `${evalSure} dk.`);
    replaceDurationInCellText(19, 1, "... dk.", `${evalSure} dk.`);

    const serializer = new XMLSerializer();
    const newXmlString = serializer.serializeToString(xmlDoc);
    zipFile.file("word/document.xml", newXmlString);
    
    // 4. Return as Blob
    return await zipFile.generateAsync({ type: "blob" });
}

export async function downloadDocx(lastResponseText, renderedHtmlContent, defaultFilename = "Etkinlik_Plani.docx", options = {}) {
    try {
        const blob = await generateDocxBlob(lastResponseText, renderedHtmlContent, options);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (e) {
        console.error(e);
        throw new Error("Word belgesi oluşturulurken bir hata oluştu: " + e.message);
    }
}
