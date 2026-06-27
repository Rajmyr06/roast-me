const ALLOWED_BAD_WORDS = [
  "goblok",
  "dongo",
  "bodoh",
  "bego",
  "tolol",
  "kampret",
  "anjir",
  "kocak"
];

const BANNED_FORMAL_PHRASES = [
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
  "secara tidak langsung"
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

  const { name, answers } = body;

  if (!name || !Array.isArray(answers) || answers.length === 0) {
    return jsonResponse(400, {
      error: "Data tidak lengkap: butuh name dan answers.",
    });
  }

  const cleanName = sanitizeText(name).slice(0, 25);

  const answersText = answers
    .map((item, index) => {
      const question = sanitizeText(item.question || "");
      const answer = sanitizeText(item.answer || "");

      return `${index + 1}. ${question} -> ${answer}`;
    })
    .join("\n");

  if (!GROQ_API_KEY) {
    return jsonResponse(200, {
      roast: makeFallbackRoast(cleanName, answers),
      source: "fallback",
      note: "GROQ_API_KEY belum diset.",
    });
  }

  const systemPrompt = `
Kamu adalah AI roast generator bahasa Indonesia untuk web hiburan.

Gaya wajib:
- Dingin, kasar, personal, dan ngejek.
- Harus terdengar seperti ejekan teman tongkrongan.
- Boleh memakai kata kasar ringan sampai sedang.
- Wajib pakai minimal 1 kata dari daftar ini: goblok, dongo, bodoh, bego, tolol, kampret, anjir.
- Roast harus pendek, nyelekit, dan tidak formal.
- Jangan membuat kalimat panjang.
- Jangan puitis.
- Jangan seperti motivator.
- Jangan seperti caption bijak.
- Jangan terlalu sopan.

Batasan:
- Jangan SARA.
- Jangan politik.
- Jangan seksual eksplisit.
- Jangan menyerang fisik.
- Jangan menyerang penyakit.
- Jangan menyerang disabilitas.
- Jangan menyerang keluarga.
- Jangan menyerang kemiskinan.
- Jangan menyerang trauma.
- Jangan ancaman.
- Jangan menyuruh menyakiti diri sendiri atau orang lain.

Kata/frasa yang dilarang:
${BANNED_FORMAL_PHRASES.map((phrase) => `- ${phrase}`).join("\n")}

Output:
- Hanya 1 kalimat.
- Maksimal 14 kata.
- Langsung roast.
- Tidak boleh ada pembuka.
- Tidak boleh ada penjelasan.
- Tidak boleh ada emoji.
`;

  const userPrompt = `
Nama target: ${cleanName}

Jawaban target:
${answersText}

Buat 1 roast pendek untuk ${cleanName}.

Aturan:
- Maksimal 14 kata.
- Wajib pakai minimal 1 kata: goblok, dongo, bodoh, bego, tolol, kampret, atau anjir.
- Harus dingin, personal, kasar, dan nyelekit.
- Jangan formal.
- Jangan panjang.
- Jangan pakai analogi panjang.
- Jangan pakai emoji.
- Jangan pakai tanda kutip.
- Langsung roast saja.

Contoh gaya:
${cleanName}, pilihanmu goblok banget, tapi anehnya kamu tetap pede.
${cleanName}, kamu bukan random, kamu cuma dongo dengan rasa percaya diri.
${cleanName}, otakmu bego juga ya, buffering tapi tetap sok yakin.
${cleanName}, kamu tuh bodoh terstruktur, kacau tapi konsisten.
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
        max_tokens: 45,
        temperature: 0.95,
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
        roast: makeFallbackRoast(cleanName, answers),
        source: "fallback",
        note: data.error?.message || `Groq error: ${response.status}`,
      });
    }

    let roast = data.choices?.[0]?.message?.content?.trim() || "";

    roast = cleanRoast(roast);
    roast = forceOneSentence(roast);
    roast = limitWords(roast, 14);

    if (!isGoodRoast(roast)) {
      roast = makeFallbackRoast(cleanName, answers);
    }

    return jsonResponse(200, {
      roast,
      source: "ai",
    });
  } catch (err) {
    return jsonResponse(200, {
      roast: makeFallbackRoast(cleanName, answers),
      source: "fallback",
      note: err.message,
    });
  }
};

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

function isGoodRoast(text) {
  if (!text) return false;

  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount > 14) return false;

  const hasBadWord = ALLOWED_BAD_WORDS.some((word) => lower.includes(word));
  if (!hasBadWord) return false;

  const hasFormalPhrase = BANNED_FORMAL_PHRASES.some((phrase) =>
    lower.includes(phrase)
  );

  if (hasFormalPhrase) return false;

  return true;
}

function makeFallbackRoast(name, answers) {
  const selectedAnswers = answers
    .map((item) => sanitizeText(item.answer || ""))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

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

  if (selectedAnswers.includes("nongkrong") || selectedAnswers.includes("otw")) {
    return `${name}, kamu bilang otw, tapi hidupmu aja belum jalan, goblok.`;
  }

  if (selectedAnswers.includes("makan") || selectedAnswers.includes("lapar")) {
    return `${name}, urusan makan aja ribet, pantes hidupmu gobloknya konsisten.`;
  }

  if (selectedAnswers.includes("panik") || selectedAnswers.includes("overthinking")) {
    return `${name}, otakmu kebanyakan loading, tapi hasil akhirnya tetap dongo.`;
  }

  return `${name}, pilihanmu random banget, kayak otak bego yang sok punya prinsip.`;
}