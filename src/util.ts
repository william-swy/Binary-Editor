export function toHex(arr: Uint8Array): String {
  return Buffer.from(arr).toString("hex");
}
