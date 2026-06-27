const ROAST_LEVELS = {
  aman: {
    label: "Aman",
    maxWords: 26,
    maxTokens: 100,
    temperature: 0.75,
    style: `
- Lucu, santai, nyindir halus.
- Bahasa Jaksel style: Indo-English natural.
- Tidak pakai kata kasar.
- Cocok untuk roast ringan.
- Tetap personal dari jawaban user.
`,
    swearRule: `
- Jangan pakai kata kasar.
- Jangan terlalu pedas.
`,
    examples: (name) => `
${name}, kamu tuh lowkey chaos, tapi masih denial bilang hidupmu fine.
${name}, vibes kamu tuh kayak orang yang niat glow up, tapi eksekusinya loading.
`,
  },

  pedas: {
    label: "Pedas",
    maxWords: 24,
    maxTokens: 100,
    temperature: 0.85,
    style: `
- Nyindir, dingin, dan personal.
- Bahasa Jaksel style: Indo-English natural.
- Boleh pakai kata kasar ringan.
- Roast harus terasa seperti ejekan teman dekat.
- Jangan terlalu sopan.
`,
    swearRule: `
- Boleh pakai kata: anjir, bego, bodoh, kampret.
- Pakai maksimal 1 kata kasar.
`,
    examples: (name) => `
${name}, honestly kamu bukan misterius, kamu cuma bego tapi dikasih aesthetic vibes.
${name}, lowkey pilihanmu red flag, tapi pede-nya valid banget, anjir.
`,
  },

  kasar: {
    label: "Kasar",
    maxWords: 22,
    maxTokens: 100,
    temperature: 0.95,
    style: `
- Kasar, dingin, personal, dan ngejek.
- Bahasa Jaksel style: Indo-English natural.
- Tidak usah terlalu sopan.
- Harus terdengar seperti hinaan tongkrongan anak Jaksel.
- Roast harus pendek dan langsung nusuk.
`,
    swearRule: `
- Wajib pakai minimal 1 kata kasar.
- Boleh pakai: goblok, dongo, bodoh, bego, tolol, kampret, anjir.
`,
    examples: (name) => `
${name}, your whole vibe tuh dongo, tapi confidence-nya kayak main character.
${name}, kamu lowkey goblok, tapi cara kamu denial itu almost inspiring.
`,
  },

  brutal: {
    label: "Brutal",
    maxWords: 22,
    maxTokens: 100,
    temperature: 1.05,
    style: `
- Paling kasar, paling dingin, paling personal.
- Bahasa Jaksel style: Indo-English natural.
- Tidak perlu sopan.
- Kata kasar umum boleh dipakai.
- Roast harus jahat, pendek, nyelekit, dan langsung kena.
- Gaya seperti teman dekat Jaksel yang lagi ngejek tanpa rem.
`,
    swearRule: `
- Kata kasar umum boleh dipakai.
- Boleh pakai kata seperti goblok, dongo, tolol, bodoh, bego, kampret, anjir, bangsat, bajingan.
- Jangan menahan diri dalam gaya bahasa kasar umum.
`,
    examples: (name) => `
${name}, your vibe tuh bangsat banget, dongo tapi acting like the main character.
${name}, kamu bukan red flag, kamu whole toxic ecosystem, gobloknya premium.
${name}, otakmu lowkey dongo, tapi pede-nya bajingan juga.
`,
  },
};

const DEFAULT_LEVEL = "kasar";

const SAFETY_BOUNDARIES = `
Batas yang tetap dilarang:
- Jangan SARA.
- Jangan politik.
- Jangan seksual eksplisit.
- Jangan menyerang bentuk tubuh, wajah, penyakit, disabilitas, keluarga, kemiskinan, atau trauma.
- Jangan ancaman.
- Jangan menyuruh menyakiti diri sendiri atau orang lain.
`;

