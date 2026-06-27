exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed." }),
    };
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "GROQ_API_KEY belum diset di Netlify environment variables." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Request body tidak valid." }),
    };
  }

  const { name, answers } = body;

  if (!name || !Array.isArray(answers) || answers.length === 0) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Data tidak lengkap: butuh name dan answers." }),
    };
  }

  const answersText = answers
    .map((a, i) => `Pertanyaan ${i + 1}: ${a.question}\nJawaban: ${a.answer}`)
    .join("\n\n");

  const prompt = `Kamu adalah roaster profesional yang jago roast seseorang dengan cara yang lucu, relatable, dan sedikit pedas — tapi tidak kasar, tidak menyinggung SARA, dan tidak vulgar.

Nama orang yang di-roast: ${name}

Jawaban-jawaban yang dia pilih:
${answersText}

Instruksi:
- Tulis roast personal 4–6 kalimat berdasarkan pola jawaban di atas
- Bahasa Indonesia gaul, santai, natural — bukan formal
- Boleh hiperbola atau analogi lucu
- Akhiri dengan satu kalimat nyindir yang tetap lucu
- Langsung tulis roast-nya, tanpa pembuka "Oke", "Baik", atau semacamnya
- Jangan pakai emoji`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 400,
        temperature: 0.9,
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

    const roast = data.choices?.[0]?.message?.content?.trim();

    if (!roast) throw new Error("Respons roast kosong dari Groq.");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roast }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
