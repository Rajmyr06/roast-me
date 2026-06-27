const fallbackQuestionBank = [
  {
    text: "Kalau social battery kamu tinggal 3%, kamu bakal gimana?",
    options: [
      "Tetap ikut nongkrong biar nggak FOMO",
      "Bilang otw padahal masih rebahan",
      "Mute semua chat, disappear mode",
      "Datang, tapi muka kayak loading screen"
    ]
  },
  {
    text: "Kalau crush cuma balas 'wkwk', reaction kamu apa?",
    options: [
      "Overthinking sampai bikin teori sendiri",
      "Balas santai padahal hati kebakar",
      "Act cool kayak nggak peduli",
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
  },
  {
    text: "Kalau diajak keluar dadakan, kamu paling relate sama yang mana?",
    options: [
      "Mau ikut, tapi butuh mental preparation dulu",
      "Langsung gas karena FOMO tidak bisa dilawan",
      "Nanya siapa aja, padahal niatnya nolak",
      "Bilang lihat nanti, terus hilang dari bumi"
    ]
  },
  {
    text: "Kalau isi kepalamu jadi aplikasi, bentuknya apa?",
    options: [
      "Notes penuh ide tapi nggak ada yang jalan",
      "Maps error, muter-muter tapi pede",
      "Spotify sad playlist premium",
      "Calendar penuh rencana palsu"
    ]
  },
  {
    text: "Kalau ada chat belum dibalas 2 jam, kamu bakal:",
    options: [
      "Act chill, tapi cek HP tiap 3 menit",
      "Langsung bikin skenario ditinggal",
      "Balas lebih lama biar kelihatan cool",
      "Unsend perasaan sendiri kalau bisa"
    ]
  },
  {
    text: "Vibes kamu kalau lagi di tempat rame:",
    options: [
      "Body hadir, soul sudah pulang",
      "Ketawa doang biar nggak awkward",
      "Sok asik sampai capek sendiri",
      "Diam, tapi judgment internal aktif"
    ]
  },
  {
    text: "Kalau hidup kasih kamu problem baru, kamu:",
    options: [
      "Bilang bisa, terus panik diam-diam",
      "Overthinking sampai problem-nya bosan",
      "Cari distraksi biar problem ketunda",
      "Pura-pura nggak lihat kayak email promo"
    ]
  },
  {
    text: "Kalau disuruh describe diri pakai satu vibe:",
    options: [
      "Soft launch chaos",
      "Main character gagal render",
      "Red flag tapi aesthetic",
      "Low energy high drama"
    ]
  },
  {
    text: "Kalau mood kamu hari ini jadi cuaca:",
    options: [
      "Mendung with trust issue",
      "Panas dikit langsung emosional",
      "Gerimis aesthetic tapi ribet",
      "Cerah palsu, dalamnya storm"
    ]
  },
  {
    text: "Kalau teman bilang 'spill dong', kamu bakal:",
    options: [
      "Spill lengkap plus analisis karakter",
      "Bilang nggak tahu, padahal tahu semua",
      "Kasih teaser biar mereka penasaran",
      "Silent mode karena takut kebawa drama"
    ]
  },
  {
    text: "Kalau rencana hidup kamu punya status, isinya:",
    options: [
      "Pending approval from semesta",
      "Draft belum disimpan",
      "Error 404 direction not found",
      "Coming soon tapi nggak tahu kapan"
    ]
  },
  {
    text: "Kalau disuruh milih satu coping mechanism:",
    options: [
      "Jajan impulsif biar valid",
      "Tidur sampai lupa eksis",
      "Bikin rencana baru tanpa eksekusi",
      "Ketawa dulu, hancur belakangan"
    ]
  }
];

exports.handler = async function () {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  if (!GROQ_API_KEY) {
    return jsonResponse(200, {
      questions: getRandomQuestions(),
      source: "fallback",
      nonce,
      note: "GROQ_API_KEY belum diset."
    });
  }

  const prompt = `
Buat tepat 5 pertanyaan pilihan ganda absurd dan lucu untuk website AI roast.

Nonce unik agar hasil tidak sama: ${nonce}

Gaya bahasa:
- Bahasa Indonesia campur English ala Jaksel.
- Gunakan slang seperti: literally, honestly, lowkey, vibes, red flag, valid, bestie, FOMO, overthinking, social battery, trust issue, spill, energy.
- Relatable untuk anak muda Indonesia.
- Nada santai, receh, nyebelin, dan modern.
- Jangan formal.
- Jangan seperti soal ujian.
- Jangan terlalu panjang.

Syarat:
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
        max_tokens: 750,
        temperature: 1.05,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Kamu hanya boleh membalas JSON valid. Jangan gunakan markdown, komentar, atau teks tambahan."
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
        questions: getRandomQuestions(),
        source: "fallback",
        nonce,
        note: data.error?.message || `Groq error: ${response.status}`,
      });
    }

    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    const parsed = safeParseJson(raw);

    if (!isValidQuestions(parsed.questions)) {
      return jsonResponse(200, {
        questions: getRandomQuestions(),
        source: "fallback",
        nonce,
        note: "Format pertanyaan dari Groq tidak sesuai.",
      });
    }

    return jsonResponse(200, {
      questions: parsed.questions,
      source: "ai",
      nonce,
    });
  } catch (err) {
    return jsonResponse(200, {
      questions: getRandomQuestions(),
      source: "fallback",
      nonce,
      note: err.message,
    });
  }
};

function getRandomQuestions() {
  return shuffle(fallbackQuestionBank)
    .slice(0, 5)
    .map((question) => ({
      text: question.text,
      options: shuffle(question.options).slice(0, 4),
    }));
}

function shuffle(items) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
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
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
    body: JSON.stringify(body),
  };
}