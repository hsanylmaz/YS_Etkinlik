// src/utils/geminiApi.js

export async function callGeminiText(systemText, userText, apiKey, retryCount = 0, errorList = [], pdfBase64 = null) {
    if (!apiKey) {
        throw new Error("Gemini API anahtarı eksik. Lütfen Ayarlar panelinden geçerli bir API anahtarı tanımlayın.");
    }
    
    // Fallback chain prioritizing the latest models (3.5 -> 3.1 -> 2.5 -> 2.0 -> latest)
    let modelName = "gemini-3.5-flash";
    if (retryCount === 1) {
        modelName = "gemini-3.1-flash-lite";
    } else if (retryCount === 2) {
        modelName = "gemini-2.5-flash";
    } else if (retryCount === 3) {
        modelName = "gemini-2.0-flash";
    } else if (retryCount >= 4) {
        modelName = "gemini-flash-latest";
    }
    
    // Using v1beta for modern model compatibility
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    // Prepend system instructions to the main content for maximum cross-version compatibility
    const combinedText = `[SİSTEM TALİMATLARI - PEDAGOJİK VE YAZIMSAL KURALLAR]\n${systemText}\n\n[KULLANICI TALEBİ VE GİRDİLERİ]\n${userText}`;
    
    const parts = [{ text: combinedText }];
    if (pdfBase64) {
        parts.push({
            inlineData: {
                mimeType: "application/pdf",
                data: pdfBase64
            }
        });
    }

    const payload = { 
        contents: [{ parts }]
    };
    
    // 90-second timeout using AbortController (gives ample time for generating long lesson plans even under heavy load)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    
    try {
        const response = await fetch(url, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            let errMsg = `HTTP Hatası: ${response.status}`;
            let isRetryable = true;
            
            // Client errors like 400 (Bad Request) or 403 (Forbidden) are not retryable (except rate limit 429)
            if ((response.status === 400 || response.status === 403) && response.status !== 429) {
                isRetryable = false;
            }
            
            try {
                const errJson = await response.json();
                if (errJson.error && errJson.error.message) {
                    errMsg = errJson.error.message;
                }
            } catch(e) {}
            
            const error = new Error(errMsg);
            error.isRetryable = isRetryable;
            throw error;
        }
        
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text || "İçerik oluşturulamadı.";
    } catch (error) {
        clearTimeout(timeoutId);
        
        const isTimeout = error.name === 'AbortError';
        const errMessage = isTimeout 
            ? "Zaman aşımı (90 sn)" 
            : error.message;
            
        const failedInfo = `${modelName}: ${errMessage}`;
        const newErrorList = [...errorList, failedInfo];
        
        console.warn(`Gemini API Try #${retryCount + 1} (${modelName}) failed: ${errMessage}`);
 
        // If the error is explicitly marked as non-retryable (like 400/403), throw it immediately
        if (error.isRetryable === false) {
            throw new Error(failedInfo);
        }
 
        if (retryCount < 4) { // Allow up to 4 retries (5 models tried in total)
            // Wait 2.5 seconds and retry with fallback model to bypass rate limiting
            await new Promise(resolve => setTimeout(resolve, 2500));
            return callGeminiText(systemText, userText, apiKey, retryCount + 1, newErrorList, pdfBase64);
        }
        
        // If all retries failed, throw a comprehensive diagnostic error
        throw new Error(`Tüm denemeler başarısız oldu:\n• ${newErrorList.join('\n• ')}`);
    }
}
