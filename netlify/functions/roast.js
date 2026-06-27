const MODEL = "llama-3.1-8b-instant";

const ROAST_LEVELS = {
  aman: {
    label: "Aman",
    maxWords: 28,
    maxTokens: 120,
    temperature: 0.75,
    style: "Lucu, santai, nyindir halus, Jaksel style, tanpa kata kasar.",
    swearRule: "Jangan pakai kata kasar.",
    examples: (name) => [
      `${name}, kamu lowkey chaos, tapi masih denial bilang hidupmu fine.`,
      `${name}, vibes kamu kayak orang yang niat glow up, tapi eksekusinya loading.`
    ],
  },

  pedas: {
    label: "Pedas",
    maxWords: 26,
    maxTokens: 120,
    temperature: 0.85,
    style: "Nyindir, dingin, personal, Jaksel style, boleh kasar ringan.",
    swearRule: "Boleh pakai: anjir, bego, bodoh, kampret. Maksimal 1 kata kasar.",
    examples: (name) => [
      `${name}, honestly kamu bukan misterius, kamu cuma bego tapi dikasih aesthetic vibes.`,
      `${name}, lowkey pilihanmu red flag, tapi pede-nya valid banget, anjir.`
    ],
  },

  kasar: {
    label: "Kasar",
    maxWords: 24,
    maxTokens: 120,
    temperature: 0.95,
    style: "Kasar, dingin, personal, ngejek, Jaksel style, terdengar seperti hinaan tongkrongan.",
    swearRule: "Wajib pakai minimal 1 kata kasar: goblok, dongo, bodoh, bego, tolol, kampret, anjir.",
    examples: (name) => [
      `${name}, your whole vibe tuh dongo, tapi confidence-nya kayak main character.`,
      `${name}, kamu lowkey goblok, tapi cara kamu denial itu almost inspiring.`
    ],
  },

  brutal: {
    label: "Brutal",
    maxWords: 24,
    maxTokens: 120,
    temperature: 1.05,
    style: "Paling kasar, dingin, jahat, personal, Jaksel style, tanpa sensor kata kasar umum.",
    swearRule: "Boleh pakai kata kasar umum seperti goblok, dongo, tolol, bodoh, bego, kampret, anjir, bangsat, bajingan.",
    examples: (name) => [
      `${name}, your vibe tuh bangsat banget, dongo tapi acting like the main character.`,
      `${name}, kamu bukan red flag, kamu whole toxic ecosystem, gobloknya premium.`
    ],
  },
};

const DEFAULT_LEVEL = "kasar";

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
  "fomo",
  "overthinking",
  "social battery",
  "trust issue",
  "main character",
  "toxic",
  "denial",
  "glow up",
  "aesthetic",
  "soft launch",
  "premium",
  "trial version"
];