const JAKSEL_WORDS = [
  "literally",
  "honestly",
  "lowkey",
  "vibes",
  "vibe",
  "red flag",
  "valid",
  "bestie",
  "energy",
  "FOMO",
  "overthinking",
  "social battery",
  "trust issue",
  "main character",
  "toxic",
  "denial",
  "glow up",
  "aesthetic"
];

const BAD_FORMAL_PHRASES = [
  "sepertinya",
  "kehidupanmu",
  "komedi situasional",
  "skenario",
  "berdasarkan jawabanmu",
  "mencerminkan",
  "menunjukkan bahwa",
  "mungkin kamu perlu",
  "kamu adalah pribadi",
  "tampaknya",
  "layaknya",
  "ibarat",
  "seperti sebuah",
  "dapat dikatakan",
  "secara tidak langsung",
  "itu bukti kamu",
];

const HANGING_ENDINGS = [
  "sudah.",
  "yang.",
  "kayak.",
  "karena.",
  "tapi.",
  "buat.",
  "jadi.",
  "sebagai.",
  "dengan.",
  "untuk.",
  "kalau.",
  "itu.",
  "ini.",
  "dan.",
  "di.",
  "ke.",
  "dari.",
  "sama.",
  "atau.",
  "padahal.",
  "bukti.",
  "bukti kamu.",
];

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      error: "Method not allowed.",
    });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  let body;

  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, {
      error: "Request body tidak valid.",
    });
  }

  const { name, answers, roastLevel } = body;

  if (!name || !Array.isArray(answers) || answers.length === 0) {
    return jsonResponse(400, {
      error: "Data tidak lengkap: butuh name dan answers.",
    });
  }

  const cleanName = sanitizeText(name).slice(0, 25);
  const selectedLevel = getRoastLevel(roastLevel);
  const levelConfig = ROAST_LEVELS[selectedLevel];

  const answersText = answers
    .map((item, index) => {
      const question = sanitizeText(item.question || "");
      const answer = sanitizeText(item.answer || "");

      return `${index + 1}. ${question} -> ${answer}`;
    })
    .join("\n");

  if (!GROQ_API_KEY) {
    return jsonResponse(200, {
      roast: makeFallbackRoast(cleanName, answers, selectedLevel),
      source: "fallback",
      level: selectedLevel,
      note: "GROQ_API_KEY belum diset.",
    });
  }

  const systemPrompt = `
Kamu adalah AI roast generator bahasa Indonesia untuk web hiburan.

Mode roast aktif: ${levelConfig.label}

Gaya bahasa wajib:
- Gunakan bahasa Jaksel style.
- Campur bahasa Indonesia dan English secara natural.
- Gunakan slang seperti: ${JAKSEL_WORDS.join(", ")}.
- Jangan full English.
- Jangan terlalu formal.
- Jangan seperti caption motivasi.
- Jangan seperti artikel.
- Jangan seperti guru BK.
- Output harus terasa seperti teman tongkrongan lagi nge-roast.

Gaya roast:
${levelConfig.style}

Aturan kata kasar:
${levelConfig.swearRule}

${SAFETY_BOUNDARIES}

Aturan penting:
- Jangan mengulang mentah-mentah jawaban user.
- Jangan mulai roast dengan pilihan jawaban user.
- Ambil sifat/persona dari jawaban, bukan menyalin teks jawabannya.
- Kalimat harus selesai secara natural.
- Jangan membuat kalimat menggantung.
- Jangan berhenti di kata seperti: sudah, yang, karena, tapi, untuk, dengan, jadi.
- Jangan terdengar formal.
- Jangan terdengar seperti motivator.
- Jangan pakai analogi panjang.
- Jangan pakai frasa formal seperti: ${BAD_FORMAL_PHRASES.join(", ")}.
- Wajib pakai minimal 1 kata/frasa Jaksel seperti: lowkey, honestly, literally, vibes, red flag, valid, energy, main character, toxic, denial.

Aturan output:
- Hanya 1 kalimat.
- Maksimal ${levelConfig.maxWords} kata.
- Langsung roast.
- Jangan pakai pembuka.
- Jangan pakai penjelasan.
- Jangan pakai emoji.
- Jangan pakai tanda kutip.
`;

  const userPrompt = `
Nama target: ${cleanName}

Jawaban target:
${answersText}

Buat 1 roast untuk ${cleanName}.

Level roast: ${levelConfig.label}

Aturan:
- Maksimal ${levelConfig.maxWords} kata.
- Harus personal dari pola jawaban target.
- Bahasa Jaksel style, Indo-English.
- Wajib ada minimal 1 slang Jaksel.
- Jangan salin mentah-mentah isi jawaban target.
- Harus pendek, tajam, nyelekit, dan nyebelin.
- Jangan formal.
- Jangan panjang.
- Jangan menjelaskan alasan roast.
- Kalimat harus selesai, tidak boleh menggantung.
- Langsung tulis roast final saja.

Contoh gaya:
${levelConfig.examples(cleanName)}
`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: levelConfig.maxTokens,
        temperature: levelConfig.temperature,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return jsonResponse(200, {
        roast: makeFallbackRoast(cleanName, answers, selectedLevel),
        source: "fallback",
        level: selectedLevel,
        note: data.error?.message || `Groq error: ${response.status}`,
      });
    }

    let roast = data.choices?.[0]?.message?.content?.trim() || "";

    roast = cleanRoast(roast);
    roast = forceOneSentence(roast);

    if (!isValidRoast(roast, levelConfig.maxWords) || isIncompleteRoast(roast)) {
      roast = makeFallbackRoast(cleanName, answers, selectedLevel);
    }

    return jsonResponse(200, {
      roast,
      source: "ai",
      level: selectedLevel,
    });
  } catch (err) {
    return jsonResponse(200, {
      roast: makeFallbackRoast(cleanName, answers, selectedLevel),
      source: "fallback",
      level: selectedLevel,
      note: err.message,
    });
  }
};

