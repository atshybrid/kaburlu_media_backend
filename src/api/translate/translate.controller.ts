
import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google AI client
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is not set.');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const translateTextController = async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({
        success: false,
        message: 'Both "text" and "targetLanguage" are required in the request body.',
      });
    }

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

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
