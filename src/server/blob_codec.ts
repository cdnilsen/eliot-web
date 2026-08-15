// Compact, reversible, spreadsheet-safe encoding for the scheduling and
// relationship state exported alongside a deck's card content, so both can
// round-trip through a CSV/TSV edit-and-reimport cycle without spreading
// a dozen extra columns across the sheet. See /export_deck and /import_deck.
//
// Wire format: `<tag>:<base64url(payload)>.<checksum-hex>`
// - tag is a fixed literal (S1 for scheduling, R1 for relationships) so the
//   cell never starts with =/+/-/@ and can't be misread as an Excel/Sheets
//   formula, and never parses as a bare number/date so it won't get
//   auto-reformatted.
// - checksum is FNV-1a 32-bit over the raw pre-base64 payload bytes, used
//   only to detect spreadsheet-mangled cells on import (not cryptographic).

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fnv1a32(str: string): string {
    const bytes = Buffer.from(str, 'utf8');
    let hash = FNV_OFFSET_BASIS;
    for (const byte of bytes) {
        hash ^= byte;
        hash = Math.imul(hash, FNV_PRIME) >>> 0;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function base64urlEncode(payload: string): string {
    return Buffer.from(payload, 'utf8').toString('base64url');
}

function base64urlDecode(encoded: string): string {
    return Buffer.from(encoded, 'base64url').toString('utf8');
}

export function encodeVersionedBlob(tag: string, rawPayload: string): string {
    return `${tag}:${base64urlEncode(rawPayload)}.${fnv1a32(rawPayload)}`;
}

export type DecodedBlob =
    | { ok: true; payload: string }
    | { ok: false; reason: 'empty' | 'bad_tag' | 'bad_base64' | 'checksum_mismatch' };

export function decodeVersionedBlob(cell: string | null | undefined, expectedTag: string): DecodedBlob {
    const trimmed = (cell ?? '').trim();
    if (trimmed === '') return { ok: false, reason: 'empty' };

    const prefix = `${expectedTag}:`;
    if (!trimmed.startsWith(prefix)) return { ok: false, reason: 'bad_tag' };

    const rest = trimmed.slice(prefix.length);
    const dotIndex = rest.lastIndexOf('.');
    if (dotIndex === -1) return { ok: false, reason: 'bad_base64' };

    const encodedPayload = rest.slice(0, dotIndex);
    const checksum = rest.slice(dotIndex + 1);

    let payload: string;
    try {
        payload = base64urlDecode(encodedPayload);
    } catch {
        return { ok: false, reason: 'bad_base64' };
    }

    if (fnv1a32(payload) !== checksum.toLowerCase()) {
        return { ok: false, reason: 'checksum_mismatch' };
    }

    return { ok: true, payload };
}

export interface SchedulingFields {
    time_due: Date | string | null;
    interval: number | null;
    retrievability: number | null;
    stability: number | null;
    difficulty: number | null;
    last_reviewed: Date | string | null;
    is_suspended: boolean | null;
    is_buried: boolean | null;
    bury_tomorrow: boolean | null;
}

function dateToIso(value: Date | string | null): string {
    if (value === null || value === undefined || value === '') return '';
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? '' : d.toISOString();
}

function numToStr(value: number | null): string {
    return value === null || value === undefined ? '' : String(value);
}

export function encodeSchedulingBlob(fields: SchedulingFields): string {
    const flags =
        (fields.is_suspended ? '1' : '0') +
        (fields.is_buried ? '1' : '0') +
        (fields.bury_tomorrow ? '1' : '0');

    const payload = [
        dateToIso(fields.time_due),
        numToStr(fields.interval),
        numToStr(fields.retrievability),
        numToStr(fields.stability),
        numToStr(fields.difficulty),
        dateToIso(fields.last_reviewed),
        flags,
    ].join('|');

    return encodeVersionedBlob('S1', payload);
}

export type DecodedSchedulingBlob =
    | { ok: true; data: SchedulingFields }
    | { ok: false; reason: string };

export function decodeSchedulingBlob(cell: string | null | undefined): DecodedSchedulingBlob {
    const decoded = decodeVersionedBlob(cell, 'S1');
    if (decoded.ok === false) return { ok: false, reason: decoded.reason };

    const parts = decoded.payload.split('|');
    if (parts.length !== 7) return { ok: false, reason: 'malformed_payload' };

    const [timeDue, interval, retrievability, stability, difficulty, lastReviewed, flags] = parts;
    if (!/^[01]{3}$/.test(flags)) return { ok: false, reason: 'malformed_payload' };

    return {
        ok: true,
        data: {
            time_due: timeDue === '' ? null : timeDue,
            interval: interval === '' ? null : Number(interval),
            retrievability: retrievability === '' ? null : Number(retrievability),
            stability: stability === '' ? null : Number(stability),
            difficulty: difficulty === '' ? null : Number(difficulty),
            last_reviewed: lastReviewed === '' ? null : lastReviewed,
            is_suspended: flags[0] === '1',
            is_buried: flags[1] === '1',
            bury_tomorrow: flags[2] === '1',
        },
    };
}

export interface RelationshipFields {
    peers: number[];
    prereqs: number[];
    dependents: number[];
}

function idListToStr(ids: number[]): string {
    return [...ids].sort((a, b) => a - b).join(',');
}

export function encodeRelationshipBlob(fields: RelationshipFields): string {
    const payload = [
        idListToStr(fields.peers || []),
        idListToStr(fields.prereqs || []),
        idListToStr(fields.dependents || []),
    ].join(';');

    return encodeVersionedBlob('R1', payload);
}

export type DecodedRelationshipBlob =
    | { ok: true; data: RelationshipFields }
    | { ok: false; reason: string };

function parseIdList(str: string): number[] | null {
    if (str === '') return [];
    const ids = str.split(',').map(s => Number(s));
    if (ids.some(n => !Number.isInteger(n))) return null;
    return ids;
}

export function decodeRelationshipBlob(cell: string | null | undefined): DecodedRelationshipBlob {
    const decoded = decodeVersionedBlob(cell, 'R1');
    if (decoded.ok === false) return { ok: false, reason: decoded.reason };

    const parts = decoded.payload.split(';');
    if (parts.length !== 3) return { ok: false, reason: 'malformed_payload' };

    const peers = parseIdList(parts[0]);
    const prereqs = parseIdList(parts[1]);
    const dependents = parseIdList(parts[2]);
    if (peers === null || prereqs === null || dependents === null) {
        return { ok: false, reason: 'malformed_payload' };
    }

    return { ok: true, data: { peers, prereqs, dependents } };
}
