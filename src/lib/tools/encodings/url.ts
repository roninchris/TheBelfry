/** URL percent encoding — relocated from EncodingLab.tsx */
export function urlEncode(str: string): string {
  return encodeURIComponent(str);
}

export function urlDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return "ERROR: URL Decode Failed";
  }
}
