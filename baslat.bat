@echo off
title Yenilikci Sinif Egitim Atolyesi Planlayicisi
cd /d "%~dp0"

echo ======================================================================
echo           YENILIKCI SINIF EGITIM ATOLYESI PLANLAYICISI
echo ======================================================================
echo.
echo [1/2] Uygulama sunucusu baslatiliyor...
echo [2/2] Tarayiciniz otomatik olarak acilacaktir...
echo.
echo Uygulamayi kapatmak icin bu pencereyi kapatabilirsiniz.
echo ======================================================================
echo.

call npm run dev -- --open

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [HATA] Uygulama baslatilamadi.
    pause
)
