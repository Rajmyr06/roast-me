const fallbackQuestions = [
  {
    text: "Kalau social battery kamu lagi 3%, kamu bakal gimana?",
    options: [
      "Tetap ikut nongkrong biar nggak FOMO",
      "Bilang otw padahal masih rebahan",
      "Mute semua chat, disappear mode",
      "Datang, tapi mukanya kayak loading screen"
    ]
  },
  {
    text: "Kalau crush cuma balas 'wkwk', reaction kamu apa?",
    options: [
      "Overthinking sampai bikin teori sendiri",
      "Balas santai padahal hati kebakar",
      "Langsung act cool kayak nggak peduli",
      "Udah tahu kalah, tapi tetap lanjut"
    ]
  },
  {
    text: "Pilih toxic trait yang paling kamu banget:",
    options: [
      "Sok chill, padahal panik internally",
      "Niat produktif, eksekusinya cuma buka laptop",
      "Ngilang dulu, baru jelasin nanti",
      "Bilang gapapa, tapi dendamnya premium"
    ]
  },
  {
    text: "Kalau hidup kamu punya genre Netflix, paling cocok apa?",
    options: [
      "Drama low budget tapi konfliknya banyak",
      "Comedy of errors, literally tiap hari",
      "Thriller deadline yang nggak selesai-selesai",
      "Documentary orang sok kuat"
    ]
  },
  {
    text: "Kalau lagi punya masalah, kamu biasanya:",
    options: [
      "Bilang fine, terus collapse sendiri",
      "Curhat panjang, tapi tetap nggak berubah",
      "Bikin playlist sedih biar makin valid",
      "Tidur, berharap problem-nya logout sendiri"
    ]
  }
];

exports.handler = async function () {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    return jsonResponse(200, {
      questions: fallbackQuestions,
      source: "fallback",
      note: "GROQ_API_KEY belum diset."
    });
  }

  const prompt = `
Buat tepat 5 pertanyaan pilihan ganda absurd dan lucu untuk website AI roast.

Gaya bahasa:
- Bahasa Indonesia campur English ala Jaksel.
- Gunakan slang seperti: literally, honestly, lowkey, vibes, red flag, valid, bestie, FOMO, overthinking, social battery, trust issue, spill, energy.
- Relatable untuk anak muda Indonesia.
- Nada harus santai, receh, nyebelin, dan modern.
- Jangan terlalu formal.
- Jangan pakai bahasa baku seperti soal ujian.
- Jangan terlalu panjang.

Syarat konten:
- Topik random: kebiasaan aneh, situasi awkward, dilema receh, social battery, FOMO, overthinking, chat crush, nongkrong, mood swing.
- Jangan tentang kuliah, pekerjaan, politik, SARA, seksual eksplisit, penyakit, disabilitas, keluarga, trauma, atau fisik.
- Setiap pertanyaan punya tepat 4 pilihan jawaban.
- Setiap pilihan jawaban mencerminkan tipe kepribadian berbeda.
- Jangan gunakan markdown.
- Balas hanya JSON valid.

Format wajib:
{
  "questions": [
    {
      "text": "isi pertanyaan",
      "options": ["pilihan A", "pilihan B", "pilihan C", "pilihan D"]
    }
  ]
}
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
        max_tokens: 700,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Kamu hanya boleh membalas JSON valid. Jangan gunakan markdown, komentar, atau teks tambahan."
          },
          {
            role: "user",
            content: prompt
          }
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return jsonResponse(200, {
        questions: fallbackQuestions,
        source: "fallback",
        note: data.error?.message || `Groq error: ${response.status}`,
      });
    }

    const raw = data.choices?.[0]?.message?.content?.trim() || "";

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return jsonResponse(200, {
        questions: fallbackQuestions,
        source: "fallback",
        note: "Respons Groq bukan JSON valid.",
      });
    }

    if (!isValidQuestions(parsed.questions)) {
      return jsonResponse(200, {
        questions: fallbackQuestions,
        source: "fallback",
        note: "Format pertanyaan dari Groq tidak sesuai.",
      });
    }

    return jsonResponse(200, {
      questions: parsed.questions,
      source: "ai",
    });
  } catch (err) {
    return jsonResponse(200, {
      questions: fallbackQuestions,
      source: "fallback",
      note: err.message,
    });
  }
};

function isValidQuestions(questions) {
  return (
    Array.isArray(questions) &&
    questions.length === 5 &&
    questions.every((question) => {
      return (
        typeof question.text === "string" &&
        question.text.trim().length > 0 &&
        Array.isArray(question.options) &&
        question.options.length === 4 &&
        question.options.every(
          (option) => typeof option === "string" && option.trim().length > 0
        )
      );
    })
  );
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}