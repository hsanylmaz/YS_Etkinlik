import React, { useState, useEffect } from 'react';
import { Settings, FolderOpen, RefreshCw, X, CheckCircle, AlertTriangle, Cloud } from 'lucide-react';
import InputForm from './components/InputForm';
import ResultPanel from './components/ResultPanel';
import FloorPlanCanvas from './components/FloorPlanCanvas';
import SettingsModal from './components/SettingsModal';
import SavedScenariosModal from './components/SavedScenariosModal';

import { callGeminiText } from './utils/geminiApi';
import { formatMarkdown, parseGeneratedMarkdown } from './utils/markdownParser';
import { downloadDocx, generateDocxBlob } from './utils/docxGenerator';
import { uploadToGoogleDrive, deleteFromGoogleDrive, getNextFileNumber, incrementLocalCounter } from './utils/driveIntegration';

const LOCAL_STORAGE_KEY = 'fcl_saved_scenarios_v1';
const API_KEY_STORAGE_KEY = 'fcl_gemini_api_key_v1';
const UPLOADS_STORAGE_KEY = 'fcl_my_uploads_v1';

export default function App() {
  // Settings & Storage States
  const [apiKey, setApiKey] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSavedOpen, setIsSavedOpen] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState([]);
  
  // Form States
  const [belgeTuru, setBelgeTuru] = useState('etkinlikPlani');
  const [ders, setDers] = useState('');
  const [sinif, setSinif] = useState('5');
  const [teknik, setTeknik] = useState('auto');
  const [sure, setSure] = useState('40');
  const [yapayZekaAraclari, setYapayZekaAraclari] = useState('');
  const [belgeDili, setBelgeDili] = useState('tr');
  const [kazanim, setKazanim] = useState('');
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState(['İletişim', 'İş Birliği', 'Eleştirel Düşünme', 'Yaratıcılık']);
  const [useMebKit, setUseMebKit] = useState(false);
  const [use3DPrinter, setUse3DPrinter] = useState(false);
  const [suggestedLayout, setSuggestedLayout] = useState(null);
  const [kazanimlarDb, setKazanimlarDb] = useState(null);
  const [selectedSurec, setSelectedSurec] = useState([]);
  
  // Output & Loading States
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponseText, setLastResponseText] = useState('');
  const [renderedHtml, setRenderedHtml] = useState('');
  const [showLayout, setShowLayout] = useState(false);
  const [driveStatus, setDriveStatus] = useState('idle'); // 'idle', 'uploading', 'uploaded', 'deleting'
  
  // Toast state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [loadingStep, setLoadingStep] = useState(1);

  // Load configuration from localStorage
  useEffect(() => {
    const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY) || '';
    setApiKey(storedKey);

    const storedScenarios = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    setSavedScenarios(storedScenarios);
  }, []);

  // Fetch curriculum outcomes database on load
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}kazanimlar.json?v=${Date.now()}`)
      .then(res => res.json())
      .then(data => setKazanimlarDb(data))
      .catch(err => console.error("Kazanımlar veritabanı yüklenemedi:", err));
  }, []);

  // Trigger MathJax typesetting when renderedHtml changes
  useEffect(() => {
    if (renderedHtml && window.MathJax) {
      setTimeout(() => {
        const resCont = document.getElementById('resultContent');
        if (resCont) {
          window.MathJax.typesetPromise([resCont]).catch((err) => console.log("MathJax error:", err.message));
        }
      }, 300);
    }
  }, [renderedHtml]);

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Save API key
  const handleSaveApiKey = (newKey) => {
    setApiKey(newKey);
    localStorage.setItem(API_KEY_STORAGE_KEY, newKey);
    showToast("Ayarlar başarıyla kaydedildi.", "success");
  };



  // Toggle layout plan view
  const handleDrawLayout = () => {
    setShowLayout(true);
    setTimeout(() => {
      const layoutSec = document.getElementById('layoutSection');
      if (layoutSec) {
        layoutSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Re-evaluate save to drive button state based on current output content
  const getCurrentScenarioKey = (scText) => {
    const markdown = scText || lastResponseText || "";
    const data = parseGeneratedMarkdown(markdown);
    
    const dName = data.dersAdi || ders || "BilinmeyenDers";
    const sLevel = data.sinifSeviyesi || sinif || "BilinmeyenSinif";
    const bType = belgeTuru || "etkinlikPlani";
    const kName = data.kazanimlar || kazanim || "";
    
    return `${dName}_${sLevel}_${bType}_${kName.substring(0, 30)}`.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]+/g, '_');
  };

  const getDriveStatusForCurrent = () => {
    const key = getCurrentScenarioKey();
    const uploads = JSON.parse(localStorage.getItem(UPLOADS_STORAGE_KEY) || '{}');
    return uploads[key] ? 'uploaded' : 'idle';
  };

  useEffect(() => {
    if (renderedHtml) {
      setDriveStatus(getDriveStatusForCurrent());
    }
  }, [renderedHtml, lastResponseText]);

  // Form Submit (AI Content Generation)
  const handleSubmit = async () => {
    if (!apiKey) {
      showToast("Lütfen sağ üstteki API Ayarları menüsünden geçerli bir Gemini API Anahtarı girin.", "error");
      setIsSettingsOpen(true);
      return;
    }

    if (!ders || !kazanim || !sure) {
      showToast("Lütfen ders adı, etkinlik süresi ve kazanım alanlarını doldurun.", "error");
      return;
    }

    const tableKazanimText = selectedSurec.length > 0 
      ? `${kazanim}<br><br><b>Süreç Bileşenleri:</b><br>- ${selectedSurec.join('<br>- ')}` 
      : kazanim;

    const plainKazanimText = selectedSurec.length > 0
      ? `${kazanim}\n\nSüreç Bileşenleri:\n- ${selectedSurec.join('\n- ')}`
      : kazanim;

    const sureNum = parseInt(sure);
    if (isNaN(sureNum) || sureNum > 80 || sureNum <= 0) {
      showToast("Etkinlik süresi en fazla 80 dakika ve sıfardan büyük olmalıdır!", "error");
      return;
    }

    if (selectedZones.length === 0) {
      showToast("Lütfen en az bir öğrenme alanı seçin.", "error");
      return;
    }

    if (selectedSkills.length === 0) {
      showToast("Lütfen en az bir 4C Becerisi seçin.", "error");
      return;
    }

    setIsLoading(true);
    setShowLayout(false);
    setRenderedHtml('');
    setLastResponseText('');
    setLoadingStep(1);

    const stepTimeouts = [];
    const targetLangName = 
      belgeDili === 'en' ? 'English' :
      belgeDili === 'de' ? 'German' :
      belgeDili === 'fr' ? 'French' :
      belgeDili === 'ar' ? 'Arabic' : 'Türkçe';

    try {
      const scheduleStep = (step, delay) => {
        const t = setTimeout(() => {
          setLoadingStep(step);
        }, delay);
        stepTimeouts.push(t);
      };

      scheduleStep(2, 3500);  // Step 2: Pedagoji Seçimi (3.5s)
      scheduleStep(3, 7500);  // Step 3: Süre & Aşama Hesabı (7.5s)
      scheduleStep(4, 12000); // Step 4: Değerlendirme Tasarımı (12s)
      scheduleStep(5, 17000); // Step 5: Kaynakça & Şablonlama (17s)

      // Smooth scroll to loading card
      setTimeout(() => {
        const loadCard = document.getElementById('loadingSection');
        if (loadCard) {
          loadCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

    const sinifNum = parseInt(sinif);
    const kademeText = (sinifNum >= 5 && sinifNum <= 8) ? "Temel Eğitim" : "Ortaöğretim";
    let ekipmanlar = ["Etkileşimli Tahta", "8 Adet Tümleşik Bilgisayar", "12 Adet Dizüstü Bilgisayar", "Simülasyon Platformu", "Zekâ Oyunları Seti"];
    if (useMebKit) {
      ekipmanlar.push("10 Adet MEB-KİT", "3 Adet Mobil Robot Platform Kiti");
    }
    if (use3DPrinter) {
      ekipmanlar.push("3B Yazıcı");
    }
    const sinifEkipmanlari = ekipmanlar.join(", ");

    let mobilyalar = ["Tekerlekli Öğrenci Masaları", "Öğrenci Sandalyeleri", "Öğrenci Tabureleri", "Tekerlekli Puf", "Öğretmen Kürsüsü", "Laptop Şarj İstasyonu", "Sabit Bilgisayar Masaları", "2 Adet Duvara Sabit Katlanır Masa", "Magnet Panosu"];
    if (useMebKit) {
      mobilyalar.push("Robotik Kodlama Masası");
    }
    if (use3DPrinter) {
      mobilyalar.push("3 Boyutlu Yazıcı Masası ve Dolabı");
    }
    const sinifMobilyalari = mobilyalar.join(", ");

    let teknikPromptText = teknik === 'auto' 
      ? "Aktif Öğrenme Tekniği: (Yapay Zeka tarafından kılavuzda yer alan İş Birlikli, Probleme Dayalı, Sorgulamaya Dayalı, Yapılandırmacı, Tasarıma Dayalı, Oyun Temelli, Proje Tabanlı pedagojilerden en uygunu seçilmelidir)" 
      : `Aktif Öğrenme Tekniği (Pedagojik Yaklaşım): ${teknik}`;

    let teknikFormatText = teknik === 'auto' ? "Seçilen Öğrenme Yaklaşımı" : teknik;
        
    let mobilyaPromptText = `Fiziksel Ortam, Mobilya ve Teknoloji: Yapay Zeka, SADECE şu donanımları seçip yerleştirmelidir:\nMobilyalar: ${sinifMobilyalari}\nTeknolojiler: ${sinifEkipmanlari}\nÖNEMLİ: Sınıftaki 2 katlanır masa duvara sabittir. Grup, istasyon çalışmalarında esneklik için mutlaka 'Tekerlekli Öğrenci Masalarını' birleştirerek kullandır.`;

    let yzAracInstruction = yapayZekaAraclari
      ? `KULLANILACAK ARAÇLAR: Öğretmen bu senaryoda SADECE şu yapay zeka veya Web 2.0 araçlarını kullanmak istiyor: "${yapayZekaAraclari}". Lütfen senaryonun tüm adımlarını (özellikle Çevrim İçi Araçlar bölümünü) YALNIZCA bu araçlar üzerine kurgula, kesinlikle farklı bir dijital araç ekleme.`
      : `KULLANILACAK ARAÇLAR: MEB kılavuzlarına ve pedagojik yaklaşıma uygun, güncel ve etkili yapay zeka (AI) ve Web 2.0 araçlarını (örneğin ChatGPT, Canva, Padlet vb. arasından en uygunlarını) sen seçip senaryoya mantıklı bir şekilde entegre et.`;

    const selected4CText = selectedSkills.join(', ');

    // Localization maps
    let roleInstruction = "";
    let formatInstruction = "";
    let kaynakcaInstruction = "";
    let mufredatKurali = "";
    let pedagojikKurallar = "";
    let webAraclariKategorileri = "";
    let ekYonergeKurali = "";
    let altBaslik = "";

    if (belgeDili === 'en') {
      altBaslik = belgeTuru === "etkinlikPlani" ? "TECHNOLOGY SUPPORTED ACTIVE LEARNING LESSON PLAN" : "TECHNOLOGY FOCUSED LEARNING SCENARIO";
      roleInstruction = `You are a pedagogy expert AI assistant specialized in designing Technology-Supported Active Learning Lesson Plans in accordance with modern curriculum standards. You must write the entire output in English.`;
      
      kaynakcaInstruction = `