function getRoastLevel(level) {
  const normalized = sanitizeText(level || "").toLowerCase();

  if (ROAST_LEVELS[normalized]) {
    return normalized;
  }

  return DEFAULT_LEVEL;
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: statusCode === 204 ? "" : JSON.stringify(body),
  };
}

function sanitizeText(text) {
  return String(text)
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanRoast(text) {
  return String(text)
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/^Roast:\s*/i, "")
    .replace(/^AI Roast:\s*/i, "")
    .replace(/^Ini roast-nya:\s*/i, "")
    .replace(/^🔥\s*/i, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function forceOneSentence(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g);

  if (sentences && sentences.length > 0) {
    return sentences[0].trim();
  }

  const cleaned = text.trim();

  if (!cleaned) {
    return "";
  }

  if (!/[.!?]$/.test(cleaned)) {
    return `${cleaned}.`;
  }

  return cleaned;
}

function isValidRoast(text, maxWords) {
  if (!text) return false;

  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount > maxWords) return false;
  if (wordCount < 4) return false;

  const hasFormalPhrase = BAD_FORMAL_PHRASES.some((phrase) =>
    lower.includes(phrase)
  );

  if (hasFormalPhrase) return false;

  const hasJakselWord = JAKSEL_WORDS.some((word) =>
    lower.includes(word.toLowerCase())
  );

  if (!hasJakselWord) return false;

  return true;
}

function isIncompleteRoast(text) {
  const lower = text.toLowerCase().trim();

  if (!/[.!?]$/.test(lower)) {
    return true;
  }

  return HANGING_ENDINGS.some((ending) => lower.endsWith(ending));
}

