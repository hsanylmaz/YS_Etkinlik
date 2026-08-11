const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUTPUT_DIR = 'C:\\Users\\hasan\\Desktop\\ekler';

async function generateRoadmap() {
  console.log('Yol Haritası görseli yeniden oluşturuluyor...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    defaultViewport: { width: 1280, height: 680, deviceScaleFactor: 2 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  await page.setContent(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
          background: linear-gradient(135deg, #090d16 0%, #0f172a 50%, #131d35 100%);
          color: #f8fafc;
          padding: 40px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .container {
          width: 1200px;
        }
        .header {
          text-align: center;
          margin-bottom: 36px;
        }
        .header .badge {
          display: inline-block;
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 6px 16px;
          border-radius: 9999px;
          margin-bottom: 12px;
        }
        .header h1 {
          font-size: 30px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.5px;
        }
        .header p {
          color: #94a3b8;
          font-size: 16px;
          margin-top: 6px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          position: relative;
        }
        .card {
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(12px);
          border-radius: 20px;
          padding: 28px 24px;
          position: relative;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
          transition: all 0.3s ease;
        }
        .card-green {
          border: 2px solid #22c55e;
          box-shadow: 0 0 25px -5px rgba(34, 197, 94, 0.2);
        }
        .card-blue {
          border: 2px solid #3b82f6;
          box-shadow: 0 0 25px -5px rgba(59, 130, 246, 0.2);
        }
        .card-yellow {
          border: 2px solid #eab308;
          box-shadow: 0 0 25px -5px rgba(234, 179, 8, 0.2);
        }
        .phase-tag {
          position: absolute;
          top: -14px;
          left: 20px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
          padding: 5px 14px;
          border-radius: 9999px;
          text-transform: uppercase;
        }
        .tag-green { background: #22c55e; color: #052e16; }
        .tag-blue { background: #3b82f6; color: #082f49; }
        .tag-yellow { background: #eab308; color: #422006; }
        
        .phase-icon {
          font-size: 32px;
          margin-top: 8px;
          margin-bottom: 12px;
        }
        .card-title {
          font-size: 19px;
          font-weight: 800;
          margin-bottom: 14px;
          line-height: 1.3;
        }
        .title-green { color: #4ade80; }
        .title-blue { color: #60a5fa; }
        .title-yellow { color: #fde047; }
        
        .card-content {
          color: #cbd5e1;
          font-size: 14px;
          line-height: 1.7;
          flex-grow: 1;
        }
        .card-content ul {
          padding-left: 18px;
          margin-top: 8px;
        }
        .card-content li {
          margin-bottom: 8px;
        }
        
        .footer-banner {
          margin-top: 28px;
          background: rgba(30, 41, 59, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 14px;
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .footer-banner .info {
          font-size: 13.5px;
          color: #94a3b8;
        }
        .footer-banner .info strong {
          color: #f1f5f9;
        }
        .footer-banner .tag {
          background: #1e3a8a;
          color: #bfdbfe;
          border: 1px solid #3b82f6;
          font-size: 12px;
          font-weight: 800;
          padding: 4px 12px;
          border-radius: 8px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        
        <div class="header">
          <div class="badge">T.C. Millî Eğitim Bakanlığı — Kristal Meşale 2026</div>
          <h1>3 Aşamalı Entegrasyon & Yol Haritası İnfografiği</h1>
          <p>Yenilikçi Sınıf Eğitim Atölyesi: Sürdürülebilir Gelecek Vizyonu</p>
        </div>

        <div class="grid">
          
          <!-- FAZ 1 -->
          <div class="card card-green">
            <div class="phase-tag tag-green">FAZ 1: TAMAMLANDI</div>
            <div class="phase-icon">🟢</div>
            <div class="card-title title-green">Mevcut Durum & Çalışan Prototip</div>
            <div class="card-content">
              <strong>Web Tabanlı Çalışan Prototip:</strong>
              <ul>
                <li>Tarayıcıda güvenli istemci mimarisi (localStorage ile sıfır veri sızıntısı).</li>
                <li>Google Gemini API entegrasyonu ile anlık pedagojik senaryo üretimi.</li>
                <li>2D Sınıf Yerleşim Editörü ve Dahili Sesli Okuyucu (Audio Narrator).</li>
                <li>MEB-KİT devre & 3B yazıcı boyutlandırma rehberliği.</li>
              </ul>
            </div>
          </div>

          <!-- FAZ 2 -->
          <div class="card card-blue">
            <div class="phase-tag tag-blue">FAZ 2: YAYGINLAŞTIRMA</div>
            <div class="phase-icon">🔵</div>
            <div class="card-title title-blue">Ulusal Yaygınlaştırma</div>
            <div class="card-content">
              <strong>81 İldeki Yenilikçi Sınıflar:</strong>
              <ul>
                <li>81 İldeki "Yenilikçi Sınıflar" ve BİLSEM öğretmenlerinin doğrudan kullanımına sunum.</li>
                <li>Açık kaynaklı ve ek bütçe/sunucu maliyeti gerektirmeyen sürdürülebilir altyapı.</li>
                <li>Öğretmenler arası aktif öğrenme ve esnek sınıf yerleşim senaryo kütüphanesi.</li>
                <li>Öğretmen Bilişim Ağı (ÖBA) ve EBA ile eşgüdümlü paylaşım ortamı.</li>
              </ul>
            </div>
          </div>

          <!-- FAZ 3 -->
          <div class="card card-yellow">
            <div class="phase-tag tag-yellow">FAZ 3: MİLLÎ TEKNOLOJİ</div>
            <div class="phase-icon">🟡</div>
            <div class="card-title title-yellow">Millî Teknoloji Hamlesi</div>
            <div class="card-content">
              <strong>TÜBİTAK BİLGE Entegrasyonu:</strong>
              <ul>
                <li>Türkçe dil yapısına ve kültürel birikimimize özgü <strong>TÜBİTAK BİLGE (Yerli Dil Modeli)</strong> API entegrasyonu.</li>
                <li>Türkiye Yüzyılı Maarif Modeli kazanımlarıyla %100 yerli ve millî yapay zekâ uyumu.</li>
                <li>Fatih Projesi Etkileşimli Tahtalar ile tam uyumlu çevrim içi/çevrim dışı ekosistem.</li>
                <li>Dışa bağımlılığı sonlandıran güvenli ve millî eğitim teknolojisi modeli.</li>
              </ul>
            </div>
          </div>

        </div>

        <div class="footer-banner">
          <div class="info">💡 <strong>Sürdürülebilirlik Güvencesi:</strong> İstemci tabanlı açık kaynak mimari ile ek sunucu/bakım bütçesi gerektirmeden kesintisiz hizmet sunar.</div>
          <div class="tag">Türkiye Yüzyılı Maarif Modeli Vizyonu</div>
        </div>

      </div>
    </body>
    </html>
  `);

  await page.screenshot({
    path: path.join(__dirname, '..', 'yol_haritasi.png'),
    fullPage: false
  });

  await browser.close();
  console.log('yol_haritasi.png başarıyla oluşturuldu!');
}

generateRoadmap().catch(console.error);
