const { GoogleGenAI } = require('@google/genai');

module.exports = async function handler(req, res) {
  // CORS 처리
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' });
    }

    // req.body 파싱
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    body = body || {};

    const { mode, image, word, category } = body;

    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';

    let prompt = '';
    let contents = [];

    if (mode === 'ocr') {
      if (!image) {
        return res.status(400).json({ error: '이미지 데이터가 전달되지 않았습니다.' });
      }
      
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      prompt = `
You are an expert English vocabulary extractor for Korean students.
Extract all English words from the image provided. 
For each word, provide:
1. English word
2. Part of speech (명, 동, 형, 부 등)
3. Korean meaning
4. One simple English example sentence with Korean translation

Return ONLY a valid JSON array format like this:
[
  {
    "word": "apple",
    "pos": "명",
    "meaning": "사과",
    "exampleEn": "She eats an apple every morning.",
    "exampleKo": "그녀는 매일 아침 사과를 먹는다."
  }
]
No additional markdown explanation, just the raw JSON code block or array.
`;

      contents = [
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        }
      ];

    } else if (mode === 'preset') {
      prompt = `
Generate 10 high-school level English vocabulary words for the theme/category: "${category || '고교 필수 핵심 단어'}".
For each word, provide:
1. English word
2. Part of speech
3. Korean meaning
4. One simple English example sentence with Korean translation

Return ONLY a valid JSON array format like this:
[
  {
    "word": "subsequent",
    "pos": "형",
    "meaning": "그 다음의, 차후의",
    "exampleEn": "Subsequent events proved that he was right.",
    "exampleKo": "그 후에 일어난 사건들은 그가 맞았음을 증명했다."
  }
]
No additional markdown explanation, just the raw JSON array.
`;
      contents = [prompt];

    } else if (mode === 'detail') {
      prompt = `
Analyze the English word: "${word}".
Provide comprehensive information for high-school level study.
Return ONLY a valid JSON object format like this:
{
  "word": "${word}",
  "pos": "형",
  "meaning": "본래의, 선천적인",
  "synonyms": ["innate", "native", "inborn"],
  "antonyms": ["acquired", "learned"],
  "exampleEn": "Her inherent love of music was obvious from childhood.",
  "exampleKo": "음악에 대한 그녀의 타고난 사랑은 어릴 때부터 분명했다."
}
No additional markdown, just the raw JSON object.
`;
      contents = [prompt];

    } else {
      return res.status(400).json({ error: '올바르지 않은 모드(mode) 요청입니다.' });
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: contents
    });

    let textResponse = response.text || '';
    // JSON 마크다운 태그 정리
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const jsonParsed = JSON.parse(textResponse);
      return res.status(200).json({ result: jsonParsed });
    } catch (e) {
      return res.status(200).json({ rawResult: textResponse });
    }

  } catch (error) {
    console.error("Vercel Server Error:", error);
    return res.status(500).json({
      error: '서버 내부 오류가 발생했습니다.',
      message: error.message || '알 수 없는 오류'
    });
  }
};
