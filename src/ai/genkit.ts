
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// This file is now empty as the AI leave approval flow has been removed.
// It is kept for potential future AI integrations.

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});