const SWEAR_WORDS = [
  "goblok",
  "dongo",
  "bodoh",
  "bego",
  "tolol",
  "kampret",
  "anjir",
  "bangsat",
  "bajingan"
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

const SAFETY_BOUNDARIES = `
Batas yang tetap dilarang:
- Jangan SARA.
- Jangan politik.
- Jangan seksual eksplisit.
- Jangan menyerang bentuk tubuh, wajah, penyakit, disabilitas, keluarga, kemiskinan, atau trauma.
- Jangan ancaman.
- Jangan menyuruh menyakiti diri sendiri atau orang lain.
`;

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

  const { name, answers, roastLevel, userPreference } = body;

  if (!name || !Array.isArray(answers) || answers.length === 0) {
    return jsonResponse(400, {
      error: "Data tidak lengkap: butuh name dan answers.",
    });
  }

  const cleanName = sanitizeText(name).slice(0, 25);
  const selectedLevel = getRoastLevel(roastLevel);
  const levelConfig = ROAST_LEVELS[selectedLevel];
  const cleanPreference = sanitizePreference(userPreference);

  const answersText = answers
    .map((item, index) => {
      const question = sanitizeText(item.question || "");
      const answer = sanitizeText(item.answer || "");

      return `${index + 1}. ${question} -> ${answer}`;
    })
    .join("\n");

  if (!GROQ_API_KEY) {
    const fallback = buildFallbackResult(cleanName, answers, selectedLevel, "fallback-no-key");

    return jsonResponse(200, fallback);
  }

  try {
    const persona = await analyzePersona({
      apiKey: GROQ_API_KEY,
      name: cleanName,
      answersText,
      selectedLevel,
      cleanPreference,
    });

    const selectedStyle = chooseRoastStyle(persona, selectedLevel, cleanPreference);

    const draft = await generateRoastDraft({
      apiKey: GROQ_API_KEY,
      name: cleanName,
      answersText,
      selectedLevel,
      levelConfig,
      persona,
      selectedStyle,
      cleanPreference,
    });

    const review = await reviewAndImproveRoast({
      apiKey: GROQ_API_KEY,
      name: cleanName,
      selectedLevel,
      levelConfig,
      persona,
      selectedStyle,
      draftRoast: draft.roast,
    });

    let roast = review.improvedRoast || draft.roast || "";

    roast = cleanRoast(roast);
    roast = forceOneSentence(roast);

    if (!isValidRoast(roast, levelConfig.maxWords, selectedLevel) || isIncompleteRoast(roast)) {
      roast = makeFallbackRoast(cleanName, answers, selectedLevel);
    }

    const preferenceUpdate = buildPreferenceUpdate({
      selectedLevel,
      persona,
      selectedStyle,
      roast,
      previousPreference: cleanPreference,
    });

    return jsonResponse(200, {
      roast,
      source: "agentic-ai",
      level: selectedLevel,
      persona: {
        type: persona.personaType || "Unclear Persona",
        title: persona.personaTitle || "Soft Chaos",
        traits: persona.traits || [],
        roastAngle: persona.roastAngle || selectedStyle.angle,
        selectedStyle,
      },
      selfCheck: {
        passed: Boolean(review.passed),
        issues: Array.isArray(review.issues) ? review.issues : [],
        summary: review.summary || "Roast checked and refined.",
      },
      preferenceUpdate,
    });
  } catch (err) {
    const fallback = buildFallbackResult(cleanName, answers, selectedLevel, err.message);

    return jsonResponse(200, fallback);
  }
};

