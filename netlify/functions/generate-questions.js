exports.handler = async function (event, context) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "GROQ_API_KEY belum diset di Netlify environment variables." }),
    };
  }

  const prompt = `Buat 5 pertanyaan pilihan ganda absurd dan lucu untuk website roast. Setiap pertanyaan punya tepat 4 pilihan jawaban.

Syarat:
- Topik random: kebiasaan aneh, situasi awkward, dilema receh, preferensi absurd
- Jangan tentang kuliah, pekerjaan, atau politik
- Relatable untuk anak muda Indonesia
- Setiap pilihan jawaban mencerminkan tipe kepribadian yang berbeda

Balas HANYA dengan JSON di bawah ini, tanpa teks lain, tanpa markdown, tanpa komentar:
{"questions":[{"text":"isi pertanyaan di sini","options":["pilihan A","pilihan B","pilihan C","pilihan D"]}]}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 800,
        temperature: 1.0,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: data.error?.message || `Groq error: ${response.status}` }),
      };
    }

    let raw = data.choices?.[0]?.message?.content?.trim() || "";

    // Bersihkan markdown jika ada
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    // Ambil JSON dari dalam string (antisipasi ada teks sebelum/sesudah)
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Tidak ada JSON valid dalam respons Groq.");

    const parsed = JSON.parse(match[0]);

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error("Format JSON tidak sesuai.");
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