IMPORTANT - BIBLIOGRAPHY GUIDELINES:
The Bibliography section MUST be written according to the "Innovative Classroom Bibliography Writing Guide":
- Do NOT use bullet points, dashes (-), numbering or indentation. Write as plain text.
- Sort the references alphabetically, do NOT divide into categories.
- Add <br><br> at the end of each reference entry.
- For Books: Author Last Name, A. (Year). Book title. Publisher.
- For Curriculum: Ministry of National Education. (2024). [Subject] curriculum. Board of Education. Retrieved 10 May 2026 URL
- For Online Tools: Platform Name. (n.d.). Content title. Retrieved 10 May 2026 URL
`;
      mufredatKurali = `
CURRICULUM RULE:
Ensure "Unit/Theme/Learning Area" and "Subject/Content Framework" matches the Course Name (${ders}), Grade Level (${sinif}) and Objectives (${plainKazanimText}). Do not invent them; make sure they correspond to actual curriculum frameworks.
`;
      pedagojikKurallar = `
PEDAGOGICAL & METHODOLOGICAL RULES:
1. Roles: Students are active researchers, teacher is a facilitator. Eliminate passive lecturing.
2. 4C Skills: Emphasize how students demonstrate Communication, Collaboration, Critical Thinking, and Creativity (${selected4CText}).
3. Technology: Align technology tools with active production and coding.
`;
      webAraclariKategorileri = `
RECOMMENDED WEB 2.0 / AI TOOLS:
- Research/Information: Perplexity, Google Scholar, EBA
- Collaboration: Padlet, Mentimeter, Miro
- Coding/Modeling: MEB-KİT Simulator, Tinkercad, Scratch
- Media/Design: Canva, CapCut, Adobe Express
- Interaction: Genially, Prezi, Kahoot
`;
      ekYonergeKurali = `
APPLICATION GUIDELINE RULE:
If "MEB-KİT", "3D Printer" or any advanced tool is used, add a detailed "Application Guideline" table under the APPENDICES section.
`;

      if (belgeTuru === "etkinlikPlani") {
        formatInstruction = `
Format Rule: Output MUST be in the exact markdown table format below. Do not add any text before or after the table.

| General Information | Descriptions |
|---|---|
| **Activity ID** | (Assign an ID like ACT-01) |
| **Activity Title** | (Creative Title - ALL CAPS) |
| **Overview** | (General summary and purpose of the activity) |
| **Activity Duration** | ${sure} Minutes |
| **Level** | ${kademeText} |
| **Grade Level** | Grade ${sinif} |
| **Course Name** | ${ders} |
| **Unit/Theme/Learning Area** | (Identify from the curriculum) |
| **Subject/Content Framework** | (Curriculum framework matching the objective) |
| **Learning Outcomes / Objectives** | ${tableKazanimText} |
| **Hardware / Equipment** | ${sinifEkipmanlari} |
| **Online Tools & Content** | (No student devices! Only tools operated by the teacher on interactive board) |
| **Teaching Materials** | (Special handouts, scissors, etc. for this activity) |
| **Learning Area (Classroom Layout)** | (Explain how you stretch the classroom layout using Esnek Öğrenme Alanları - ${selectedZones.join(', ')} - and mobile desks) |
| **Students' Placement** | Individual / Small Groups / Whole Class (Specify names) |
| **Teacher's Role** | Leader / Facilitator / Observer (Specify names) |
| **Preparation** | (Pre-activity preparation for teacher and students) |
| **Implementation (Duration: ... min.)** | (Steps matching selected areas - ${selectedZones.join(', ')} - and active learning pedagogy. Total duration must be ${sure} minutes.) |
| **Closure (Duration: ... min.)** | (Wrapping up, gathering feedback, and general review) |
| **Assessment & Evaluation** | (Assessment methods matching the objectives) |
| **References** | (Bibliography) |
| **Appendices** | Assessment forms and instructions are presented below. |

<br>

### APPENDICES
(Write assessment forms, rubrics, and instructions outside the table, as separate markdown tables.)
`;
      } else {
        formatInstruction = `
Format Rule: Output MUST be in the exact markdown tables format below. Do not add any text before or after the tables.

| General Information | Descriptions |
|---|---|
| **Scenario ID** | (Assign an ID) |
| **Scenario Name** | (Creative Title - ALL CAPS) |
| **Course/Level/Duration** | ${ders} / ${kademeText} / ${sure} Minutes |

| Planning | Descriptions |
|---|---|
| **Overview** | (General summary of the scenario) |
| **Learning Outcomes / Objectives** | (Bullet points) |
| **Related Curriculum Objectives** | ${tableKazanimText} |
| **Skills** | (Highlight 4C skills: ${selected4CText}) |

| Preparation | Descriptions |
|---|---|
| **Learning Approach** | ${teknikFormatText} |
| **Tasks** | Teacher: ... <br><br> Student: ... |
| **Tools & Technologies** | (No student devices!) |
| **Teaching Materials** | (Special handouts, scissors, etc. for this activity) |

| Implementation | Descriptions |
|---|---|
| **Learning Activities** | (Steps matching selected areas - ${selectedZones.join(', ')} - and active learning pedagogy. Total duration must be ${sure} minutes. Append (Related Skills: ${selected4CText}) to each step.) |

| Evaluation | Descriptions |
|---|---|
| **Assessment Methods / Tools** | (Methods matching the objectives) |

| Reference | Descriptions |
|---|---|
| **Related Links** | (Websites) |
| **References** | (Bibliography) |
| **Appendices** | Assessment forms and instructions are presented below. |

<br>

### APPENDICES
(Write assessment forms, rubrics, and instructions outside the tables, as separate markdown tables.)
`;
      }
    } else if (belgeDili === 'de') {
      altBaslik = belgeTuru === "etkinlikPlani" ? "TECHNOLOGIEGESTÜTZTER LEHRPLAN FÜR AKTIVES LERNEN" : "TECHNOLOGIEORIENTIERTES LERNSZENARIO";
      roleInstruction = `Sie sind ein KI-Assistent für Pädagogik, der auf den Entwurf von technologiegestützten Unterrichtsplänen für aktives Lernen spezialisiert ist. Sie müssen die Ausgabe vollständig auf Deutsch verfassen.`;
      
      kaynakcaInstruction = `
WICHTIG - LITERATURVERZEICHNIS-RICHTLINIEN:
Der Literaturverzeichnis-Bereich MUSS gemäß den Richtlinien verfasst werden:
- KEINE Aufzählungspunkte, Bindestriche (-), Nummerierungen oder Einrückungen verwenden. Als einfachen Text schreiben.
- Die Referenzen alphabetisch sortieren, NICHT in Kategorien unterteilen.
- Am Ende jedes Eintrags <br><br> hinzufügen.
- Bücher: Nachname, A. (Jahr). Buchtitel. Verlag.
`;
      mufredatKurali = `
LEHRPLANREGEL:
Stellen Sie sicher, dass die Abschnitte "Einheit/Thema/Lernbereich" und "Inhaltsrahmen" zum Fach (${ders}), der Klassenstufe (${sinif}) und den Lernzielen (${plainKazanimText}) passen. Erfinden Sie diese nicht frei, sondern nutzen Sie reale Lehrplanstrukturen.
`;
      pedagojikKurallar = `
PÄDAGOGISCHE REGELN:
1. Rollen: Schüler sind aktive Forscher, der Lehrer ist Begleiter. Vermeiden Sie Frontalunterricht.
2. 4C-Fähigkeiten: Betonen Sie, wie Schüler Kommunikation, Kollaboration, kritisches Denken und Kreativität (${selected4CText}) demonstrieren.
3. Technologie: Richten Sie technologische Werkzeuge an aktiver Produktion und Programmierung aus.
`;
      webAraclariKategorileri = `
EMPFOHLENE WEB 2.0 / KI-TOOLS:
- Recherche: Perplexity, Google Scholar, EBA
- Kollaboration: Padlet, Mentimeter, Miro
- Programmierung/Modellierung: MEB-KİT Simulator, Tinkercad, Scratch
- Medien/Design: Canva, CapCut, Adobe Express
- Interaktion: Genially, Prezi, Kahoot
`;
      ekYonergeKurali = `
