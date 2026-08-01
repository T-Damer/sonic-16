/** Fixed-capacity bitset used for entity component signatures. */

export const SIGNATURE_WORDS = 4; // 128 component types is plenty

export type Signature = Uint32Array;

export function createSignature(): Signature {
    return new Uint32Array(SIGNATURE_WORDS);
}

export function sigSet(sig: Signature, bit: number): void {
    sig[bit >>> 5] |= 1 << (bit & 31);
}

export function sigClear(sig: Signature, bit: number): void {
    sig[bit >>> 5] &= ~(1 << (bit & 31));
}

export function sigHas(sig: Signature, bit: number): boolean {
    return (sig[bit >>> 5] & (1 << (bit & 31))) !== 0;
}

export function sigReset(sig: Signature): void {
    sig.fill(0);
}

/** true when every bit of `mask` is present in `sig`. */
export function sigContainsAll(sig: Signature, mask: Signature): boolean {
    for (let i = 0; i < SIGNATURE_WORDS; i++) {
        if ((sig[i] & mask[i]) !== mask[i]) return false;
    }
    return true;
}

/** true when `sig` shares no bits with `mask`. */
export function sigContainsNone(sig: Signature, mask: Signature): boolean {
    for (let i = 0; i < SIGNATURE_WORDS; i++) {
        if ((sig[i] & mask[i]) !== 0) return false;
    }
    return true;
}
