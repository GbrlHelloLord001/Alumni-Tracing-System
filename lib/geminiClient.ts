import { Type } from '@google/genai';

class GoogleGenAIMock {
  models = {
    generateContent: async (params: any) => {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!response.ok) {
        let err;
        try { err = await response.json(); } catch (e) { err = { error: await response.text() }; }
        throw new Error(err.error || 'Server Error');
      }
      return await response.json();
    }
  };
  constructor(options?: any) {}
}

export { GoogleGenAIMock as GoogleGenAI, Type };
export type { Schema } from '@google/genai';