async function analyzePersona({ apiKey, name, answersText, selectedLevel, cleanPreference }) {
  const prompt = `
Analisis jawaban user untuk website AI roast.

Nama: ${name}
Level kasar pilihan user: ${selectedLevel}

Jawaban:
${answersText}

Memory/preferensi sesi sebelumnya:
${JSON.stringify(cleanPreference, null, 2)}

Tugas:
- Analisis persona user dari pola jawaban.
- Tentukan tipe persona.
- Tentukan kelemahan/kontradiksi yang bisa di-roast.
- Pilih gaya roast terbaik.
- Gunakan bahasa Indonesia campur English Jaksel style.

Balas hanya JSON valid:
{
  "personaTitle": "judul persona pendek",
  "personaType": "tipe persona",
  "traits": ["trait 1", "trait 2", "trait 3"],
  "contradictions": ["kontradiksi 1", "kontradiksi 2"],
  "weaknesses": ["kelemahan lucu 1", "kelemahan lucu 2"],
  "roastAngle": "sudut roast utama",
  "recommendedStyle": "deadpan / chaotic / cold / savage / sarcastic",
  "spiceAdjustment": "softer / same / harder",
  "jakselKeywords": ["lowkey", "vibes"]
}
`;

  return callGroqJson({
    apiKey,
    maxTokens: 260,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: "Kamu adalah AI persona analyst untuk sistem roast. Balas hanya JSON valid.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });
}

function chooseRoastStyle(persona, selectedLevel, cleanPreference) {
  const recommendedStyle = sanitizeText(persona.recommendedStyle || "sarcastic").toLowerCase();
  const spiceAdjustment = sanitizeText(persona.spiceAdjustment || "same").toLowerCase();

  const previousStyle = sanitizeText(cleanPreference.lastStyle || "");
  const previousPersona = sanitizeText(cleanPreference.lastPersona || "");

  let angle = sanitizeText(persona.roastAngle || "roast pilihan user yang kacau tapi sok yakin");

  if (!angle) {
    angle = "roast energi user yang sok chill tapi sebenarnya chaotic";
  }

  return {
    baseLevel: selectedLevel,
    recommendedStyle,
    spiceAdjustment,
    previousStyle,
    previousPersona,
    angle,
  };
}

async function generateRoastDraft({
  apiKey,
  name,
  answersText,
  selectedLevel,
  levelConfig,
  persona,
  selectedStyle,
  cleanPreference,
}) {
  const examples = levelConfig.examples(name).join("\n");

  const prompt = `
Buat 1 roast untuk user.

Nama: ${name}
Level kasar: ${selectedLevel}
Style level: ${levelConfig.style}
Aturan kata kasar: ${levelConfig.swearRule}

Persona analysis:
${JSON.stringify(persona, null, 2)}

Gaya yang dipilih agent:
${JSON.stringify(selectedStyle, null, 2)}

Memory/preferensi sesi sebelumnya:
${JSON.stringify(cleanPreference, null, 2)}

Jawaban user:
${answersText}

Gaya bahasa wajib:
- Jaksel style natural.
- Campur bahasa Indonesia dan English.
- Pakai minimal 1 slang seperti: ${JAKSEL_WORDS.join(", ")}.
- Jangan full English.
- Jangan formal.
- Jangan seperti motivator.
- Jangan seperti artikel.
- Jangan mengulang mentah-mentah jawaban user.
- Jangan mulai dengan isi jawaban user.
- Ambil persona dan kontradiksinya.
- Kalimat harus selesai natural.
- Maksimal ${levelConfig.maxWords} kata.
- Hanya 1 kalimat.

${SAFETY_BOUNDARIES}

Contoh gaya:
${examples}

Balas hanya JSON valid:
{
  "roast": "isi roast final"
}
`;

  const result = await callGroqJson({
    apiKey,
    maxTokens: levelConfig.maxTokens,
    temperature: levelConfig.temperature,
    messages: [
      {
        role: "system",
        content: "Kamu adalah AI roast writer. Balas hanya JSON valid.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return {
    roast: result.roast || "",
  };
}

async function reviewAndImproveRoast({
  apiKey,
  name,
  selectedLevel,
  levelConfig,
  persona,
  selectedStyle,
  draftRoast,
}) {
  const prompt = `
Kamu adalah AI self-checker untuk hasil roast.

Nama: ${name}
Level kasar: ${selectedLevel}
Maksimal kata: ${levelConfig.maxWords}

Persona:
${JSON.stringify(persona, null, 2)}

Style yang dipilih:
${JSON.stringify(selectedStyle, null, 2)}

Draft roast:
${draftRoast}

Checklist:
1. Apakah maksimal ${levelConfig.maxWords} kata?
2. Apakah bahasanya Jaksel style?
3. Apakah personal dari persona?
4. Apakah cukup pedas untuk level ${selectedLevel}?
5. Apakah kalimatnya selesai dan tidak menggantung?
6. Apakah tidak formal?
7. Apakah tidak menyalin mentah-mentah jawaban user?

Kalau draft gagal, revisi langsung.
Kalau draft kurang kasar untuk level kasar/brutal, pedaskan.
Kalau terlalu panjang, tulis ulang dari nol.
Kalau menggantung, tulis ulang dari nol.

${SAFETY_BOUNDARIES}

Balas hanya JSON valid:
{
  "passed": true,
  "issues": [],
  "summary": "ringkasan self-check",
  "improvedRoast": "roast final yang sudah diperbaiki"
}
`;

  const result = await callGroqJson({
    apiKey,
    maxTokens: 240,
    temperature: 0.55,
    messages: [
      {
        role: "system",
        content: "Kamu adalah AI reviewer dan editor roast. Balas hanya JSON valid.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return {
    passed: Boolean(result.passed),
    issues: Array.isArray(result.issues) ? result.issues : [],
    summary: result.summary || "",
    improvedRoast: result.improvedRoast || draftRoast || "",
  };
}

async function callGroqJson({ apiKey, messages, maxTokens, temperature }) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Groq error: ${response.status}`);
  }

  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  return safeParseJson(raw);
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function buildFallbackResult(name, answers, level, reason) {
  const persona = makeFallbackPersona(answers);
  const roast = makeFallbackRoast(name, answers, level);

  return {
    roast,
    source: "fallback-agent",
    level,
    persona,
    selfCheck: {
      passed: true,
      issues: ["Fallback digunakan karena AI/API tidak stabil."],
      summary: "Fallback roast dipakai agar web tetap berjalan.",
    },
    preferenceUpdate: buildPreferenceUpdate({
      selectedLevel: level,
      persona,
      selectedStyle: {
        baseLevel: level,
        recommendedStyle: "fallback",
        spiceAdjustment: "same",
        angle: persona.roastAngle,
      },
      roast,
      previousPreference: {},
    }),
    note: reason,
  };
}

function makeFallbackPersona(answers) {
  const text = answers
    .map((item) => `${item.question || ""} ${item.answer || ""}`)
    .join(" ")
    .toLowerCase();

  if (hasAny(text, ["fomo", "ikut", "kesempatan", "nongkrong"])) {
    return {
      type: "FOMO Survivor",
      title: "FOMO Survivor",
      traits: ["takut ketinggalan", "sok social", "mudah kebawa vibes"],
      roastAngle: "FOMO gede tapi personality masih trial version",
    };
  }

  if (hasAny(text, ["overthinking", "chat", "crush", "wkwk"])) {
    return {
      type: "Overthinking Specialist",
      title: "Overthinking Specialist",
      traits: ["banyak mikir", "drama internal", "sok chill"],
      roastAngle: "overthinking keras tapi output tetap kacau",
    };
  }

  if (hasAny(text, ["tidur", "rebahan", "capek", "social battery"])) {
    return {
      type: "Low Battery Human",
      title: "Low Battery Human",
      traits: ["low energy", "rebahan loyalist", "banyak alasan"],
      roastAngle: "low energy tapi denial-nya tinggi",
    };
  }

  if (hasAny(text, ["makan", "lapar", "basi", "food"])) {
    return {
      type: "Food Driven Chaos",
      title: "Food Driven Chaos",
      traits: ["food motivated", "dramatis", "impulsif"],
      roastAngle: "urusan makan konsisten, urusan mikir trial version",
    };
  }

  return {
    type: "Soft Chaos",
    title: "Soft Chaos",
    traits: ["random", "sok chill", "chaotic"],
    roastAngle: "vibes random tapi confidence tinggi",
  };
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

    if (hasAny(selectedAnswers, ["lapar", "makan", "basi"])) {
      return `${name}, urusan makan aja chaos, pantes hidupmu gobloknya consistent.`;
    }

    return `${name}, your vibe tuh bangsat, dongo tapi acting like main character.`;
  }

  return `${name}, your whole vibe tuh bego, tapi denial-nya main character banget.`;
}

function buildPreferenceUpdate({
  selectedLevel,
  persona,
  selectedStyle,
  roast,
  previousPreference,
}) {
  const previousCount = Number(previousPreference?.roastCount || 0);

  return {
    roastCount: previousCount + 1,
    lastLevel: selectedLevel,
    lastPersona: persona.personaType || persona.type || "Unknown",
    lastPersonaTitle: persona.personaTitle || persona.title || "Unknown",
    lastStyle: selectedStyle.recommendedStyle || "unknown",
    lastAngle: selectedStyle.angle || persona.roastAngle || "",
    lastRoastPreview: roast.slice(0, 120),
    updatedAt: new Date().toISOString(),
  };
}

function sanitizePreference(preference) {
  if (!preference || typeof preference !== "object") return {};

  return {
    roastCount: Number(preference.roastCount || 0),
    lastLevel: sanitizeText(preference.lastLevel || ""),
    lastPersona: sanitizeText(preference.lastPersona || ""),
    lastPersonaTitle: sanitizeText(preference.lastPersonaTitle || ""),
    lastStyle: sanitizeText(preference.lastStyle || ""),
    lastAngle: sanitizeText(preference.lastAngle || ""),
    lastRoastPreview: sanitizeText(preference.lastRoastPreview || "").slice(0, 120),
    updatedAt: sanitizeText(preference.updatedAt || ""),
  };
}

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
      "Cache-Control": "no-store",
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

function isValidRoast(text, maxWords, level) {
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

  if (["kasar", "brutal"].includes(level)) {
    const hasSwearWord = SWEAR_WORDS.some((word) => lower.includes(word));
    if (!hasSwearWord) return false;
  }

  return true;
}

function isIncompleteRoast(text) {
  const lower = text.toLowerCase().trim();

  if (!/[.!?]$/.test(lower)) {
    return true;
  }

  return HANGING_ENDINGS.some((ending) => lower.endsWith(ending));
}

function hasAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}