function makeFallbackRoast(name, answers, level) {
  const selectedAnswers = answers
    .map((item) => sanitizeText(item.answer || ""))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (level === "aman") {
    if (hasAny(selectedAnswers, ["privasi", "rahasia", "sendiri"])) {
      return `${name}, kamu lowkey sok misterius, padahal cuma bingung yang dikasih password.`;
    }

    if (hasAny(selectedAnswers, ["pengalaman", "kesempatan", "ikut acara", "fomo"])) {
      return `${name}, FOMO kamu valid sih, tapi vibes kosongnya tetap kebaca.`;
    }

    if (hasAny(selectedAnswers, ["lapar", "makan", "basi"])) {
      return `${name}, food vibes kamu chaotic, literally lapar doang tapi dramanya premium.`;
    }

    if (hasAny(selectedAnswers, ["tidur", "rebahan", "capek"])) {
      return `${name}, social battery kamu bukan low, hidupmu aja belum fully charged.`;
    }

    return `${name}, your vibe tuh random, kayak hidupmu masih stuck di loading screen.`;
  }

  if (level === "pedas") {
    if (hasAny(selectedAnswers, ["privasi", "rahasia", "sendiri"])) {
      return `${name}, sok mysterious, padahal isinya cuma bego yang dikasih private mode.`;
    }

    if (hasAny(selectedAnswers, ["pengalaman", "kesempatan", "ikut acara", "fomo"])) {
      return `${name}, FOMO kamu kenceng, tapi personality-nya masih trial version, anjir.`;
    }

    if (hasAny(selectedAnswers, ["lapar", "makan", "basi"])) {
      return `${name}, literally urusan makan aja ribet, pantes decision making kamu bego.`;
    }

    if (hasAny(selectedAnswers, ["tidur", "rebahan", "capek"])) {
      return `${name}, kamu bukan capek, kamu just lazy with aesthetic excuse.`;
    }

    return `${name}, pilihanmu bego, tapi confidence-nya main character banget.`;
  }

  if (level === "kasar") {
    if (hasAny(selectedAnswers, ["privasi", "rahasia", "sendiri"])) {
      return `${name}, sok mysterious banget, padahal vibes-nya cuma dongo pakai password.`;
    }

    if (hasAny(selectedAnswers, ["takut", "basi", "waspada", "overthinking"])) {
      return `${name}, overthinking kamu valid, tapi hasil akhirnya tetap goblok juga.`;
    }

    if (hasAny(selectedAnswers, ["pengalaman", "kesempatan", "ikut acara", "fomo"])) {
      return `${name}, FOMO kamu brutal, tapi personality-nya kosong, bego.`;
    }

    if (hasAny(selectedAnswers, ["tidur", "rebahan", "capek"])) {
      return `${name}, kamu bukan low energy, kamu dongo yang kebetulan rebahan.`;
    }

    if (hasAny(selectedAnswers, ["lapar", "makan", "basi"])) {
      return `${name}, food obsession kamu valid, tapi otakmu tetap trial version, goblok.`;
    }

    return `${name}, your whole vibe tuh bego, tapi denial-nya main character banget.`;
  }

  if (level === "brutal") {
    if (hasAny(selectedAnswers, ["privasi", "rahasia", "sendiri"])) {
      return `${name}, sok mysterious bangsat, padahal vibes-nya cuma dongo pakai password.`;
    }

    if (hasAny(selectedAnswers, ["takut", "basi", "waspada", "overthinking"])) {
      return `${name}, overthinking kamu valid, tapi output-nya tetap goblok bangsat.`;
    }

    if (hasAny(selectedAnswers, ["pengalaman", "kesempatan", "ikut acara", "fomo"])) {
      return `${name}, FOMO kamu gede, tapi personality kosongmu literally goblok.`;
    }

    if (hasAny(selectedAnswers, ["tidur", "rebahan", "capek"])) {
      return `${name}, kamu bukan low energy, kamu malas bangsat with soft-launch excuse.`;
    }

    if (hasAny(selectedAnswers, ["lapar", "makan", "basi"])) {
      return `${name}, urusan makan aja chaos, pantes hidupmu gobloknya consistent.`;
    }

    return `${name}, your vibe tuh bangsat, dongo tapi acting like main character.`;
  }

  return `${name}, your whole vibe tuh bego, tapi denial-nya main character banget.`;
}

function hasAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}