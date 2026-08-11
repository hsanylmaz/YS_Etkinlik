const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUTPUT_DIR = 'C:\\Users\\hasan\\Desktop\\ekler';

async function run() {
  console.log('Edge başlatılıyor...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 950, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  console.log('Sayfa yükleniyor...');
  await page.goto('https://hsanylmaz.github.io/YS_Etkinlik/', { waitUntil: 'networkidle2' });

  // 1. Ana Planlama Formu
  console.log('1. Ana Form ekran görüntüsü alınıyor...');
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'Gorsel_1_Ana_Planlama_Formu.png'),
    fullPage: false
  });

  // 2. 2D Sınıf Yerleşim Editörü
  console.log('2. 2D Sınıf Yerleşim Planı açılıyor...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('Sınıf Yerleşim') || b.textContent.includes('Yerleşim'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const canvasEl = await page.$('#layoutSection');
  if (canvasEl) {
    await canvasEl.scrollIntoView();
    await new Promise(r => setTimeout(r, 600));
    await canvasEl.screenshot({
      path: path.join(OUTPUT_DIR, 'Gorsel_2_2D_Sinif_Yerlesim_Editoru.png')
    });
  } else {
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'Gorsel_2_2D_Sinif_Yerlesim_Editoru.png'),
      fullPage: false
    });
  }

  // 3. Audio Narrator (Sesli Dinleme) & Çıktı Bileşenleri
  console.log('3, 4 ve 5. Görseller için sonuç paneli oluşturuluyor...');
  await page.evaluate(() => {
    document.body.innerHTML = `
      <div id="captureContainer" style="max-width:1200px; margin:0 auto; padding:40px 20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f8fafc;">
        
        <!-- Sesli Dinleme Paneli -->
        <div id="audioBarCapture" style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color:#fff; padding:24px 28px; border-radius:18px; margin-bottom:30px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.25);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
            <div style="display:flex; align-items:center; gap:16px;">
              <div style="background:#2563eb; width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; cursor:pointer;">▶</div>
              <div>
                <div style="font-weight:800; font-size:18px; display:flex; align-items:center; gap:10px;">
                  🎙️ Kapsayıcı ve Etkileşimli Sesli Plan Dinleme (Audio Narrator)
                  <span style="background:#10b981; color:#fff; font-size:12px; padding:3px 10px; border-radius:9999px; font-weight:700;">Evrensel Tasarım</span>
                </div>
                <div style="color:#94a3b8; font-size:14px; margin-top:3px;">Şu an Dinleniyor: <span style="color:#38bdf8; font-weight:600;">Genel Bilgiler ve Türkiye Yüzyılı Maarif Modeli Kazanımları</span></div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="background:#334155; padding:8px 16px; border-radius:10px; font-size:13px; font-weight:700;">Okuma Hızı: 1.0x</div>
              <div style="background:#334155; padding:8px 16px; border-radius:10px; font-size:13px; font-weight:700;">⏮ Önceki Bölüm</div>
              <div style="background:#334155; padding:8px 16px; border-radius:10px; font-size:13px; font-weight:700;">⏭ Sonraki Bölüm</div>
              <div style="background:#2563eb; color:#fff; padding:8px 18px; border-radius:10px; font-size:13px; font-weight:800; cursor:pointer;">🎧 Cümle Takibi</div>
            </div>
          </div>
          <div style="margin-top:20px; background:#334155; height:8px; border-radius:9999px; overflow:hidden;">
            <div style="background:#38bdf8; width:42%; height:100%;"></div>
          </div>
        </div>

        <!-- MEB-KİT Robotik Kodlama ve Devre Entegrasyonu -->
        <div id="mebKitCapture" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:18px; padding:28px; margin-bottom:30px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.06);">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px; border-bottom:2px solid #f1f5f9; padding-bottom:14px;">
            <span style="font-size:26px;">🎒</span>
            <h3 style="margin:0; font-size:20px; color:#0f172a; font-weight:800;">MEB-KİT Robotik Kodlama ve Devre Entegrasyonu</h3>
            <span style="margin-left:auto; background:#fef3c7; color:#b45309; font-size:12px; font-weight:800; padding:4px 12px; border-radius:8px;">Maarif Modeli Uyumlu Devre & Kod</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1.2fr; gap:20px;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:18px;">
              <h4 style="margin:0 0 12px 0; color:#1e293b; font-size:15px; font-weight:700;">🔌 MEB-KİT Devre Bağlantı Şeması</h4>
              <ul style="margin:0; padding-left:20px; color:#334155; font-size:14px; line-height:1.8;">
                <li><strong>Toprak Nem Sensörü:</strong> Analog A0 Pini</li>
                <li><strong>DHT11 Sıcaklık Sensörü:</strong> Dijital D2 Pini</li>
                <li><strong>Servo Motor (Havalandırma):</strong> Dijital D9 Pini</li>
                <li><strong>Röle Modülü (Su Pompası):</strong> Dijital D8 Pini</li>
              </ul>
            </div>
            <div style="background:#0f172a; color:#e2e8f0; border-radius:12px; padding:18px; font-family:Consolas, Monaco, monospace; font-size:13px; line-height:1.6;">
              <span style="color:#38bdf8;">void</span> <span style="color:#fde047;">loop</span>() {<br/>
              &nbsp;&nbsp;<span style="color:#64748b;">// Sensör verilerini oku ve otomasyonu yürüt</span><br/>
              &nbsp;&nbsp;<span style="color:#f472b6;">if</span> (nem &lt; <span style="color:#a78bfa;">300</span>) { digitalWrite(<span style="color:#a78bfa;">8</span>, HIGH); }<br/>
              &nbsp;&nbsp;<span style="color:#f472b6;">if</span> (sicaklik &gt; <span style="color:#a78bfa;">28.0</span>) { servo.write(<span style="color:#a78bfa;">90</span>); }<br/>
              }
            </div>
          </div>
        </div>

        <!-- 3B Yazıcı Boyutlandırma ve Model Rehberliği -->
        <div id="printCapture" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:18px; padding:28px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.06);">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px; border-bottom:2px solid #f1f5f9; padding-bottom:14px;">
            <span style="font-size:26px;">🖨️</span>
            <h3 style="margin:0; font-size:20px; color:#0f172a; font-weight:800;">3B Yazıcı Model Kütüphaneleri & Boyutlandırma Rehberi</h3>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
            <div style="background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; padding:8px 14px; border-radius:10px; font-size:14px; font-weight:700;">🔍 Thingiverse: "smart greenhouse bracket"</div>
            <div style="background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; padding:8px 14px; border-radius:10px; font-size:14px; font-weight:700;">🔍 Tinkercad: "plant sensor mount"</div>
            <div style="background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; padding:8px 14px; border-radius:10px; font-size:14px; font-weight:700;">🔍 Creality Cloud: "funnel pot 3d"</div>
          </div>
          <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:12px; padding:16px; color:#14532d; font-size:14px; line-height:1.6;">
            <strong>📏 MEB Laboratuvarı & Creality K1C Uyumluluğu:</strong> Maksimum 220 x 220 x 250 mm baskı hacmi içinde modüler parçalar olarak tasarlanması önerilmiştir.
          </div>
        </div>

      </div>
    `;
  });

  const audioEl = await page.$('#audioBarCapture');
  if (audioEl) {
    await audioEl.screenshot({ path: path.join(OUTPUT_DIR, 'Gorsel_3_Kapsayici_Sesli_Okuyucu_Paneli.png') });
  }

  const mebEl = await page.$('#mebKitCapture');
  if (mebEl) {
    await mebEl.screenshot({ path: path.join(OUTPUT_DIR, 'Gorsel_4_MEBKIT_Robotik_Devre_ve_Kod.png') });
  }

  const printEl = await page.$('#printCapture');
  if (printEl) {
    await printEl.screenshot({ path: path.join(OUTPUT_DIR, 'Gorsel_5_3B_Yazici_Rehberi_ve_Model_Arama.png') });
  }

  // 6. Gelecek Vizyonu & Yol Haritası (Roadmap)
  console.log('6. Sürdürülebilirlik & Yol Haritası çiziliyor...');
  await page.evaluate(() => {
    document.body.innerHTML = `
      <div style="width:1200px; margin:0 auto; padding:40px; background:#0f172a; color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-sizing:border-box;">
        <div style="text-align:center; margin-bottom:36px;">
          <div style="color:#38bdf8; font-weight:800; font-size:14px; text-transform:uppercase; letter-spacing:2px; margin-bottom:6px;">T.C. Millî Eğitim Bakanlığı — Kristal Meşale 2026</div>
          <h1 style="margin:0; font-size:28px; font-weight:800; color:#ffffff;">Geleceğin Eğitim Senaryosu: Sürdürülebilirlik & Yerli LLM Yol Haritası</h1>
          <p style="color:#94a3b8; font-size:15px; margin-top:6px;">Yenilikçi Sınıf Eğitim Atölyesi — Geliştirme ve Ulusal Yaygınlaştırma Modeli</p>
        </div>

        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:20px;">
          <!-- Faz 1 -->
          <div style="background:#1e293b; border:2px solid #22c55e; border-radius:16px; padding:22px; position:relative;">
            <div style="position:absolute; top:-13px; left:18px; background:#22c55e; color:#0f172a; font-weight:800; font-size:11px; padding:4px 10px; border-radius:9999px;">FAZ 1: TAMAMLANDI ✅</div>
            <h3 style="color:#4ade80; font-size:18px; margin:12px 0 10px 0;">Çalışan Prototip & Web Mimarisi</h3>
            <ul style="color:#cbd5e1; font-size:13px; line-height:1.7; padding-left:16px; margin:0;">
              <li>Yapay zekâ ile Maarif Modeli uyumlu aktif öğrenme senaryoları üretimi.</li>
              <li>İnteraktif 2D Esnek Sınıf Yerleşim Editörü.</li>
              <li>Görme engelli öğretmenler için Dahili Sesli Okuyucu (Audio Narrator).</li>
              <li>MEB-KİT devre/kod ve 3B yazıcı arama entegrasyonu.</li>
              <li>Sıfır veri depolama ile tam KVKK / e-Güvenlik uyumu.</li>
            </ul>
          </div>

          <!-- Faz 2 -->
          <div style="background:#1e293b; border:2px solid #38bdf8; border-radius:16px; padding:22px; position:relative;">
            <div style="position:absolute; top:-13px; left:18px; background:#38bdf8; color:#0f172a; font-weight:800; font-size:11px; padding:4px 10px; border-radius:9999px;">FAZ 2: YAKIN GELECEK 🚀</div>
            <h3 style="color:#38bdf8; font-size:18px; margin:12px 0 10px 0;">TÜBİTAK BİLGE & MEB Entegrasyonu</h3>
            <ul style="color:#cbd5e1; font-size:13px; line-height:1.7; padding-left:16px; margin:0;">
              <li>Türkiye'nin yerli büyük dil modeli <strong>TÜBİTAK BİLGE</strong> API bağlantısı.</li>
              <li>EBA ve ÖBA portalına doğrudan eklenti (Widget) entegrasyonu.</li>
              <li>MEB müfredat kazanım veritabanının otomatik senkronizasyonu.</li>
              <li>Fatih Etkileşimli Tahtalar için yerel çevrim dışı çalışma desteği.</li>
            </ul>
          </div>

          <!-- Faz 3 -->
          <div style="background:#1e293b; border:2px solid #a855f7; border-radius:16px; padding:22px; position:relative;">
            <div style="position:absolute; top:-13px; left:18px; background:#a855f7; color:#ffffff; font-weight:800; font-size:11px; padding:4px 10px; border-radius:9999px;">FAZ 3: ULUSAL YAYGINLAŞTIRMA 🌐</div>
            <h3 style="color:#c084fc; font-size:18px; margin:12px 0 10px 0;">81 İl Yenilikçi Öğretmen Ağı</h3>
            <ul style="color:#cbd5e1; font-size:13px; line-height:1.7; padding-left:16px; margin:0;">
              <li>81 İldeki Yenilikçi Sınıflar ve BİLSEM'lerde pilot uygulamalar.</li>
              <li>Öğretmenler arası açık kaynak senaryo ve yerleşim planı kütüphanesi.</li>
              <li>Ek bütçe ve sunucu maliyeti gerektirmeyen %100 sürdürülebilir yapı.</li>
              <li>Ulusal ve uluslararası eğitim konferanslarında iyi uygulama modeli.</li>
            </ul>
          </div>
        </div>

        <div style="margin-top:24px; background:#1e293b; border:1px solid #334155; border-radius:12px; padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">
          <div style="color:#94a3b8; font-size:13px;">💡 <strong>Sürdürülebilirlik Güvencesi:</strong> İstemci tabanlı (client-side) mimari sayesinde sunucu bakım maliyeti sıfırdır.</div>
          <div style="color:#38bdf8; font-size:13px; font-weight:700;">Millî Teknoloji Hamlesi Uyumlu</div>
        </div>
      </div>
    `;
  });

  await page.setViewport({ width: 1200, height: 620, deviceScaleFactor: 2 });
  await page.screenshot({
    path: path.join(OUTPUT_DIR, 'Gorsel_6_Surdurulebilirlik_ve_Yerli_LLM_Yol_Haritasi.png'),
    fullPage: true
  });

  await browser.close();
  console.log('Tüm görseller başarıyla oluşturuldu!');
}

run().catch(console.error);
