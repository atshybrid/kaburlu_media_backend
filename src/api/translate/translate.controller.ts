
import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google AI client
if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY environment variable is not set. Translation services will not work.');
}
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export const translateTextController = async (req: Request, res: Response) => {
  try {
    if(!genAI) {
      return res.status(500).json({
        success: false,
        message: 'Translation services are not configured.',
      });
    }
    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({
        success: false,
        message: 'Both "text" and "targetLanguage" are required in the request body.',
      });
    }

    // Get the generative model
    const geminiModel = process.env.GEMINI_MODEL || process.env.GEMINI_MODEL_TRANSLATION || 'gemini-2.5-flash';
    const model = genAI.getGenerativeModel({ model: geminiModel });

    // Construct a clear prompt for the AI
    const prompt = `Translate the following word/phrase to ${targetLanguage}: "${text}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const translatedText = response.text().trim();

    res.status(200).json({
      success: true,
      message: 'Text translated successfully.',
      data: {
        originalText: text,
        translatedText: translatedText,
        language: targetLanguage,
      },
    });

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to translate text due to an internal server error.',
    });
  }
};
