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

  const cleanName = sanitizeText(name).slice(0, 30);

  const answersText = answers
    .map((item, index) => {
      const question = sanitizeText(item.question || "");
      const answer = sanitizeText(item.answer || "");

      return `Nomor ${index + 1}
Pertanyaan: ${question}
Jawaban: ${answer}`;
    })
    .join("\n\n");

  if (!GROQ_API_KEY) {
    return jsonResponse(200, {
      roast: makeFallbackRoast(cleanName, answers),
      source: "fallback",
      note: "GROQ_API_KEY belum diset.",
    });
  }

  const systemPrompt = `
Kamu adalah generator roast bahasa Indonesia.

Gaya roast:
- Dingin.
- Menusuk.
- Personal berdasarkan jawaban user.
- Ngejek secara lucu.
- Singkat, tajam, dan tidak bertele-tele.

Batasan wajib:
- Jangan SARA.
- Jangan politik.
- Jangan seksual.
- Jangan menyerang fisik, disabilitas, penyakit, keluarga, kemiskinan, atau trauma.
- Jangan menggunakan kata kasar ekstrem.
- Jangan memberi nasihat.
- Jangan membuat cerita panjang.
- Jangan pakai emoji.
- Jangan pakai pembuka seperti "Oke", "Baik", atau "Ini roast-nya".
- Jangan sebut "berdasarkan jawabanmu".
- Jangan terdengar seperti motivator.
- Jangan terlalu aman atau terlalu sopan.
- Output hanya roast final.
`;

  const userPrompt = `
Nama target: ${cleanName}

Jawaban target:
${answersText}

Tugas:
Buat roast untuk ${cleanName}.

Aturan output:
- Maksimal 2 kalimat.
- Maksimal 28 kata.
- Harus terasa personal dari pilihan jawabannya.
- Harus lebih nyelekit daripada lucu receh.
- Jangan pakai analogi panjang.
- Jangan mengulang pola "kamu kayak...".
- Jangan menjelaskan alasan roast.
- Langsung tulis roast-nya saja.

Contoh gaya:
${cleanName}, kamu bukan misterius, cuma susah dipahami karena isinya juga belum tentu jelas. Bahkan pilihan hidupmu kelihatan seperti hasil klik asal.
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
        max_tokens: 80,
        temperature: 0.75,
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
    roast = limitRoast(roast, 28);

    if (!roast) {
      return jsonResponse(200, {
        roast: makeFallbackRoast(cleanName, answers),
        source: "fallback",
        note: "Respons roast kosong dari Groq.",
      });
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
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limitRoast(text, maxWords) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];

  let limited = sentences
    .slice(0, 2)
    .join(" ")
    .trim();

  const words = limited.split(/\s+/);

  if (words.length > maxWords) {
    limited = words.slice(0, maxWords).join(" ");

    if (!/[.!?]$/.test(limited)) {
      limited += ".";
    }
  }

  return limited;
}

function makeFallbackRoast(name, answers) {
  const selectedAnswers = answers
    .map((item) => sanitizeText(item.answer || ""))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (selectedAnswers.includes("privasi") || selectedAnswers.includes("rahasia")) {
    return `${name}, kamu sok misterius, padahal yang bikin orang penasaran cuma kenapa pilihanmu seberantakan itu.`;
  }

  if (selectedAnswers.includes("takut") || selectedAnswers.includes("basi")) {
    return `${name}, kamu hidupnya penuh antisipasi, tapi tetap kelihatan seperti orang yang kalah duluan sebelum mulai.`;
  }

  if (selectedAnswers.includes("pengalaman") || selectedAnswers.includes("kesempatan")) {
    return `${name}, kamu bilang cari pengalaman, tapi auranya lebih mirip orang yang ikut-ikutan biar tidak kelihatan kosong.`;
  }

  if (selectedAnswers.includes("tidur") || selectedAnswers.includes("rebahan")) {
    return `${name}, kamu bukan butuh istirahat, kamu butuh alasan baru supaya kelihatan hidupmu punya arah.`;
  }

  return `${name}, pilihanmu punya energi orang yang sok santai, tapi sebenarnya panik kalau hidup mulai minta keputusan.`;
}