RICHTLINIE FÜR ANWENDUNGEN:
Wenn "MEB-KİT", "3D-Drucker" oder ein fortgeschrittenes Tool verwendet wird, fügen Sie eine detaillierte "Anwendungsrichtlinie" als Tabelle im Abschnitt ANHÄNGE hinzu.
`;

      if (belgeTuru === "etkinlikPlani") {
        formatInstruction = `
Formatregel: Die Ausgabe MUSS im exakten Markdown-Tabellenformat unten erfolgen. Fügen Sie keinen Text vor oder nach der Tabelle hinzu.

| Allgemeine Informationen | Beschreibungen |
|---|---|
| **Aktivitäts-ID** | (Zuweisen einer ID wie AKT-01) |
| **Aktivitätstitel** | (Kreativer Titel - NUR GROSSBUCHSTABEN) |
| **Überblick** | (Allgemeiner Zweck und Zusammenfassung) |
| **Aktivitätsdauer** | ${sure} Minuten |
| **Stufe** | ${kademeText} |
| **Klassenstufe** | Klasse ${sinif} |
| **Fachname** | ${ders} |
| **Einheit/Thema/Lernbereich** | (Aus dem Lehrplan ermitteln) |
| **Thema/Inhaltsrahmen** | (Passender Inhaltsrahmen zum Lernziel) |
| **Lernergebnisse / Ziele** | ${tableKazanimText} |
| **Ausstattung / Hardware** | ${sinifEkipmanlari} |
| **Online-Tools und Inhalte** | (Keine Schülergeräte! Nur Tools, die der Lehrer am Board nutzt) |
| **Lehrmaterialien** | (Arbeitsblätter, Schere usw. für diese Aktivität) |
| **Lernbereich (Klassenzimmer-Layout)** | (Erklären Sie die Raumgestaltung mit den Lernbereichen - ${selectedZones.join(', ')} - und mobilen Tischen) |
| **Schülerposition** | Einzelarbeit / Kleingruppen / Ganze Klasse (Namen angeben) |
| **Rolle des Lehrers** | Leiter / Begleiter / Beobachter (Namen angeben) |
| **Vorbereitung** | (Vorbereitung für Lehrer und Schüler vor Beginn) |
| **Durchführung (Dauer: ... Min.)** | (Schritte passend zu den ausgewählten Lernbereichen - ${selectedZones.join(', ')} - und Methoden. Gesamtdauer muss ${sure} Minuten betragen.) |
| **Abschluss (Dauer: ... Min.)** | (Zusammenfassung, Feedback und allgemeine Überprüfung) |
| **Bewertung und Evaluation** | (Bewertungsmethoden passend zum Lernziel) |
| **Literatur** | (Literaturverzeichnis) |
| **Anhänge** | Formulare und Richtlinien sind unten aufgeführt. |

<br>

### ANHÄNGE
(Formulare, Rubriken und Anleitungen als separate Markdown-Tabellen unten einfügen.)
`;
      } else {
        formatInstruction = `
Formatregel: Die Ausgabe MUSS im exakten Markdown-Tabellenformat unten erfolgen. Fügen Sie keinen Text vor oder nach der Tabelle hinzu.

| Allgemeine Informationen | Beschreibungen |
|---|---|
| **Szenario-ID** | (Zuweisen einer ID) |
| **Szenario-Name** | (Kreativer Titel - NUR GROSSBUCHSTABEN) |
| **Fach/Stufe/Dauer** | ${ders} / ${kademeText} / ${sure} Minuten |

| Planung | Beschreibungen |
|---|---|
| **Überblick** | (Zusammenfassung des Szenarios) |
| **Lernergebnisse / Ziele** | (Aufzählungspunkte) |
| **Relevante Lehrplanziele** | ${tableKazanimText} |
| **Fertigkeiten** | (4C-Fähigkeiten hervorheben: ${selected4CText}) |

| Vorbereitung | Beschreibungen |
|---|---|
| **Lernansatz** | ${teknikFormatText} |
| **Aufgaben** | Lehrer: ... <br><br> Schüler: ... |
| **Tools & Technologien** | (Keine Schülergeräte!) |
| **Lehrmaterialien** | (Spezifische Materialien für diese Aktivität) |

| Durchführung | Beschreibungen |
|---|---|
| **Lernaktivitäten** | (Schritte passend zu den ausgewählten Lernbereichen - ${selectedZones.join(', ')} - und Methoden. Gesamtdauer muss ${sure} Minuten betragen. Hängen Sie (Relevante Fertigkeiten: ${selected4CText}) an jeden Schritt an.) |

| Bewertung | Beschreibungen |
|---|---|
| **Bewertungsmethoden / Werkzeuge** | (Methoden passend zu den Lernzielen) |

| Referenz | Beschreibungen |
|---|---|
| **Verwandte Links** | (Websites) |
| **Literatur** | (Literaturverzeichnis) |
| **Anhänge** | Formulare, Rubriken und Richtlinien sind unten aufgeführt. |

<br>

### ANHÄNGE
(Formulare, Rubriken und Anleitungen als separate Markdown-Tabellen unten einfügen.)
`;
      }
    } else if (belgeDili === 'fr') {
      altBaslik = belgeTuru === "etkinlikPlani" ? "PLAN DE COURS D'APPRENTISSAGE ACTIF AVEC TECHNOLOGIE" : "SCÉNARIO D'APPRENTISSAGE ORIENTÉ TECHNOLOGIE";
      roleInstruction = `Vous êtes un assistant IA expert en pédagogie, spécialisé dans la conception de plans de cours d'apprentissage actif soutenus par la technologie. Vous devez écrire l'intégralité de la sortie en français.`;
      
      kaynakcaInstruction = `
IMPORTANT - DIRECTIVES POUR LA BIBLIOGRAPHIE:
La section Bibliographie DOIT respecter les règles suivantes:
- NE PAS utiliser de puces, de tirets (-), de numérotation ou d'indentation. Écrire en texte brut.
- Trier les références par ordre alphabétique, NE PAS diviser par catégories.
- Ajouter <br><br> à la fin de chaque entrée.
- Livres: Nom de famille de l'auteur, A. (Année). Titre du livre. Éditeur.
`;
      mufredatKurali = `
RÈGLE DU PROGRAMME:
Assurez-vous que les sections "Unité/Thème/Domaine d'apprentissage" et "Sujet/Cadre de contenu" correspondent au nom du cours (${ders}), au niveau de classe (${sinif}) et aux objectifs (${plainKazanimText}). Ne les inventez pas; assurez-vous qu'ils correspondent aux cadres de programme réels.
`;
      pedagojikKurallar = `
RÈGLES PÉDAGOGIQUES:
1. Rôles: Les élèves sont des chercheurs actifs, l'enseignant est un facilitateur. Pas de cours magistral passif.
2. Compétences 4C: Soulignez comment les élèves démontrent la communication, la collaboration, la pensée critique et la créativité (${selected4CText}).
3. Technologie: Orientez les outils technologiques vers la production active et le codage.
`;
      webAraclariKategorileri = `
OUTILS WEB 2.0 / IA RECOMMANDÉS:
- Recherche: Perplexity, Google Scholar, EBA
- Collaboration: Padlet, Mentimeter, Miro
- Codage/Modélisation: Simulateur MEB-KİT, Tinkercad, Scratch
- Médias/Design: Canva, CapCut, Adobe Express
- Interaction: Genially, Prezi, Kahoot
`;
      ekYonergeKurali = `
GUIDE D'APPLICATION:
Si "MEB-KİT", "Imprimante 3D" ou un outil avancé est utilisé, ajoutez un tableau détaillé de "Directives d'application" dans la section ANNEXES.
`;

      if (belgeTuru === "etkinlikPlani") {
        formatInstruction = `
Règle de format: La sortie DOIT être dans le format exact du tableau Markdown ci-dessous. N'ajoutez aucun texte avant ou après le tableau.

