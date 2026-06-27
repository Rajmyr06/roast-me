exports.handler = async function (event) {
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
- Kasar ringan sampai sedang boleh.
- Boleh pakai kata seperti: anjir, goblok, tolol, bego, kampret, buset.
- Dingin, nyebelin, personal, dan ngejek.
- Harus terdengar seperti ejekan teman tongkrongan, bukan kalimat formal.
- Singkat dan langsung nusuk.

Batasan:
- Jangan SARA.
- Jangan politik.
- Jangan seksual eksplisit.
- Jangan menyerang fisik, penyakit, disabilitas, keluarga, kemiskinan, atau trauma.
- Jangan ancaman.
- Jangan memberi nasihat.
- Jangan terdengar puitis.
- Jangan terdengar seperti motivator.
- Jangan memakai kalimat formal.

Kata/frasa yang dilarang:
- sepertinya
- kehidupanmu
- komedi situasional
- skenario
- berdasarkan jawabanmu
- mencerminkan
- menunjukkan bahwa
- mungkin kamu perlu
- kamu adalah pribadi
- tampaknya

Output:
- Hanya 1 kalimat.
- Maksimal 16 kata.
- Tidak boleh ada pembuka.
- Tidak boleh ada penjelasan.
`;

  const userPrompt = `
Nama: ${cleanName}

Jawaban:
${answersText}

Buat 1 roast pendek untuk ${cleanName}.

Aturan:
- Maksimal 16 kata.
- Harus dingin, kasar, personal, dan nyelekit.
- Jangan formal.
- Jangan panjang.
- Jangan pakai analogi panjang.
- Jangan pakai emoji.
- Langsung roast saja.

Contoh gaya:
${cleanName}, pilihanmu gobloknya konsisten, kayak hidupmu dikendalikan tombol skip.
${cleanName}, kamu bukan random, kamu cuma berantakan dan terlalu pede buat sadar.
${cleanName}, auramu kayak orang sok santai, padahal isi kepalanya error 404.
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
        temperature: 1.0,
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
    roast = limitWords(roast, 16);

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
    },
    body: JSON.stringify(body),
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
  if (!match) return text.trim();

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
  const bannedFormalWords = [
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
  ];

  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (!text || wordCount > 16) return false;

  return !bannedFormalWords.some((word) => lower.includes(word));
}

function makeFallbackRoast(name, answers) {
  const selectedAnswers = answers
    .map((item) => sanitizeText(item.answer || ""))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (selectedAnswers.includes("privasi") || selectedAnswers.includes("rahasia")) {
    return `${name}, sok misterius amat, padahal isinya cuma kebingungan yang dikasih password.`;
  }

  if (selectedAnswers.includes("takut") || selectedAnswers.includes("basi")) {
    return `${name}, hidupmu kebanyakan waspada, tapi hasilnya tetap goblok juga.`;
  }

  if (selectedAnswers.includes("pengalaman") || selectedAnswers.includes("kesempatan")) {
    return `${name}, bilang cari pengalaman, padahal cuma takut kelihatan kosong.`;
  }

  if (selectedAnswers.includes("tidur") || selectedAnswers.includes("rebahan")) {
    return `${name}, kamu bukan capek, kamu cuma malas yang kebetulan punya nama.`;
  }

  if (selectedAnswers.includes("nongkrong") || selectedAnswers.includes("otw")) {
    return `${name}, kamu bilang otw, tapi hidupmu aja belum jalan.`;
  }

  return `${name}, pilihanmu random banget, kayak otakmu lagi buffering tapi sok yakin.`;
}