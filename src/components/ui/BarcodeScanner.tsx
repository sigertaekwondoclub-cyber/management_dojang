'use client'

import { useEffect, useRef, useCallback } from 'react'

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void
  onScanError?: (error: string) => void
  isActive: boolean
}

export function BarcodeScanner({ onScanSuccess, onScanError, isActive }: BarcodeScannerProps) {
  const scannerRef = useRef<any>(null)
  const elementId = 'barcode-scanner-container'

  const startScanner = useCallback(async () => {
    const { Html5Qrcode } = await import('html5-qrcode')
    
    if (scannerRef.current) return

    const scanner = new Html5Qrcode(elementId)
    scannerRef.current = scanner

    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText: string) => {
          onScanSuccess(decodedText)
        },
        (errorMsg: string) => {
          // Silent: ini terjadi setiap frame yang tidak terdeteksi, normal
        }
      )
    } catch (err: any) {
      onScanError?.(err?.message || 'Gagal membuka kamera')
      scannerRef.current = null
    }
  }, [onScanSuccess, onScanError])

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch (_) {}
      scannerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isActive) {
      startScanner()
    } else {
      stopScanner()
    }
    return () => {
      stopScanner()
    }
  }, [isActive, startScanner, stopScanner])

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Scanner viewport */}
      <div
        id={elementId}
        className="w-full max-w-sm overflow-hidden border-[3px] border-dark shadow-[4px_4px_0px_#1E2A38] bg-dark"
        style={{ minHeight: 280 }}
      />
      {isActive && (
        <div className="flex items-center gap-2 text-sm font-sans text-dark/70 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-accent inline-block" />
          Kamera aktif — arahkan QR kartu anggota ke kamera
        </div>
      )}
    </div>
  )
}
