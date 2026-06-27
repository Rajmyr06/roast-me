const ROAST_LEVELS = {
  aman: {
    label: "Aman",
    maxWords: 22,
    maxTokens: 70,
    temperature: 0.75,
    style: `
- Lucu, santai, dan sedikit nyindir.
- Tidak pakai kata kasar.
- Cocok untuk user yang cuma mau roast ringan.
- Tetap personal berdasarkan jawaban.
`,
    swearRule: `
- Jangan pakai kata kasar.
- Jangan terlalu pedas.
`,
    examples: (name) => `
${name}, pilihanmu rapi banget buat orang yang hidupnya kelihatan masih loading.
${name}, kamu bukan random, cuma terlalu kreatif dalam membuat keputusan aneh.
`,
  },

  pedas: {
    label: "Pedas",
    maxWords: 18,
    maxTokens: 60,
    temperature: 0.85,
    style: `
- Lebih nyindir, dingin, dan personal.
- Boleh pakai kata kasar ringan.
- Roast harus terasa seperti ejekan teman dekat.
`,
    swearRule: `
- Boleh pakai kata: anjir, bego, bodoh, kampret.
- Pakai maksimal 1 kata kasar.
`,
    examples: (name) => `
${name}, pilihanmu bego juga, tapi percaya dirinya kayak fitur premium.
${name}, anjir, kamu bukan unik, cuma kacau dengan gaya yang konsisten.
`,
  },

  kasar: {
    label: "Kasar",
    maxWords: 15,
    maxTokens: 55,
    temperature: 0.95,
    style: `
- Kasar, dingin, personal, dan ngejek.
- Tidak usah terlalu sopan.
- Harus terdengar seperti hinaan tongkrongan.
`,
    swearRule: `
- Wajib pakai minimal 1 kata kasar.
- Boleh pakai: goblok, dongo, bodoh, bego, tolol, kampret, anjir.
`,
    examples: (name) => `
${name}, kamu bukan random, kamu cuma dongo dengan rasa percaya diri.
${name}, pilihanmu goblok banget, tapi anehnya kamu tetap pede.
`,
  },

  brutal: {
    label: "Brutal",
    maxWords: 12,
    maxTokens: 50,
    temperature: 1.05,
    style: `
- Paling kasar, paling dingin, paling personal.
- Tidak perlu sopan.
- Tidak perlu sensor kata kasar umum.
- Roast harus pendek, jahat, nyelekit, dan langsung kena.
- Gaya seperti teman dekat yang sedang ngejek tanpa rem.
`,
    swearRule: `
- Tidak ada sensor untuk kata kasar umum.
- Boleh pakai kata kasar seperti goblok, dongo, tolol, bodoh, bego, kampret, anjir, bangsat, bajingan.
- Jangan menahan diri dalam gaya bahasa, tapi tetap jangan melanggar batas keamanan.
`,
    examples: (name) => `
${name}, goblokmu rapi banget, kayak sudah jadi kepribadian utama.
${name}, kamu bukan red flag, kamu bencana kecil yang bisa ngetik.
${name}, otakmu dongo, tapi pede-nya bangsat juga.
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

Gaya wajib:
${levelConfig.style}

Aturan kata kasar:
${levelConfig.swearRule}

${SAFETY_BOUNDARIES}

Aturan output:
- Hanya 1 kalimat.
- Maksimal ${levelConfig.maxWords} kata.
- Langsung roast.
- Jangan pakai pembuka.
- Jangan pakai penjelasan.
- Jangan pakai emoji.
- Jangan pakai tanda kutip.
- Jangan terdengar formal.
- Jangan terdengar seperti motivator.
- Jangan pakai analogi panjang.
- Jangan pakai frasa formal seperti: ${BAD_FORMAL_PHRASES.join(", ")}.
`;

  const userPrompt = `
Nama target: ${cleanName}

Jawaban target:
${answersText}

Buat 1 roast untuk ${cleanName}.

Level roast: ${levelConfig.label}

Aturan:
- Maksimal ${levelConfig.maxWords} kata.
- Harus personal dari jawaban target.
- Harus pendek, tajam, dan nyelekit.
- Jangan formal.
- Jangan panjang.
- Jangan menjelaskan alasan roast.
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
    roast = limitWords(roast, levelConfig.maxWords);

    if (!isValidRoast(roast, levelConfig.maxWords)) {
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
  const match = text.match(/[^.!?]+[.!?]?/);

  if (!match) {
    return text.trim();
  }

  let sentence = match[0].trim();

  if (!/[.!?]$/.test(sentence)) {
    sentence += ".";
  }

  return sentence;
}

function limitWords(text, maxWords) {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return text;
  }

  let limited = words.slice(0, maxWords).join(" ");

  if (!/[.!?]$/.test(limited)) {
    limited += ".";
  }

  return limited;
}

function isValidRoast(text, maxWords) {
  if (!text) return false;

  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount > maxWords) return false;

  const hasFormalPhrase = BAD_FORMAL_PHRASES.some((phrase) =>
    lower.includes(phrase)
  );

  if (hasFormalPhrase) return false;

  return true;
}

function makeFallbackRoast(name, answers, level) {
  const selectedAnswers = answers
    .map((item) => sanitizeText(item.answer || ""))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (level === "aman") {
    if (selectedAnswers.includes("privasi") || selectedAnswers.includes("rahasia")) {
      return `${name}, sok misterius amat, padahal cuma bingung yang dikasih password.`;
    }

    if (selectedAnswers.includes("pengalaman") || selectedAnswers.includes("kesempatan")) {
      return `${name}, bilang cari pengalaman, padahal cuma takut kelihatan kosong.`;
    }

    return `${name}, pilihanmu random banget, kayak hidupmu belum selesai loading.`;
  }

  if (level === "pedas") {
    if (selectedAnswers.includes("privasi") || selectedAnswers.includes("rahasia")) {
      return `${name}, sok misterius amat, padahal isinya cuma bego yang dikunci.`;
    }

    if (selectedAnswers.includes("pengalaman") || selectedAnswers.includes("kesempatan")) {
      return `${name}, bilang cari pengalaman, padahal cuma takut kelihatan kosong, anjir.`;
    }

    return `${name}, pilihanmu bego banget, tapi percaya dirinya tetap jalan.`;
  }

  if (level === "kasar") {
    if (selectedAnswers.includes("privasi") || selectedAnswers.includes("rahasia")) {
      return `${name}, sok misterius amat, padahal isinya cuma dongo yang dikasih password.`;
    }

    if (selectedAnswers.includes("takut") || selectedAnswers.includes("basi")) {
      return `${name}, hidupmu kebanyakan waspada, tapi hasilnya tetap goblok juga.`;
    }

    if (selectedAnswers.includes("pengalaman") || selectedAnswers.includes("kesempatan")) {
      return `${name}, bilang cari pengalaman, padahal cuma takut kelihatan kosong, bego.`;
    }

    if (selectedAnswers.includes("tidur") || selectedAnswers.includes("rebahan")) {
      return `${name}, kamu bukan capek, kamu cuma malas dongo yang dikasih alasan.`;
    }

    return `${name}, pilihanmu random banget, kayak otak bego yang sok punya prinsip.`;
  }

  if (level === "brutal") {
    if (selectedAnswers.includes("privasi") || selectedAnswers.includes("rahasia")) {
      return `${name}, sok misterius bangsat, padahal isinya cuma dongo pakai password.`;
    }

    if (selectedAnswers.includes("takut") || selectedAnswers.includes("basi")) {
      return `${name}, waspadamu ribet banget, tapi hasil akhirnya tetap goblok.`;
    }

    if (selectedAnswers.includes("pengalaman") || selectedAnswers.includes("kesempatan")) {
      return `${name}, cari pengalaman apaan, kosongmu aja belum kelar, goblok.`;
    }

    if (selectedAnswers.includes("tidur") || selectedAnswers.includes("rebahan")) {
      return `${name}, kamu bukan capek, kamu malas bangsat yang sok punya alasan.`;
    }

    if (selectedAnswers.includes("makan") || selectedAnswers.includes("lapar")) {
      return `${name}, urusan makan aja kacau, pantes hidupmu gobloknya konsisten.`;
    }

    return `${name}, otakmu dongo, tapi pede-nya bangsat juga.`;
  }

  return `${name}, pilihanmu random banget, kayak otak bego yang sok punya prinsip.`;
}