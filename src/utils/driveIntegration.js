// src/utils/driveIntegration.js

export const driveFolderUrl = "https://drive.google.com/drive/folders/1O3TVQP_i8sZfpBStbSlgwZk3U7kL0du3?usp=drive_link";
export const appsScriptUrl = "https://script.google.com/macros/s/AKfycbwoVzgixP13K7r6i-Wt0DBDsROWJT0VW9NYy6g6cIlAyfHhvionjeUuj9WmvhDh-bxPkQ/exec";

export async function uploadToGoogleDrive(base64Docx, filename) {
    if (!appsScriptUrl) {
        throw new Error("Google Apps Script URL'si yapılandırılmamış.");
    }
    
    const response = await fetch(appsScriptUrl, {
        method: "POST",
        mode: "cors",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
            action: "upload",
            filename: filename,
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            base64Data: base64Docx
        })
    });
    
    if (!response.ok) {
        throw new Error("Apps Script Web Uygulaması yanıt vermedi.");
    }
    
    const res = await response.json();
    if (res.status !== "success") {
        throw new Error(res.message || "Bilinmeyen hata");
    }
    
    return {
        url: res.url,
        fileId: res.fileId,
        deleteToken: res.deleteToken
    };
}

export async function deleteFromGoogleDrive(fileId, deleteToken) {
    if (!appsScriptUrl) {
        throw new Error("Google Apps Script URL'si yapılandırılmamış.");
    }
    
    const response = await fetch(appsScriptUrl, {
        method: "POST",
        mode: "cors",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
            action: "delete",
            fileId: fileId,
            deleteToken: deleteToken
        })
    });
    
    if (!response.ok) {
        throw new Error("Apps Script Web Uygulaması yanıt vermedi.");
    }
    
    const res = await response.json();
    if (res.status !== "success") {
        throw new Error(res.message || "Bilinmeyen hata");
    }
    
    return true;
}

export async function getNextFileNumber(outcomeCode) {
    if (!appsScriptUrl) {
        return 1;
    }
    try {
        const response = await fetch(appsScriptUrl, {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
                action: "getNextNumber",
                outcomeCode: outcomeCode
            })
        });
        if (response.ok) {
            const res = await response.json();
            if (res.status === "success" && typeof res.nextNumber === "number") {
                return res.nextNumber;
            }
        }
    } catch (e) {
        console.warn("Failed to get next number from Drive, using local fallback", e);
    }
    
    // Fallback: LocalStorage counter
    const localCounters = JSON.parse(localStorage.getItem("drive_outcome_counters") || "{}");
    const currentVal = localCounters[outcomeCode] || 0;
    const nextVal = currentVal + 1;
    return nextVal;
}

export function incrementLocalCounter(outcomeCode, finalNumber) {
    try {
        const localCounters = JSON.parse(localStorage.getItem("drive_outcome_counters") || "{}");
        localCounters[outcomeCode] = Math.max(localCounters[outcomeCode] || 0, finalNumber);
        localStorage.setItem("drive_outcome_counters", JSON.stringify(localCounters));
    } catch (e) {
        console.error("Failed to save local counter", e);
    }
}
