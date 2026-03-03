import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

// Initialize the model provider
const model = createOpenAICompatible({
  name: 'ocr-model',
  baseURL: process.env.MODEL_API_BASE || '',
  apiKey: process.env.MODEL_API_KEY || '',
});

export async function performOCR(imageBuffer): Promise<string> {
  try {
    // Convert buffer to base64
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    const { text } = await generateText({
      model: model(process.env.OCR_MODEL_NAME || ''),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Please extract the text from this image. Only output the extracted text, no other commentary.' },
            { type: 'image', image: imageUrl },
          ],
        },
      ],
    });

    return text;
  } catch (error) {
    console.error('model OCR error:', error);
    throw new Error('Failed to perform OCR with model');
  }
}