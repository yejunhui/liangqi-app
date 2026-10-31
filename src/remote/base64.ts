/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function encodeBase64Utf8(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

export function decodeBase64Utf8(value: string): string {
    const binary = atob(value.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function encodeBasicAuth(username: string, password: string): string {
    return `Basic ${encodeBase64Utf8(`${username}:${password}`)}`;
}
