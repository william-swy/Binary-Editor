export function toHex(arr: Uint8Array): String {
  return Buffer.from(arr).toString("hex");
}

export function fromHex(str: String): Uint8Array {
  return Uint8Array.from(Buffer.from(str, "hex"));
}
