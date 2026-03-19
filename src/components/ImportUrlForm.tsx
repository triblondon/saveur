"use client";

import dynamic from "next/dynamic";
import { mdiQrcodeScan } from "@mdi/js";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Result as QrResult } from "@zxing/library";
import { BarcodeStringFormat } from "react-qr-barcode-scanner";
import styles from "@/components/styles/import-url-form.module.css";

const BarcodeScanner = dynamic(() => import("react-qr-barcode-scanner"), { ssr: false });

interface ImportResponse {
  recipeId: string;
  importRunId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  usable: boolean;
  warnings: string[];
  adapter: string;
}

export function ImportUrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [stopScannerStream, setStopScannerStream] = useState(false);
  const scanResolvedRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function detectCamera() {
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices || !mediaDevices.getUserMedia) {
        if (active) {
          setHasCamera(false);
        }
        return;
      }

      if (!mediaDevices.enumerateDevices) {
        if (active) {
          setHasCamera(true);
        }
        return;
      }

      try {
        const devices = await mediaDevices.enumerateDevices();
        if (!active) {
          return;
        }

        const hasVideoInput = devices.some((device) => device.kind === "videoinput");
        setHasCamera(hasVideoInput || Boolean(mediaDevices.getUserMedia));
      } catch {
        if (active) {
          setHasCamera(true);
        }
      }
    }

    void detectCamera();
    return () => {
      active = false;
    };
  }, []);

  function closeScanner() {
    setStopScannerStream(true);
    window.setTimeout(() => {
      setScannerOpen(false);
      setStopScannerStream(false);
    }, 0);
  }

  function openScanner() {
    scanResolvedRef.current = false;
    setScannerError(null);
    setStopScannerStream(false);
    setScannerOpen(true);
  }

  function onScanUpdate(_: unknown, code?: QrResult) {
    if (!code || scanResolvedRef.current) {
      return;
    }

    const scanned = code.getText().trim();
    if (!scanned) {
      return;
    }

    scanResolvedRef.current = true;
    setUrl(scanned);
    setScannerError(null);
    closeScanner();
  }

  function onScanError(scanError: string | DOMException) {
    const message =
      scanError instanceof DOMException && scanError.name === "NotAllowedError"
        ? "Camera access was denied. Allow camera access to scan QR codes."
        : "Unable to access camera for QR scanning.";

    setScannerError(message);
    closeScanner();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/import/url", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          url,
          prompt: prompt.trim() || null
        })
      });

      const payload = (await response.json()) as ImportResponse | { error?: string };
      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Import failed");
        return;
      }

      const importResult = payload as ImportResponse;
      setResult(importResult);

      if (importResult.recipeId) {
        router.push(`/recipes/${importResult.recipeId}`);
        router.refresh();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={`card ${styles.form}`} onSubmit={onSubmit}>
      <label className={styles.fieldLabel} htmlFor="sourceUrl">
        Recipe URL
      </label>
      <div className={styles.urlInputWrap}>
        <input
          className={styles.urlInput}
          id="sourceUrl"
          type="url"
          value={url}
          required
          placeholder="https://www.example.com/cookbook/..."
          onChange={(event) => setUrl(event.target.value)}
        />
        {hasCamera ? (
          <button
            type="button"
            className={styles.scanButton}
            onClick={openScanner}
            aria-label="Scan QR code"
            title="Scan QR code"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d={mdiQrcodeScan} />
            </svg>
          </button>
        ) : null}
      </div>
      {scannerOpen ? (
        <div className={styles.scannerPanel}>
          <div className={styles.scannerHeader}>
            <p className={styles.scannerTitle}>Scan recipe URL QR code</p>
            <button type="button" className={`secondary ${styles.closeScannerButton}`} onClick={closeScanner}>
              Close
            </button>
          </div>
          <div className={styles.scannerViewport}>
            <BarcodeScanner
              width="100%"
              height={260}
              facingMode="environment"
              stopStream={stopScannerStream}
              delay={250}
              formats={[BarcodeStringFormat.QR_CODE]}
              onUpdate={onScanUpdate}
              onError={onScanError}
            />
          </div>
          <p className={`muted ${styles.scannerHint}`}>Point the camera at a QR code containing a URL.</p>
        </div>
      ) : null}
      {scannerError ? <p className={styles.error}>{scannerError}</p> : null}
      <label className={styles.fieldLabel} htmlFor="importPrompt">
        Import prompt (optional)
      </label>
      <textarea
        className={styles.promptField}
        id="importPrompt"
        rows={4}
        value={prompt}
        placeholder="e.g. Prefer shorter cook steps and include explicit prep for sauces."
        onChange={(event) => setPrompt(event.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Importing..." : "Import recipe"}
      </button>

      {error ? <p className={styles.error}>{error}</p> : null}
      {result ? (
        <div className={styles.result}>
          <p className={styles.resultLine}>
            Import status: {result.status} ({result.adapter})
          </p>
          {result.warnings.length ? (
            <p className={styles.resultLine}>Warnings: {result.warnings.join("; ")}</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
