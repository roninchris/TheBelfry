/** Base64 encode/decode — relocated from EncodingLab.tsx */
export function safeBtoa(str: string): string {
  try {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      })
    );
  } catch {
    return "ERROR: Unencodable bytes";
  }
}

export function safeAtob(str: string): string {
  try {
    return decodeURIComponent(
      atob(str)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return "ERROR: Invalid Base64 stream";
  }
}

export const base64Encode = safeBtoa;
export const base64Decode = safeAtob;
