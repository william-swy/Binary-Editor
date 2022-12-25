export function toHex(arr: Uint8Array): string {
  return Buffer.from(arr).toString("hex");
}

export function fromHex(str: String): Uint8Array {
  return Uint8Array.from(Buffer.from(str, "hex"));
}

// Splits a hexadecimal string into strings that represent a byte
// If `str` length is not a multiple of two, the remainder chunk 
// will not be returned.
//
// Modified from: https://stackoverflow.com/a/29202760
export function splitHexStringToByteChunks(str: string): string[] {
  const chunkSize = 2;
  const numChunks = Math.floor(str.length / chunkSize);
  const chunks = new Array(numChunks);

  for (let i = 0, o = 0; i < numChunks; ++i, o += chunkSize) {
    chunks[i] = str.substring(o, o + chunkSize);
  }

  return chunks;
}

const hexStringRegex = /^([0-9a-f])+$/;

export function isHexString(str: string): boolean {
    return hexStringRegex.test(str);
}

export function isHexDigit(str: string): boolean {
    return (str.length === 1) && isHexString(str);
}

export function isByteStringArr(strArr: string[]): boolean {
  for (const elem of strArr) {
    if ((!isHexString(elem)) || (elem.length !== 2)) {
      return false;
    }
  }
  return true;
}

export function debounce(func: () => void, timeout: number){
  let timer: NodeJS.Timeout;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(func, timeout);
  };
}