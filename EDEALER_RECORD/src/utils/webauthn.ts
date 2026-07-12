import base64url from 'base64url';

/**
 * Encodes a Buffer or Uint8Array to base64url string (no padding).
 */
export function toBase64url(buffer: Buffer | Uint8Array): string {
  return base64url.encode(Buffer.from(buffer));
}

/**
 * Decodes a base64url string to a Buffer (for binary data such as public keys).
 */
export function fromBase64url(str: string): Buffer {
  return base64url.toBuffer(str);
}

/**
 * Parses clientDataJSON from a WebAuthn response to extract the challenge.
 * Used to look up the server-side stored challenge during verification.
 */
export function parseChallengeFromClientDataJSON(clientDataJSONBase64: string): string {
  const json = base64url.decode(clientDataJSONBase64);
  const clientData = JSON.parse(json) as { challenge?: string };
  if (!clientData.challenge) {
    throw new Error('Missing challenge in clientDataJSON');
  }
  return clientData.challenge;
}