| Informations Générales | Descriptions |
|---|---|
| **ID de l'activité** | (Attribuer un ID comme ACT-01) |
| **Titre de l'activité** | (Titre créatif - EN MAJUSCULES) |
| **Aperçu** | (Résumé et objectif de l'activité) |
| **Durée de l'activité** | ${sure} Minutes |
| **Niveau** | ${kademeText} |
| **Niveau de classe** | Classe de ${sinif} |
| **Nom du cours** | ${ders} |
| **Unité/Thème/Domaine d'apprentissage** | (Identifier dans le programme) |
| **Sujet/Cadre de contenu** | (Cadre correspondant à l'objectif) |
| **Résultats d'apprentissage / Objectifs** | ${tableKazanimText} |
| **Matériel / Équipement** | ${sinifEkipmanlari} |
| **Outils et contenus en ligne** | (Pas d'appareils élèves! Uniquement outils gérés par l'enseignant) |
| **Matériel didactique** | (Fiches de travail, ciseaux, etc. pour cette activité) |
| **Zone d'activité (Disposition)** | (Expliquer l'adaptation de l'espace avec les zones - ${selectedZones.join(', ')} - et tables mobiles) |
| **Position des élèves** | Individuel / Petits groupes / Classe entière |
| **Rôle de l'enseignant** | Leader / Animateur / Observateur |
| **Préparation** | (Préparation de l'enseignant et des élèves) |
| **Mise en œuvre (Durée : ... min)** | (Étapes selon les zones choisies - ${selectedZones.join(', ')} - et la pédagogie. Total doit faire ${sure} minutes.) |
| **Fin de l'activité (Durée : ... min)** | (Synthèse, retours et bilan) |
| **Évaluation et examen** | (Méthodes d'évaluation correspondant aux objectifs) |
| **Bibliographie** | (Références bibliographiques) |
| **Annexes** | Les formulaires et guides sont présentés ci-dessous. |

<br>

### ANNEXES
(Formulaires, rubriques et instructions sous forme de tableaux Markdown séparés ci-dessous.)
`;
      } else {
        formatInstruction = `
Règle de format: La sortie DOIT être dans le format exact du tableau Markdown ci-dessous. N'ajoutez aucun texte avant ou après le tableau.

| Informations Générales | Descriptions |
|---|---|
| **ID du scénario** | (Attribuer un ID) |
| **Nom du scénario** | (Titre créatif - EN MAJUSCULES) |
| **Cours/Niveau/Durée** | ${ders} / ${kademeText} / ${sure} Minutes |

| Planification | Descriptions |
|---|---|
| **Aperçu** | (Résumé du scénario) |
| **Résultats d'apprentissage / Objectifs** | (Puces) |
| **Objectifs du programme associés** | ${tableKazanimText} |
| **Compétences** | (Mettre en valeur les compétences 4C: ${selected4CText}) |

| Préparation | Descriptions |
|---|---|
| **Approche d'apprentissage** | ${teknikFormatText} |
| **Tâches** | Enseignant: ... <br><br> Élève: ... |
| **Outils & Technologies** | (Pas d'appareils élèves!) |
| **Matériel didactique** | (Fiches de travail spécifiques, etc.) |

| Mise en œuvre | Descriptions |
|---|---|
| **Activités d'apprentissage** | (Étapes selon les zones choisies - ${selectedZones.join(', ')} - et la pédagogie. Total doit faire ${sure} minutes. Ajoutez (Compétences associées: ${selected4CText}) à chaque étape.) |

| Évaluation | Descriptions |
|---|---|
| **Méthodes d'évaluation / Outils** | (Méthodes correspondant aux objectifs) |

| Référence | Descriptions |
|---|---|
| **Liens connexes** | (Sites web) |
| **Bibliographie** | (Références bibliographiques) |
| **Annexes** | Les formulaires et guides sont présentés ci-dessous. |

<br>

### ANNEXES
(Formulaires, rubriques et instructions sous forme de tableaux Markdown séparés ci-dessous.)
`;
      }
    } else if (belgeDili === 'ar') {
      altBaslik = belgeTuru === "etkinlikPlani" ? "خطة درس التعلم النشط المدعوم بالتكنولوجيا" : "سيناريو التعلم الموجه نحو التكنولوجيا";
      roleInstruction = `أنت مساعد ذكاء اصطناعي خبير في أصول التدريس ومستشار لتصميم خطط الدروس والسيناريوهات التعليمية المتوافقة مع معايير المناهج الحديثة. يجب أن تكتب المخرجات باللغة العربية الفصحى بالكامل.`;
      
      kaynakcaInstruction = `
هام - قواعد كتابة المراجع:
يجب كتابة قسم المراجع وفقًا للقواعد التالية:
- لا تستخدم النقاط أو الشرطات (-) أو الترقيم. اكتبها كنص عادي.
- رتب المراجع أبجديًا، ولا تقسمها إلى فئات.
- أضف <br><br> في نهاية كل مرجع.
`;
      mufredatKurali = `
قاعدة المنهج:
تأكد من أن أقسام "الوحدة/الموضوع/مجال التعلم" و"إطار المحتوى" مطابقة للمادة (${ders})، والمستوى الصفي (${sinif})، ونواتج التعلم (${plainKazanimText}).
`;
      pedagojikKurallar = `
القواعد التربوية:
1. الأدوار: الطلاب باحثون نشطون، والمعلم موجه. الغِ الإلقاء التلقيني تمامًا.
2. مهارات القرن 21: ركز على كيفية إظهار الطلاب لمهارات التواصل والتعاون والتفكير الناقد والابتكار (${selected4CText}).
3. التكنولوجيا: وجه الأدوات الرقمية نحو الإنتاج والبرمجة النشطة.
`;
      webAraclariKategorileri = `
الأدوات الرقمية الموصى بها:
- البحث: Perplexity, Google Scholar, EBA
- التعاون: Padlet, Mentimeter, Miro
- البرمجة والنمذجة: MEB-KİT Simulator, Tinkercad, Scratch
- الوسائط والتصميم: Canva, CapCut, Adobe Express
- التفاعل والتقييم: Genially, Prezi, Kahoot
`;
      ekYonergeKurali = `
قاعدة إرشادات التطبيق:
إذا تم استخدام "MEB-KİT" أو "طابعة ثلاثية الأبعاد"، فأضف جدولاً تفصيليًا لـ "إرشادات التطبيق" في قسم الملحقات.
`;

      if (belgeTuru === "etkinlikPlani") {
        formatInstruction = `
قاعدة التنسيق: يجب أن تكون المخرجات بتنسيق جدول Markdown التالي تمامًا. لا تضف أي نص قبل أو بعد الجدول.

| معلومات عامة | التوضيحات |
|---|---|
| **معرف النشاط** | (حدد معرفًا مثل ACT-01) |
| **عنوان النشاط** | (عنوان إبداعي - بأحرف كبيرة) |
| **نظرة عامة** | (ملخص عام وهدف النشاط) |
| **مدة النشاط** | ${sure} دقيقة |
| **المرحلة** | ${kademeText} |
| **المستوى الصفي** | الصف ${sinif} |
| **اسم المادة** | ${ders} |
| **الوحدة/الموضوع/مجال التعلم** | (تحديد من المنهج التعليمي) |
| **إطار المحتوى** | (الإطار المطابق للناتج التعليمي) |
| **نواتج التعلم / الأهداف** | ${tableKazanimText} |
| **الأجهزة والمعدات** | ${sinifEkipmanlari} |
| **الأدوات والمحتويات الرقمية** | (لا توجد أجهزة للطلاب! فقط الأدوات التي يعرضها المعلم على الشاشة تفاعلية) |
| **المواد التعليمية** | (أوراق عمل خاصة، مقص، إلخ للنشاط) |
| **منطقة النشاط (بيئة التعلم)** | (شرح تهيئة الصف باستخدام مجالات التعلم - ${selectedZones.join(', ')} - والطاولات المتنقلة) |
| **موقع الطلاب** | فردي / مجموعات صغيرة / الصف بأكمله |
| **دور المعلم** | قائد / موجه / مراقب |
| **التحضير** | (التحضير المسبق للمعلم والطلاب) |
| **التنفيذ (المدة: ... دقيقة)** | (الخطوات وفقًا لمجالات التعلم المختارة - ${selectedZones.join(', ')} - وأصول التعلم النشط. المجموع ${sure} دقيقة.) |
| **نهاية النشاط (المدة: ... دقيقة)** | (الختام، جمع التعليقات والمراجعة العامة) |
| **القياس والتقييم** | (طرق التقييم المطابقة للأهداف التعليمية) |
| **المراجع** | (قائمة المراجع) |
| **الملحقات** | النماذج والإرشادات معروضة في الأسفل. |

<br>

### الملحقات
(اكتب نماذج التقييم والقواعد الإرشادية خارج الجدول الرئيسي كجداول ماركداون منفصلة بالأسفل.)
`;
      } else {
        formatInstruction = `
قاعدة التنسيق: يجب أن تكون المخرجات بتنسيق جدول Markdown التالي تمامًا. لا تضف أي نص قبل أو بعد الجدول.

| معلومات عامة | التوضيحات |
|---|---|
| **معرف السيناريو** | (حدد معرفًا) |
| **اسم السيناريو** | (عنوان إبداعي - بأحرف كبيرة) |
| **المادة/المرحلة/المدة** | ${ders} / ${kademeText} / ${sure} دقيقة |

| التخطيط | التوضيحات |
|---|---|
| **نظرة عامة** | (ملخص عام للسيناريو) |
| **نواتج التعلم / الأهداف** | (نقاط) |
| **أهداف المنهج ذات الصلة** | ${tableKazanimText} |
| **المهارات** | (التركيز على مهارات القرن 21: ${selected4CText}) |

| التحضير | التوضيحات |
|---|---|
| **نهج التعلم** | ${teknikFormatText} |
| **المهام** | المعلم: ... <br><br> الطالب: ... |
| **الأدوات والتقنيات** | (لا توجد أجهزة للطلاب!) |
| **المواد التعليمية** | (المواد التعليمية الخاصة بالنشاط) |

| التنفيذ | التوضيحات |
|---|---|
| **أنشطة التعلم** | (الخطوات وفقًا لمجالات التعلم المختارة - ${selectedZones.join(', ')} - وأصول التعلم النشط. المجموع ${sure} دقيقة. أضف (المهارات ذات الصلة: ${selected4CText}) لكل خطوة.) |

| التقييم | التوضيحات |
|---|---|
| **أدوات / طرق التقييم** | (طرق التقييم المطابقة للأهداف التعليمية) |

| المراجع | التوضيحات |
|---|---|
| **الروابط ذات الصلة** | (مواقع الويب) |
| **المراجع** | (قائمة المراجع) |
| **الملحقات** | النماذج والإرشادات معروضة في الأسفل. |

<br>

### الملحقات
(اكتب نماذج التقييم والقواعد الإرشادية خارج الجدول الرئيسي كجداول ماركداون منفصلة بالأسفل.)
`;
      }
    } else {
      // Default: Türkçe
      altBaslik = belgeTuru === "etkinlikPlani" ? "TEKNOLOJİ DESTEKLİ AKTİF ÖĞRENME ETKİNLİK PLANI" : "TEKNOLOJİ ODAKLI ÖĞRENME SENARYOSU";
      roleInstruction = `Sen, Yenilikçi Sınıf Eğitim Atölyesi için MEB müfredat standartlarına tam uyumlu çalışan pedagoji uzmanı bir yapay zeka asistanısın. Görevin, öğretmenin verdiği bilgiler doğrultusunda "Teknoloji Destekli Aktif Öğrenme Etkinlik Planı" hazırlamaktır.`;
      
      kaynakcaInstruction = `
ÖNEMLİ - KAYNAKÇA YAZIM KURALLARI:
Eklenen Kaynakça bölümü "Yenilikçi Sınıf Kaynakça Yazım Rehberi"ne uygun OLMALIDIR:
- Madde işareti (bullet), tire (-), numaralandırma veya girinti KESİNLİKLE KULLANMA. Düz metin olarak yaz.
- Kaynakları alfabetik sırayla yaz, kategorilere (Kitaplar, Siteler vb.) AYIRMA.
- Her kaynağın sonuna <br><br> ekleyerek aralarında bir satır boşluk bırak.
- Kitaplar için: Yazar Soyadı, A. (Yıl). Kitap adı. Yayınevi.
- MEB Platformları (EBA, MEBİ vb.): Milli Eğitim Bakanlığı. (Yıl). İçeriğin başlığı. Platform Adı. URL
- Çevrim İçi Araçlar (Hazır içerik): Platform Adı. (t.y.). İçeriğin adı. Erişim tarihi 10 Mayıs 2026 URL
- Çevrim İçi Araçlar (Kendi ürettiği içerik): Milli Eğitim Bakanlığı. (Yıl, Gün Ay). YS-İçeriğin adı. Platform Adı. Erişim tarihi 10 Mayıs 2026 URL
- Öğretim Programları: Milli Eğitim Bakanlığı. (2024). [Ders Adı] dersi öğretim programı. Talim ve Terbiye Kurulu Başkanlığı. Erişim tarihi 10 Mayıs 2026 URL
DİKKAT: Kaynakça tablosunun içine sadece düz metin kaynakları yaz. Çevrim İçi Araçlar bölümünde belirttiğiniz araçları kaynakçaya eklemeyi UNUTMAYIN!
`;
      mufredatKurali = `
ÖNEMLİ MÜFREDAT KURALI (TÜRKİYE YÜZYILI MAARİF MODELİ 2024/2026):
"Ünite/Tema/Öğrenme Alanı" ve "Konu/İçerik Çerçevesi" bölümlerini kesinlikle uydurmayın veya genel geçer şekilde doldurmayın. Öğretmenin girdiği "Ders" (Örn: Matematik, Temel Matematik, Matematik Uygulamaları, Fen Bilimleri, Fizik, Kimya, Biyoloji, Türkçe, Türk Dili ve Edebiyatı, Sosyal Bilgiler, Tarih, T.C. İnkılap Tarihi ve Atatürkçülük, Coğrafya, Felsefe vb.), "Sınıf Seviyesi" ve "Kazanım" bilgilerini analiz edin. 
Bu bilgileri MEB'in güncel Türkiye Yüzyılı Maarif Modeli öğretim programları ile eşleştirerek, tam ve doğru "Öğrenme Alanı/Tema/Ünite" adını ve "Konu/İçerik Çerçevesi"ni tespit edip tablodaki ilgili alanlara yazın.
`;
      // Constructing tools list dynamically based on choices
      let kodlamaAraclari = [];
      if (useMebKit) {
        kodlamaAraclari.push("MEB-KİT Simülatörü", "Scratch");
      }
      if (use3DPrinter) {
        kodlamaAraclari.push("Tinkercad");
      }
      if (kodlamaAraclari.length === 0) {
        kodlamaAraclari.push("EBA Etkileşimli İçerikler", "Canva");
      }

      pedagojikKurallar = `
PEDAGOJİK VE METODOLOJİK KURALLAR:
1. Rol Tanımları: Öğrenciler aktif araştırmacı, öğretmen ise rehberdir. Geleneksel düz anlatımı tamamen ortadan kaldırın.
2. 4C Entegrasyonu: Her adımda öğrencilerin İletişim, İş Birliği, Eleştirel Düşünme ve Yaratıcılık becerilerini nasıl sergilediğini açıklayın.
3. Teknolojinin Rolü: Teknolojiyi sadece sunum veya tüketim için değil, esnek öğrenme alanlarına uygun olarak aktif üretim ve analiz için konumlandırın.
${useMebKit ? '- MEB-KİT Kodlama ve devre tasarımlarını (Scratch tabanlı) etkinliğe entegre edebilirsiniz.' : '- KESİNLİKLE MEB-KİT (veya MEB KİT) kullanımı, kodlaması, devre tasarımı veya Scratch tabanlı elektronik kodlama önermeyin/yazmayın.'}
${use3DPrinter ? '- 3B Tasarım/Modelleme (Tinkercad vb.) ve 3B Yazıcıdan fiziksel baskı almayı etkinliğe entegre edebilirsiniz.' : '- KESİNLİKLE 3B (3 boyutlu) tasarım, 3B modelleme, Tinkercad kullanımı veya 3B Yazıcıdan baskı almayı önermeyin/yazmayın.'}
`;
      webAraclariKategorileri = `
KATEGORİLERE GÖRE TAVSİYE EDİLEN YAPAY ZEKA VE WEB 2.0 ARAÇLARI:
- Bilgi Toplama/Araştırma: Perplexity, Google Akademik, EBA
- İş Birliği/Geri Bildirim: Padlet, Mentimeter, Miro
- İçerik Geliştirme/Kodlama: ${kodlamaAraclari.join(', ')}
- Üretim/Medya Tasarımı: Canva, CapCut, Adobe Express
- Sunum/Etkileşim: Genially, Prezi, Kahoot
`;
      ekYonergeKurali = `
ÖNEMLİ YÖNERGE KURALI:
${useMebKit || use3DPrinter ? `Eğer senaryoda ${useMebKit ? '"MEB-KİT" ' : ''}${use3DPrinter ? '"3B Yazıcı" ' : ''}kullanılıyorsa, EKLER bölümüne KESİNLİKLE detaylı bir "Uygulama Yönergesi" tablosu ekleyin (${useMebKit ? 'devre bağlantıları, pin yapılandırmaları ' : ''}${use3DPrinter ? 'veya 3D baskı slicing ayarları' : ''}).` : 'Senaryoda MEB-KİT veya 3B Yazıcı kullanılmadığı için EKLER bölümüne KESİNLİKLE devre bağlantı şemaları veya 3D baskı slicing tabloları eklemeyin. Ekler bölümünde sadece dersin kazanımına uygun çalışma kağıdı şablonları veya rubrik değerlendirme ölçekleri paylaşın.'}
`;

      if (belgeTuru === "etkinlikPlani") {
        formatInstruction = `
Format Kuralı: Çıktını KESİNLİKLE sadece aşağıdaki markdown tablosu formatında ver. Tablonun üstüne veya altına hiçbir açıklama metni, giriş veya çıkış ekleme. Sadece tabloyu yaz.

| Genel Bilgiler | Açıklamalar |
|---|---|
| **Etkinlik ID** | (ETK-01 vb. bir ID ata) |
| **Etkinlik Başlığı** | (Yaratıcı İsim - TAMAMI BÜYÜK HARFLERLE) |
| **Genel Bakış** | (Etkinliğin genel amacı ve özeti) |
| **Etkinlik Süresi** | ${sure} Dakika |
| **Kademe** | ${kademeText} |
| **Sınıf Seviyesi** | ${sinif}. Sınıf |
| **Ders Adı** | ${ders} |
| **Ünite/Tema/Öğrenme Alanı** | (Güncel müfredattan tespit et) |
| **Konu/İçerik Çerçevesi** | (Kazanımla eşleşen tam konu çerçevesi) |
| **Öğrenme Çıktıları ve Süreç Bileşenleri /Kazanımlar** | ${tableKazanimText} |
| **Donanım** | ${sinifEkipmanlari} |
| **Çevrim İçi Araçlar ve İçerikler** | (Öğrenci cihazı yok! Sadece öğretmenin tahtadan veya bilgisayardan açacağı araçlar/simülasyonlar) |
| **Öğretim Materyalleri** | (sınıfta her zaman bulunan standart materyalleri yazma. Sadece bu etkinliğe özel çalışma kâğıdı, makas, yapıştırıcı vb sarf malzemeleri yaz) |
| **Etkinlik Alanı** | (Pedagojik yaklaşıma göre sınıfı nasıl esnettiğinizi belirtin. Hangi öğrenme alanlarını bir arada kullandığınızı ve tekerlekli masaların durumunu belirtin.) |
| **Öğrencilerin Konumu** | Bireysel / Küçük Gruplar / Tüm Sınıf (Hangileri geçerliyse adlarını yaz) |
| **Öğretmenin Rolü** | Lider / Rehber / Gözlemci (Hangileri geçerliyse adlarını yaz) |
| **Hazırlık** | (Etkinlik başlamadan önce öğretmenin ve öğrencilerin yapması gereken ön hazırlıklar) |
| **Uygulama (Süre: ... dk.)** | (Seçilen öğrenme alanlarına - ${selectedZones.join(', ')} - ve aktif öğrenme pedagojisine göre adımlar. Süre toplamı ${sure} dakikaya uymalıdır.) |
| **Etkinlik Sonu (Süre: ... dk.)** | (Etkinliğin tamamlanması, geri bildirimlerin alınması ve sınıf genel incelemesi) |
| **Ölçme ve Değerlendirme** | (Kazanımın alt maddelerini ölçen, rehberden seçilmiş yöntemler) |
| **Kaynakça** | (Rehbere tam uygun kaynakça) |
| **Ekler** | Formlar ve yönergeler en altta sunulmuştur. |

<br>

### EKLER
(Biçimlendirici veya özetleyici formların/yönergelerin TAM İÇERİĞİNİ bu tablonun dışında, KESİNLİKLE ayrı markdown tabloları halinde buraya ekle.)
`;
      } else {
        formatInstruction = `
Format Kuralı: Çıktını KESİNLİKLE sadece aşağıdaki markdown tablosu formatında ver. Tablonun üstüne veya altına hiçbir açıklama metni, giriş veya çıkış ekleme. Sadece tabloyu yaz.

| Genel Bilgiler | Açıklamalar |
|---|---|
| **Senaryo ID** | (Sen belirle) |
| **Senaryo Adı** | (Yaratıcı İsim - TAMAMI BÜYÜK HARFLERLE) |
| **Ders/Kademe/Süre** | ${ders} / ${kademeText} / ${sure} Dakika |

| Planlama | Açıklamalar |
|---|---|
| **Genel Bakış** | (Senaryonun genel açıklaması) |
| **Öğrenme Hedefleri/ Amaçları** | (Maddeler halinde) |
| **İlgili Kazanımlar** | ${tableKazanimText} |
| **Beceriler** | (Hedeflenen 4C becerilerini vurgula: ${selected4CText}) |

| Hazırlık | Açıklamalar |
|---|---|
| **Öğrenme Yaklaşımı** | ${teknikFormatText} |
| **Görevler** | Öğretmen: ... <br><br> Öğrenci: ... |
| **Araçlar/Teknolojiler** | (Öğrenci cihazı yok!) |
| **Öğretim Materyalleri** | (Sınıfta standart bulunanları YAZMA. Sadece etkinliğe özel sarf malzemeleri: Çalışma kâğıdı, makas vb.) |

| Uygulama | Açıklamalar |
|---|---|
| **Öğrenme Etkinlikleri** | (Seçilen öğrenme alanlarına - ${selectedZones.join(', ')} - göre adımlar. Her adıma ayrılan süreyi "dk." cinsinden belirtin ve toplamın ${sure} dakikaya uymasını sağlayın. Her adımın sonuna (İlgili Beceriler: ${selected4CText}) ekle.) |

| Değerlendirme | Açıklamalar |
|---|---|
| **Değerlendirme Yöntemleri / Araçları** | (Rehberden seçilen çeşitli araçlarla değerlendirme tasarla.) |

| Referans | Açıklamalar |
|---|---|
| **İlgili Bağlantılar** | (Web siteleri) |
| **Kaynakça** | (Rehbere tam uygun kaynakça) |
| **Ekler** | Form, Rubrik ve Yönergeler belgenin en alt kısmında sunulmuştur. |

<br>

### EKLER
(Biçimlendirici, özetleyici formların veya yönergelerin TAM İÇERİĞİNİ ana tablonun içine DEĞİL, BURAYA AYRI VE OKUNAKLI NORMAL MARKDOWN TABLOLARI halinde KESİNLİKLE çizin/yazın.)
`;
      }
    }

    const systemPrompt = `${roleInstruction}\nDili akademik, profesyonel, anlaşılır and ${targetLangName} olarak kullan. Anlatımı markdown kullanarak biçimlendir.`;
    const userPrompt = `Ders: ${ders}\nSeçilen Sınıf Seviyesi: ${sinif}. Sınıf\nÖğrenme Kazanımı: ${plainKazanimText}\n\nÖNEMLİ KURAL: Eğer 'Öğrenme Kazanımı' metninin başında sınıf seviyesi rakamı kodlanmışsa ve seçilen sınıf seviyesi (${sinif}) ile çelişiyorsa, KESİNLİKLE kazanım kodunda yazan sınıf seviyesini esas al.\n\nÖNEMLİ MATEMATİKSEL BİÇİM KURALI: Plana veya etkinlik adımlarına KESİNLİKLE LaTeX biçiminde matematiksel formüller ($...$, \\Box, \\frac, \\times, \\Box = vb.) eklemeyiniz. Matematiksel bilinmeyenleri, boş kutuları ve işlemleri herkesin okuyabileceği düz yazı sembolleriyle yazınız (Örneğin: '14 + ? = 20', '14 + [kutu] = 20' veya '14 + x = 20' şeklinde).\n\n${teknikPromptText}\n${mobilyaPromptText}\n${yzAracInstruction}\n${kaynakcaInstruction}\n${mufredatKurali}\n${pedagojikKurallar}\n${webAraclariKategorileri}\n${ekYonergeKurali}\nSeçilen Öğrenme Alanları: ${selectedZones.join(', ')}\nSeçilen 4C Becerileri: ${selected4CText}\nEtkinlik Süresi: ${sure} dakika\n\nLütfen yukarıdaki yönergelere uyarak planı/senaryoyu yazınız:\n${formatInstruction}\n\nÖNEMLİ: Planın en sonuna (EKLER kısmının da altına), oluşturduğun bu planla en uyumlu sınıf düzenini (2D yerleşimi) başlatmak için KESİNLİKLE aşağıdaki JSON kodunu içeren tek bir markdown kod bloğu yerleştir. Başka hiçbir açıklama yazısı bu JSON bloğunun içine veya yanına ekleme. Sadece bu bloğu yaz:\n\`\`\`json\n{\n  "groups": ["hex", "tri"], \n  "items": ["pcDesk", "pcDesk", "pouf"]\n}\n\`\`\`\nKullanabileceğin grup anahtarları (groups): "hex" (6lı ahtapot), "octagon" (8li ahtapot), "tri" (3lü üçgen), "double" (2li düz), "quad" (4lü dikdörtgen), "zigzag" (4lü zikzak).\nKullanabileceğin bağımsız ürün anahtarları (items): "pcDesk" (bilgisayar masası), "pouf" (puf).`;
      const response = await callGeminiText(systemPrompt, userPrompt, apiKey);
      
      // Extract the JSON layout block
      let layoutData = null;
      let cleanResponse = response;
      const jsonRegex = /```json\s*(\{[\s\S]*?\})\s*```/;
      const match = response.match(jsonRegex);
      if (match) {
        try {
          layoutData = JSON.parse(match[1]);
          cleanResponse = response.replace(jsonRegex, '').trim();
        } catch (e) {
          console.error("Failed to parse suggested layout JSON", e);
        }
      }
      
      setSuggestedLayout(layoutData);
      setLastResponseText(cleanResponse);
      
      const logoHtml = `
      <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
          <div style="line-height: 1.1; margin-bottom: 8px;">
              <span style="font-family: 'Outfit', 'Segoe UI', Arial, sans-serif; font-size: 26pt; font-weight: 800; color: #4f46e5; letter-spacing: -0.5px;">YENİLİKÇİ</span>
              <span style="font-family: 'Outfit', 'Segoe UI', Arial, sans-serif; font-size: 26pt; font-weight: 400; color: #0f172a; letter-spacing: 0.5px;"> SINIF</span>
          </div>
          <div style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 12pt; font-weight: 600; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase;">
              ${altBaslik}
          </div>
      </div>`;

      let formattedText = formatMarkdown(cleanResponse);
      
      // Inject standard classes into compiled markdown tables using full-depth query selector
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = formattedText;
      
      let isAppendix = false;
      const elements = tempDiv.querySelectorAll('*');
      elements.forEach(el => {
        const text = el.innerText.toUpperCase();
        if (el.tagName === 'H3' && (text.includes('EKLER') || text.includes('APPENDICES') || text.includes('ANHÄNGE') || text.includes('ANNEXES') || text.includes('الملحقات'))) {
          isAppendix = true;
        }
        if (el.tagName === 'TABLE') {
          if (isAppendix) {
            el.className = "standard-table w-full border border-collapse border-slate-200 my-4 text-sm";
          } else {
            el.className = "template-table w-full border border-collapse border-slate-200 my-4 text-sm";
          }
        }
      });

      setRenderedHtml(logoHtml + tempDiv.innerHTML);
      showToast("Senaryo başarıyla oluşturuldu!", "success");

      // Auto scroll to result panel
      setTimeout(() => {
        const resSec = document.getElementById('resultSection');
        if (resSec) {
          resSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    } catch (error) {
      showToast("İçerik oluşturulurken bir hata oluştu: " + error.message, "error");
      console.error(error);
    } finally {
      setIsLoading(false);
      stepTimeouts.forEach(clearTimeout);
    }
  };

  // Save Current Scenario to Browser Memory
  const handleSaveToBrowser = () => {
    if (!renderedHtml) return;
    
    const dName = ders || "Bilinmeyen Ders";
    const typeText = belgeTuru === "etkinlikPlani" ? "Etkinlik Planı" : "Öğrenme Senaryosu";
    const shortKazanim = kazanim.length > 30 ? kazanim.substring(0, 30) + "..." : kazanim;
    const title = `${dName} - ${typeText} (${shortKazanim})`;
    const id = Date.now().toString();

    try {
      const updated = [...savedScenarios, { id, title, content: renderedHtml, timestamp: Date.now(), rawMarkdown: lastResponseText }];
      setSavedScenarios(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      showToast("Senaryo tarayıcı hafızasına başarıyla kaydedildi!", "success");
    } catch (e) {
      console.error(e);
      showToast("Kaydetme işlemi başarısız oldu.", "error");
    }
  };

  // Load Saved Scenario
  const handleLoadScenario = (scenario) => {
    setRenderedHtml(scenario.content);
    setLastResponseText(scenario.rawMarkdown || "");
    showToast("Kayıtlı senaryo yüklendi.", "success");
    
    // Auto scroll to results when loaded
    setTimeout(() => {
      const resSec = document.getElementById('resultSection');
      if (resSec) {
        resSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 200);
  };

  // Delete Saved Scenario from list
  const handleDeleteScenario = (id) => {
    const confirmDelete = confirm("Bu kaydı tarayıcınızdan silmek istediğinize emin misiniz?");
    if (!confirmDelete) return;

    try {
      const filtered = savedScenarios.filter(s => s.id !== id);
      setSavedScenarios(filtered);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
      showToast("Senaryo silindi.", "success");
    } catch(e) {
      console.error(e);
      showToast("Silme işlemi başarısız.", "error");
    }
  };

  // Word (.docx) File Download
  const handleDownloadWord = async () => {
    if (!renderedHtml) return;
    
    const data = parseGeneratedMarkdown(lastResponseText || "");
    const dName = data.baslik ? data.baslik.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]+/g, '_') : "Etkinlik_Plani";
    const filename = `${dName}.docx`;

    try {
      showToast("Word belgesi hazırlanıyor...", "success");
      await downloadDocx(lastResponseText, renderedHtml, filename, { selectedZones, sure });
    } catch (e) {
      console.error(e);
      showToast(e.message, "error");
    }
  };

  // Plain Text Copy (answers only)
  const handleCopyOnlyText = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = renderedHtml;
    let plainText = "";
    
    const trs = tempDiv.querySelectorAll('tr');
    trs.forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length === 2) {
        const text = tds[1].innerText.trim();
        if (text) plainText += text + "\n\n";
      } else if (tds.length === 1) {
        const text = tds[0].innerText.trim();
        if (text) plainText += text + "\n\n";
      }
    });
    
    if (!plainText.trim()) plainText = tempDiv.innerText;

    navigator.clipboard.writeText(plainText.trim()).then(() => {
      showToast("Sadece yazılar (başlıksız) kopyalandı!", "success");
    }).catch(err => {
      console.error(err);
      showToast("Kopyalama başarısız oldu.", "error");
    });
  };

  // Format Copy for pasting to Word
  const handleCopyForWord = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = renderedHtml;
    
    // Apply word styling
    const tables = tempDiv.querySelectorAll('table');
    tables.forEach(table => {
      table.setAttribute('border', '1');
      table.style.borderCollapse = 'collapse';
      table.style.width = '100%';
      table.style.marginBottom = '24px';
      table.style.border = '1px solid #cbd5e1';
      table.style.fontFamily = 'Calibri, Arial, sans-serif';
    });

    const ths = tempDiv.querySelectorAll('th');
    ths.forEach(th => {
      th.style.backgroundColor = '#3b82f6'; 
      th.style.color = 'white';
      th.style.fontWeight = 'bold';
      th.style.padding = '10px 12px';
      th.style.textAlign = 'left';
      th.style.border = '1px solid #2563eb';
      th.style.fontSize = '12pt';
    });

    const trs = tempDiv.querySelectorAll('tr');
    trs.forEach(tr => {
      const parentTable = tr.closest('table');
      const isTemplate = parentTable && parentTable.classList.contains('template-table');

      const tds = tr.querySelectorAll('td');
      tds.forEach((td, index) => {
        td.style.padding = '10px 12px';
        td.style.border = '1px solid #cbd5e1';
        td.style.verticalAlign = 'top';
        td.style.color = '#000000';
        td.style.fontSize = '11pt';
        
        if (isTemplate && index === 0 && tds.length > 1) { 
          td.style.backgroundColor = '#f8fafc';
          td.style.fontWeight = 'bold';
          td.style.width = '25%';
        }
      });
    });

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.appendChild(tempDiv);
    document.body.appendChild(tempContainer);

    const range = document.createRange();
    range.selectNodeContents(tempContainer);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    try {
      document.execCommand('copy');
      showToast("Word formatında kopyalandı! Boş bir Word belgesine (Ctrl+V) yapıştırabilirsiniz.", "success");
    } catch (err) {
      console.error(err);
      showToast("Kopyalama başarısız oldu.", "error");
    }

    selection.removeAllRanges();
    document.body.removeChild(tempContainer);
  };

  // Google Drive: Yükleme
  const handleSaveToDrive = async () => {
    if (!renderedHtml) return;

    setDriveStatus('uploading');
    showToast("Dosya Google Drive'a yükleniyor...", "success");

    try {
      const codeMatch = kazanim ? kazanim.match(/^([A-ZÇĞİÖŞÜ]{2,5})\.(\d{1,2})\.(\d{1,2})\.(\d{1,2})/) : null;
      const outcomeCode = codeMatch ? `${codeMatch[1]}.${codeMatch[2]}.${codeMatch[3]}.${codeMatch[4]}` : "Plan";
      
      const nextNum = await getNextFileNumber(outcomeCode);
      const filename = `${outcomeCode} - ${nextNum}.docx`;

      const blob = await generateDocxBlob(lastResponseText, renderedHtml, { selectedZones, sure });
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64String = reader.result.split(',')[1];
        
        try {
          const res = await uploadToGoogleDrive(base64String, filename);
          
          // Save credentials for delete
          const key = getCurrentScenarioKey();
          const uploads = JSON.parse(localStorage.getItem(UPLOADS_STORAGE_KEY) || '{}');
          uploads[key] = {
            fileId: res.fileId,
            deleteToken: res.deleteToken
          };
          localStorage.setItem(UPLOADS_STORAGE_KEY, JSON.stringify(uploads));
          
          incrementLocalCounter(outcomeCode, nextNum);
          
          setDriveStatus('uploaded');
          showToast("Dosya başarıyla Google Drive'a kaydedildi!", "success");
          
          if (res.url) {
            const openConfirm = confirm("Dosya kaydedildi. Google Drive üzerinde görüntülemek ister misiniz?");
            if (openConfirm) window.open(res.url, "_blank");
          }
        } catch (uploadErr) {
          console.error(uploadErr);
          setDriveStatus('idle');
          showToast("Drive yükleme hatası: " + uploadErr.message, "error");
        }
      };
    } catch (e) {
      console.error(e);
      setDriveStatus('idle');
      showToast("Hata: " + e.message, "error");
    }
  };

  // Google Drive: Silme
  const handleDeleteFromDrive = async () => {
    const key = getCurrentScenarioKey();
    const uploads = JSON.parse(localStorage.getItem(UPLOADS_STORAGE_KEY) || '{}');
    const fileData = uploads[key];
    
    if (!fileData || !fileData.fileId || !fileData.deleteToken) {
      showToast("Bu dosyaya ait silme bilgisi bulunamadı.", "error");
      return;
    }

    const confirmDelete = confirm("Bu senaryoyu Google Drive klasöründen silmek istediğinize emin misiniz? (Yalnızca kendi yüklediğiniz dosyaları silebilirsiniz)");
    if (!confirmDelete) return;

    setDriveStatus('deleting');
    showToast("Dosya siliniyor...", "success");

    try {
      await deleteFromGoogleDrive(fileData.fileId, fileData.deleteToken);
      
      // Clear from local storage
      delete uploads[key];
      localStorage.setItem(UPLOADS_STORAGE_KEY, JSON.stringify(uploads));
      
      setDriveStatus('idle');
      showToast("Dosya Google Drive'dan silindi (Çöp kutusuna taşındı).", "success");
    } catch (err) {
      console.error(err);
      setDriveStatus('uploaded'); // Revert to uploaded state if delete failed
      showToast("Dosya silinirken hata oluştu: " + err.message, "error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-50 via-slate-100 to-indigo-50/30 p-4 md:p-8 font-sans">
      {/* Top Header Row spanning full width */}
      <header className="max-w-4xl mx-auto glass-panel rounded-3xl p-6 mb-8 bg-white shadow-md border border-slate-100 flex flex-col gap-5 items-center text-center">
        {/* Title & Subtitle - Centered */}
        <div className="flex flex-col items-center">
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Logo" className="w-8 h-8 md:w-10 md:h-10 rounded-xl shadow-sm border border-slate-100 object-cover" />
            <span>Yenilikçi Sınıf Eğitim Atölyesi</span>
          </h1>
          <p className="text-slate-500 font-medium text-xs md:text-sm mt-1">
            Yapay Zeka Destekli Aktif Öğrenme Planlayıcısı ve Senaryo Tasarımcısı
          </p>
        </div>

        {/* Divider line */}
        <div className="w-full h-px bg-slate-100"></div>

        {/* Bottom Row - Split between Name/Instagram on the left, and 3-button menu on the right */}
        <div className="w-full flex flex-col lg:flex-row justify-between items-center gap-4">
          {/* Teacher info + Instagram link next to it */}
          <div className="flex flex-wrap justify-center lg:justify-start items-center gap-3">
            <div className="bg-indigo-50 text-indigo-700 px-3.5 py-1.5 rounded-2xl text-[10px] md:text-xs font-bold border border-indigo-100 shadow-sm leading-relaxed text-left">
              <div>👨‍🏫 Hasan YILMAZ - Matematik Öğretmeni</div>
              <div className="text-indigo-600/90 font-medium">Ordu Yeğitek Proje Koordinatörü</div>
            </div>
            
            {/* Instagram social link next to the name badge */}
            <a
              href="https://www.instagram.com/hsan.ylmaz"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-xl text-xs font-bold text-white hover:opacity-90 hover:shadow transition-all shadow-sm active:scale-95 whitespace-nowrap"
            >
              <svg
                className="w-3.5 h-3.5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
              <span>@hsan.ylmaz</span>
            </a>
          </div>

          {/* Far Right: 3-button menu */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setIsSavedOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span>Kayıtlı Senaryolar</span>
              {savedScenarios.length > 0 && (
                <span className="bg-indigo-600 text-white rounded-full text-[9px] w-4.5 h-4.5 flex items-center justify-center font-bold">
                  {savedScenarios.length}
                </span>
              )}
            </button>

            <a
              href="https://drive.google.com/drive/folders/1O3TVQP_i8sZfpBStbSlgwZk3U7kL0du3?usp=drive_link"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 whitespace-nowrap"
            >
              <Cloud className="w-4 h-4 text-blue-500 animate-pulse" />
              <span>Drive Arşivi</span>
            </a>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-500" />
              <span>API Ayarları</span>
            </button>
          </div>
        </div>
      </header>

      {/* Unified Vertical Stack Layout */}
      <div className="max-w-4xl mx-auto space-y-8">
        {/* 1. Welcome Panel (Only visible initially) */}
        {!renderedHtml && !isLoading && (
          <section className="glass-panel rounded-3xl p-8 md:p-12 text-center bg-white shadow-xl border border-slate-100 space-y-8">
            <div className="flex justify-center">
              <div className="bg-indigo-50 p-4 rounded-full text-4xl shadow-inner animate-pulse">
                🔮
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
                Eğitim Atölyesine Hoş Geldiniz!
              </h3>
              <p className="text-sm md:text-base text-slate-500 max-w-2xl mx-auto">
                Aşağıdaki form aracılığıyla ders bilgilerini, kazanımları ve öğrenme alanlarını girerek yapay zeka destekli, Maarif Model uyumlu etkinlik planınızı veya öğrenme senaryonuzu anında tasarlayabilirsiniz.
              </p>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-4xl mx-auto pt-6 border-t border-slate-100">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all">
                <div className="text-xs font-extrabold text-indigo-600 mb-1">ADIM 1</div>
                <h4 className="font-bold text-slate-800 text-sm md:text-base mb-2">API Ayarını Yapın</h4>
                <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                  Sağ üstteki "API Ayarları" menüsünden ücretsiz aldığınız Gemini API anahtarınızı tanımlayın.
                </p>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all">
                <div className="text-xs font-extrabold text-indigo-600 mb-1">ADIM 2</div>
                <h4 className="font-bold text-slate-800 text-sm md:text-base mb-2">Bilgileri Doldurun</h4>
                <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                  Ders adı, süre, sınıf seviyesi, kazanım bilgileri ile öğrenme alanlarını ve hedeflenen 4C becerilerini seçin.
                </p>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all">
                <div className="text-xs font-extrabold text-indigo-600 mb-1">ADIM 3</div>
                <h4 className="font-bold text-slate-800 text-sm md:text-base mb-2">Senaryo Üretin</h4>
                <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                  En alttaki "Senaryo/Plan Metnini Oluştur" butonuna basarak yapay zekanın pedagojik planı çizmesini izleyin!
                </p>
              </div>
            </div>

            {/* Features badges */}
            <div className="pt-4 flex flex-wrap justify-center gap-3 text-xs md:text-sm font-bold text-slate-600">
              <span className="bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-sm">📐 2D Sınıf Çizimi</span>
              <span className="bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-sm">💾 Yerel Arşivleme</span>
              <span className="bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-sm">▲ Drive Entegrasyonu</span>
              <span className="bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-sm">📄 Word Şablon Doldurucu</span>
            </div>
          </section>
        )}

        {/* 2. Input Form (Always visible) */}
        <section>
          <InputForm
            belgeTuru={belgeTuru}
            setBelgeTuru={setBelgeTuru}
            ders={ders}
            setDers={setDers}
            sinif={sinif}
            setSinif={setSinif}
            teknik={teknik}
            setTeknik={setTeknik}
            sure={sure}
            setSure={setSure}
            yapayZekaAraclari={yapayZekaAraclari}
            setYapayZekaAraclari={setYapayZekaAraclari}
            belgeDili={belgeDili}
            setBelgeDili={setBelgeDili}
            kazanim={kazanim}
            setKazanim={setKazanim}
            selectedZones={selectedZones}
            setSelectedZones={setSelectedZones}
            selectedSkills={selectedSkills}
            setSelectedSkills={setSelectedSkills}
            useMebKit={useMebKit}
            setUseMebKit={setUseMebKit}
            use3DPrinter={use3DPrinter}
            setUse3DPrinter={setUse3DPrinter}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            kazanimlarDb={kazanimlarDb}
            selectedSurec={selectedSurec}
            setSelectedSurec={setSelectedSurec}
          />
        </section>

        {/* 3. Loading Card (Appears under form during generation) */}
        {isLoading && (
          <section id="loadingSection" className="glass-panel rounded-3xl p-8 md:p-12 bg-white shadow-xl border border-slate-100 space-y-8">
            {/* Header + Spinner Row */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4 text-left">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl animate-spin">
                  <RefreshCw className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-indigo-950">
                    {loadingStep === 1 && "Müfredat Analizi Yapılıyor..."}
                    {loadingStep === 2 && "Pedagojik Yaklaşım Seçiliyor..."}
                    {loadingStep === 3 && "Süre & İstasyon Planlaması Yapılıyor..."}
                    {loadingStep === 4 && "Değerlendirme Kriterleri Tasarlanıyor..."}
                    {loadingStep >= 5 && "Dosya Hazırlanıyor ve Tamamlanıyor..."}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {loadingStep === 1 && "Kazanımlar ve sınıf seviyesi standartları inceleniyor..."}
                    {loadingStep === 2 && "Aktif öğrenme teknikleri ve 4C becerileri entegre ediliyor..."}
                    {loadingStep === 3 && "Öğrenme alanlarına göre zaman dağılımı hesaplanıyor..."}
                    {loadingStep === 4 && "Öz değerlendirme formları ve rubrikler hazırlanıyor..."}
                    {loadingStep >= 5 && "Belge şablonu oluşturuluyor, yapay zekanın yanıtı tamamlanıyor (lütfen bekleyin)..."}
                  </p>
                </div>
              </div>
              
              {/* Simulated Percentage Indicator */}
              <div className="text-2xl font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
                {loadingStep === 1 && "20%"}
                {loadingStep === 2 && "45%"}
                {loadingStep === 3 && "65%"}
                {loadingStep === 4 && "85%"}
                {loadingStep >= 5 && "95%"}
              </div>
            </div>

            {/* YAPAY ZEKA TASARIM SÜRECİ Stepper */}
            <div className="bg-indigo-50/40 border border-indigo-100/40 rounded-2xl p-6 text-left space-y-4">
              <div className="text-[10px] md:text-xs font-black text-indigo-700/80 tracking-wider uppercase">
                YAPAY ZEKA TASARIM SÜRECİ
              </div>
              
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 lg:gap-2">
                {/* Step 1: Müfredat Analizi */}
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                    loadingStep > 1 
                      ? 'bg-emerald-100 text-emerald-600 border-emerald-300' 
                      : loadingStep === 1 
                        ? 'bg-indigo-100 text-indigo-600 border-indigo-300 animate-pulse' 
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    {loadingStep > 1 ? "✓" : "1"}
                  </div>
                  <span className={`text-xs font-bold transition-all ${
                    loadingStep > 1 
                      ? 'text-emerald-600' 
                      : loadingStep === 1 
                        ? 'text-indigo-600' 
                        : 'text-slate-400'
                  }`}>
                    Müfredat Analizi
                  </span>
                </div>

                {/* Arrow / Line for desktop */}
                <div className="hidden lg:block h-0.5 flex-1 bg-slate-200 mx-2" />

                {/* Step 2: Pedagoji Seçimi */}
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                    loadingStep > 2 
                      ? 'bg-emerald-100 text-emerald-600 border-emerald-300' 
                      : loadingStep === 2 
                        ? 'bg-indigo-100 text-indigo-600 border-indigo-300 animate-pulse' 
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    {loadingStep > 2 ? "✓" : "2"}
                  </div>
                  <span className={`text-xs font-bold transition-all ${
                    loadingStep > 2 
                      ? 'text-emerald-600' 
                      : loadingStep === 2 
                        ? 'text-indigo-600' 
                        : 'text-slate-400'
                  }`}>
                    Pedagoji Seçimi
                  </span>
                </div>

                {/* Arrow / Line for desktop */}
                <div className="hidden lg:block h-0.5 flex-1 bg-slate-200 mx-2" />

                {/* Step 3: Süre & Aşama Hesabı */}
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                    loadingStep > 3 
                      ? 'bg-emerald-100 text-emerald-600 border-emerald-300' 
                      : loadingStep === 3 
                        ? 'bg-indigo-100 text-indigo-600 border-indigo-300 animate-pulse' 
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    {loadingStep > 3 ? "✓" : "3"}
                  </div>
                  <span className={`text-xs font-bold transition-all ${
                    loadingStep > 3 
                      ? 'text-emerald-600' 
                      : loadingStep === 3 
                        ? 'text-indigo-600' 
                        : 'text-slate-400'
                  }`}>
                    Süre & Aşama Hesabı
                  </span>
                </div>

                {/* Arrow / Line for desktop */}
                <div className="hidden lg:block h-0.5 flex-1 bg-slate-200 mx-2" />

                {/* Step 4: Değerlendirme Tasarımı */}
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                    loadingStep > 4 
                      ? 'bg-emerald-100 text-emerald-600 border-emerald-300' 
                      : loadingStep === 4 
                        ? 'bg-indigo-100 text-indigo-600 border-indigo-300 animate-pulse' 
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    {loadingStep > 4 ? "✓" : "4"}
                  </div>
                  <span className={`text-xs font-bold transition-all ${
                    loadingStep > 4 
                      ? 'text-emerald-600' 
                      : loadingStep === 4 
                        ? 'text-indigo-600' 
                        : 'text-slate-400'
                  }`}>
                    Değerlendirme Tasarımı
                  </span>
                </div>

                {/* Arrow / Line for desktop */}
                <div className="hidden lg:block h-0.5 flex-1 bg-slate-200 mx-2" />

                {/* Step 5: Kaynakça & Şablonlama */}
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                    loadingStep > 5 
                      ? 'bg-emerald-100 text-emerald-600 border-emerald-300' 
                      : loadingStep === 5 
                        ? 'bg-indigo-100 text-indigo-600 border-indigo-300 animate-pulse' 
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    {loadingStep > 5 ? "✓" : "5"}
                  </div>
                  <span className={`text-xs font-bold transition-all ${
                    loadingStep > 5 
                      ? 'text-emerald-600' 
                      : loadingStep === 5 
                        ? 'text-indigo-600' 
                        : 'text-slate-400'
                  }`}>
                    Kaynakça & Şablonlama
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 4. Generated Output (ResultPanel + FloorPlanCanvas, below the form) */}
        {renderedHtml && !isLoading && (
          <div className="space-y-8">
            <section id="resultSection">
              <ResultPanel
                renderedHtml={renderedHtml}
                onSaveToBrowser={handleSaveToBrowser}
                onCopyOnlyText={handleCopyOnlyText}
                onDownloadWord={handleDownloadWord}
                onCopyForWord={handleCopyForWord}
                onSaveToDrive={handleSaveToDrive}
                onDeleteFromDrive={handleDeleteFromDrive}
                driveStatus={driveStatus}
                onDrawLayout={handleDrawLayout}
              />
            </section>
             {showLayout && <FloorPlanCanvas selectedZones={selectedZones} suggestedLayout={suggestedLayout} use3DPrinter={use3DPrinter} />}
          </div>
        )}
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        onSave={handleSaveApiKey}
      />

      <SavedScenariosModal
        isOpen={isSavedOpen}
        onClose={() => setIsSavedOpen(false)}
        scenarios={savedScenarios}
        onLoad={handleLoadScenario}
        onDelete={handleDeleteScenario}
      />

      {/* Toast Alert */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl text-white font-bold shadow-2xl z-50 transition-all duration-300 transform flex items-center gap-3 animate-bounce bg-opacity-95 ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-green-600'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
