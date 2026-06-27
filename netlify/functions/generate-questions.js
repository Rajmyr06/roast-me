const fallbackQuestions = [
  {
    text: "Kalau diajak nongkrong dadakan, reaksi kamu?",
    options: [
      "Langsung gas walau belum mandi",
      "Nanya dulu siapa aja yang ikut",
      "Bilang otw padahal masih rebahan",
      "Auto nolak karena baterai sosial tinggal 3%"
    ]
  },
  {
    text: "Kalau chat kamu cuma dibalas 'wkwk', kamu bakal?",
    options: [
      "Balas wkwk juga biar impas",
      "Overthinking sampai besok",
      "Ganti topik dengan panik",
      "Langsung sadar diri lalu menghilang"
    ]
  },
  {
    text: "Pilih kemampuan absurd yang paling cocok buat kamu:",
    options: [
      "Bisa lapar lagi 5 menit setelah makan",
      "Bisa tidur kapan saja kecuali malam",
      "Bisa lupa tugas tapi ingat drama orang",
      "Bisa niat produktif tanpa benar-benar produktif"
    ]
  },
  {
    text: "Kalau hidup kamu jadi film, genrenya apa?",
    options: [
      "Komedi salah paham",
      "Drama low budget",
      "Thriller deadline",
      "Dokumenter orang bingung"
    ]
  },
  {
    text: "Kalau disuruh mendeskripsikan diri pakai satu benda:",
    options: [
      "Charger rusak tapi masih dipaksa hidup",
      "Kursi plastik kondangan",
      "Kopi dingin yang terlupakan",
      "Alarm yang selalu disnooze"
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
Buat tepat 5 pertanyaan pilihan ganda absurd dan lucu untuk website roast.

Syarat:
- Bahasa Indonesia.
- Topik random: kebiasaan aneh, situasi awkward, dilema receh, preferensi absurd.
- Jangan tentang kuliah, pekerjaan, politik, SARA, atau hal vulgar.
- Relatable untuk anak muda Indonesia.
- Setiap pertanyaan punya tepat 4 pilihan jawaban.
- Setiap pilihan mencerminkan tipe kepribadian yang berbeda.
- Balas hanya JSON valid.
- Jangan gunakan markdown.
- Jangan beri penjelasan tambahan.

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
        max_tokens: 600,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Kamu hanya boleh membalas JSON valid. Jangan gunakan markdown atau teks tambahan."
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
        note: data.error?.message || `Groq error: ${response.status}`
      });
    }

    let raw = data.choices?.[0]?.message?.content?.trim() || "";

    raw = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(raw);

    if (!isValidQuestions(parsed.questions)) {
      return jsonResponse(200, {
        questions: fallbackQuestions,
        source: "fallback",
        note: "Format pertanyaan dari Groq tidak sesuai."
      });
    }

    return jsonResponse(200, {
      questions: parsed.questions,
      source: "ai"
    });

  } catch (err) {
    return jsonResponse(200, {
      questions: fallbackQuestions,
      source: "fallback",
      note: err.message
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