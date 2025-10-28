/*
 * Special characters:
 * (1) period breaks up digraphs; e.g. t.h for τη to stop th from being read as Ⲑ. It also marks if a
 * following vowel should get a macron (for long vowels): e.g. .e for ē → Ⲏ, .o for ō → Ⲱ.
 * (2) backslash prevents following character from being transliterated (useful if you want literal periods or apostrophes
 * in example sentences). Double backslash to make literal backslash appear in output.
 *
 * For macrons (long vowels), use either .e/.o notation or direct entry with macrons (ē → Ⲏ, ō → Ⲱ).
 * Macrons are decomposed into base vowel + combining macron and handled during transliteration.
 */

const romanizations: Record<string, string[]> = {
  ⲁ: ["a"],
  ⲃ: ["b"],
  ⲅ: ["g"],
  ⲇ: ["d"],
  ⲉ: ["e"],
  ⲍ: ["z"],
  ⲏ: ["ē", "e:", "ê"], // long e - ē with macron or .e
  ⲑ: ["th"],
  ⲓ: ["i"],
  ⲕ: ["k"],
  ⲗ: ["l"],
  ⲙ: ["m"],
  ⲛ: ["n"],
  ⲝ: ["x"],
  ⲟ: ["o"],
  ⲡ: ["p"],
  ⲣ: ["r"],
  ⲥ: ["s"],
  ⲧ: ["t"],
  ⲩ: ["u", "y"],
  ⲫ: ["ph"],
  ⲭ: ["kh", "ch"],
  ⲯ: ["ps"],
  ⲱ: ["ō", "o:", "ô"], // long o - ō with macron or o:
  ϣ: ["sh", "š"],
  ϥ: ["f"],
  ϧ: ["ḫ", "h_"], // kh or h with dot below
  ϩ: ["h"],
  ϫ: ["j", "d_"],
  ϭ: ["č", "t_", "c"],
  ϯ: ["ti"],
};

const uppercaseRomanizations: Record<string, string[]> = {};

for (const [coptic, latin] of Object.entries(romanizations)) {
  const uppercaseLatin = [];
  for (const l of latin) {
    const allUpper = l.toUpperCase();
    uppercaseLatin.push(allUpper);
    if (l.length > 1 && !l.startsWith(".")) {
      // For multi-character romanizations, also add title case (first letter uppercase)
      const firstLetterUpper = (l[0]?.toUpperCase() ?? "") + l.slice(1);
      uppercaseLatin.push(firstLetterUpper);
    }
  }
  const uppercaseCoptic = coptic.toUpperCase();
  uppercaseRomanizations[uppercaseCoptic] = uppercaseLatin;
}

for (const [coptic, latin] of Object.entries(uppercaseRomanizations)) {
  romanizations[coptic] = latin;
}

const latinToCoptic: Record<string, string> = {};
for (const [coptic, latinArray] of Object.entries(romanizations)) {
  for (const latin of latinArray) {
    if (latinToCoptic[latin] !== undefined) {
      // console.warn("Duplicate possible transliterations for string " + latin);
    }
    latinToCoptic[latin] = coptic;
  }
}

export function transliterateCoptic(s: string) {
  // Convert accented Latin vowels and macrons into base ASCII + combining diacritics
  //s = s.normalize("NFD");
  let cursor = 0;
  const out = [];
  while (cursor < s.length) {
    const c = s[cursor];
    if (c === "\\") { // really a single backslash
      // Add next character without transliteration
      if (cursor < s.length - 1) {
        out.push(s[cursor + 1]);
      }
      cursor += 2;
      continue;
    }
    // Special case: preserve periods at end of word or if next character is space.
    // If next character is e, then transliterate as Ⲏ (long e).
    // If next character is o, then transliterate as Ⲱ (long o).
    // Eliminate otherwise: it's just being used as a digraph separator.
    if (c === ".") {
      if (cursor === s.length - 1 || s[cursor + 1] === " ") {
        out.push(".");
        cursor += 1;
      }
      // Check for .e or .o to add macron
      else if (cursor < s.length - 1 && (s[cursor + 1] === "e" || s[cursor + 1] === "E")) {
        out.push(s[cursor + 1] + "\u0304"); // e with combining macron
        cursor += 2; // skip both . and e
      }
      else if (cursor < s.length - 1 && (s[cursor + 1] === "o" || s[cursor + 1] === "O")) {
        out.push(s[cursor + 1] + "\u0304"); // o with combining macron
        cursor += 2; // skip both . and o
      }
      else {
        cursor += 1; // ignore - it's a digraph separator
      }
      continue;
    }
    // Otherwise choose transliteration through maximum munch rule.
    let longestMatchLength = 0;
    let longestMatchString = undefined;
    const suffix = s.slice(cursor);
    for (const latin of Object.keys(latinToCoptic)) {
      const regex = "^" + latin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex special chars
      if (suffix.match(regex) != null && latin.length > longestMatchLength) {
        longestMatchLength = latin.length;
        longestMatchString = latin;
      }
    }
    if (longestMatchString === undefined) {
      // add current character unaltered
      out.push(c);
      cursor += 1;
    }
    else {
      out.push(latinToCoptic[longestMatchString]);
      cursor += longestMatchString.length;
    }
  }

  
  let joinedOut =  out.join("");

  return joinedOut.replaceAll("=", "\u0304")
}
