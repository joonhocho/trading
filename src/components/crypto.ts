// convert ArrayBuffer to Array to hex
export const hashBufferToHex = (hashBuffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(hashBuffer))
    .map((b) => ("00" + b.toString(16)).slice(-2))
    .join("");

// https://stackoverflow.com/a/48161723/692528
export const sha256 = async (message: string): Promise<string> => {
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message);

  // hash the message
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

  return hashBufferToHex(hashBuffer);
};

export const hmacSha256 = async (
  message: string,
  secret: string,
): Promise<string> => {
  // encoder to convert string to Uint8Array
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw", // raw format of the key - should be Uint8Array
    enc.encode(secret),
    {
      // algorithm details
      name: "HMAC",
      hash: { name: "SHA-256" },
    },
    false, // export = false
    ["sign", "verify"], // what this key can do
  );

  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));

  return hashBufferToHex(signature);
};
