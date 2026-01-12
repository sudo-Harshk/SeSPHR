export async function getSRSKey(): Promise<CryptoKey> {
  const response = await fetch("/api/srs/public-key");
  if (!response.ok) {
    throw new Error("Failed to fetch SRS Public Key");
  }
  const data = await response.json();
  const pem = data.data.public_key;

  // content, keys
  const pemHeader = "-----BEGIN PUBLIC KEY-----";
  const pemFooter = "-----END PUBLIC KEY-----";
  const pemContents = pem.substring(
    pem.indexOf(pemHeader) + pemHeader.length,
    pem.indexOf(pemFooter)
  );

  // base64 decode
  const binaryDerString = window.atob(pemContents.replace(/\s/g, ""));
  // convert to array buffer
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return window.crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
}

export async function generateAESKey(): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptFile(
  file: File,
  key: CryptoKey
): Promise<{ encryptedBlob: Blob; iv: string }> {
  // Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();

  // Generate IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    fileBuffer
  );

  // Convert IV to Hex for transport
  const ivArray = Array.from(iv);
  const ivHex = ivArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    encryptedBlob: new Blob([encryptedBuffer]),
    iv: ivHex
  };
}

export async function wrapKey(
  aesKey: CryptoKey,
  wrappingKey: CryptoKey
): Promise<string> {
  // Export AES key to raw bytes
  const rawKey = await window.crypto.subtle.exportKey("raw", aesKey);

  // Encrypt (Wrap) the AES key with SRS Public Key
  const wrappedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP"
    },
    wrappingKey,
    rawKey
  );

  // Convert to Hex string for JSON transport
  const wrappedArray = Array.from(new Uint8Array(wrappedBuffer));
  return wrappedArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // 1. Remove header/footer and spaces
  // Regex to extract the Base64 body between headers
  // Matches "-----BEGIN ...-----" \n (body) \n "-----END ...-----"
  const match = pem.match(/-----BEGIN.*?KEY-----([\s\S]*)-----END.*?KEY-----/);
  let pemContents = "";

  if (match && match[1]) {
    pemContents = match[1];
  } else {
    // If no header found, assume it might be raw base64 or try to strip known headers manually
    // But regex should catch usually.
    pemContents = pem;
  }

  // base64 decode
  const binaryDerString = window.atob(pemContents.replace(/\s/g, ""));
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return window.crypto.subtle.importKey(
    "pkcs8", // Private keys are usually PKCS8
    binaryDer.buffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-1", // Changed to SHA-1 for better PyCryptodome compatibility
    },
    true,
    ["decrypt"]
  );
}

export async function unwrapKey(
  encryptedKeyHex: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  // Convert hex string to ArrayBuffer
  const encryptedBytes = new Uint8Array(
    encryptedKeyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  // Decrypt the AES Key bytes using RSA Private Key
  const aesKeyBytes = await window.crypto.subtle.decrypt(
    {
      name: "RSA-OAEP"
    },
    privateKey,
    encryptedBytes
  );

  // Import the raw AES bytes back into a CryptoKey
  return window.crypto.subtle.importKey(
    "raw",
    aesKeyBytes,
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function decryptFile(
  encryptedBlob: Blob,
  aesKey: CryptoKey,
  ivHex: string
): Promise<Blob> {
  // Convert IV Hex to Uint8Array
  const iv = new Uint8Array(
    ivHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  // Get Encrypted Bytes
  const encryptedBuffer = await encryptedBlob.arrayBuffer();

  // Decrypt
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    aesKey,
    encryptedBuffer
  );

  return new Blob([decryptedBuffer]);
}
