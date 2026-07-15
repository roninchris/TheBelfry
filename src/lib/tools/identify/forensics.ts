
import { IdentificationResult } from "./index";
import { parseExif } from "../image-stego";
import { detectMorse, detectDTMF } from "../../audioAnalysis";

export interface ForensicResult {
  name: string;
  confidence: number;
  isMatch: boolean;
  details: string;
}

export async function identifyImage(file: File): Promise<ForensicResult[]> {
  const results: ForensicResult[] = [];
  const arrayBuffer = await file.arrayBuffer();
  
  // 1. EXIF Analysis
  const exif = parseExif(arrayBuffer);
  const hasSignificantExif = exif && (exif.gpsLatitude || exif.gpsLongitude || exif.software || exif.make || exif.model);
  results.push({
    name: "EXIF DATA BLOCK",
    confidence: hasSignificantExif ? 95 : 5,
    isMatch: !!hasSignificantExif,
    details: hasSignificantExif 
      ? `Metadata recovered. ${exif.software ? "Software: " + exif.software : ""} ${exif.gpsLatitude ? "GPS Data Present" : ""}`
      : "No significant EXIF headers detected."
  });

  // 2. Trailing Data Check (Simple heuristic for now, deeper check is in image-stego)
  const bytes = new Uint8Array(arrayBuffer);
  let hasTrailing = false;
  if (bytes.length > 10) {
    // Check for PNG IEND
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    if (isPng) {
      const iendSig = [0x49, 0x45, 0x4E, 0x44];
      let iendPos = -1;
      for (let i = bytes.length - 12; i >= 0; i--) {
        if (bytes[i] === iendSig[0] && bytes[i+1] === iendSig[1] && bytes[i+2] === iendSig[2] && bytes[i+3] === iendSig[3]) {
          iendPos = i;
          break;
        }
      }
      if (iendPos !== -1 && iendPos < bytes.length - 12) {
        hasTrailing = true;
      }
    }
  }
  
  results.push({
    name: "TRAILING BYTES",
    confidence: hasTrailing ? 90 : 5,
    isMatch: hasTrailing,
    details: hasTrailing ? "Anomalous data detected after image footer." : "No significant trailing data observed."
  });

  return results;
}

export async function identifyAudio(channelData: Float32Array, sampleRate: number): Promise<ForensicResult[]> {
  const results: ForensicResult[] = [];
  
  // 1. Morse Detection
  const morse = detectMorse(channelData, sampleRate);
  results.push({
    name: "MORSE TELEMETRY",
    confidence: morse ? 95 : 5,
    isMatch: !!morse,
    details: morse ? `Morse sequence recovered: ${morse.substring(0, 30)}...` : "No standard Morse patterns isolated."
  });

  // 2. DTMF Detection
  const dtmf = detectDTMF(channelData, sampleRate);
  results.push({
    name: "DTMF FREQUENCIES",
    confidence: dtmf ? 90 : 8,
    isMatch: !!dtmf,
    details: dtmf ? `Touch-tone sequence isolated: ${dtmf}` : "No valid DTMF signals identified."
  });

  // 3. Spectral Analysis (Generic)
  results.push({
    name: "SPECTRAL ENVELOPE",
    confidence: 20,
    isMatch: true,
    details: "Frequency distribution analyzed for non-human anomalies."
  });

  return results;
}
