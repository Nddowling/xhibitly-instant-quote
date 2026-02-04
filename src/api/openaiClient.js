import OpenAI from 'openai';

// Initialize OpenAI client with API key from environment
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Required for client-side usage
});

export default openai;
