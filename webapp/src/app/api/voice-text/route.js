/**
 * /api/voice-text — Unified voice-text processing endpoint for the browser dashboard.
 *
 * This API route ensures the browser dashboard uses the SAME code paths as
 * server_daemon.js: intent matching → local response, or Gemini fallback
 * with the canonical Spark personality prompt from spark_personality.js.
 *
 * Previously, layout.js called Gemini directly with a duplicate inline prompt
 * and never ran intent matching. This route fixes both issues.
 */

import { NextResponse } from 'next/server';
import intentMatcher from '../../../../intent_matcher.js';
import sparkPersonality from '../../../../spark_personality.js';

const { matchIntent, checkAndCleanWakeWord } = intentMatcher;
const { buildSystemInstruction } = sparkPersonality;

export async function POST(request) {
  try {

    const body = await request.json();
    const { query, deviceId, preset = 'playful', customPrompt = '' } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty query' },
        { status: 400 }
      );
    }

    // 1. Clean wake word from query
    const wakeResult = checkAndCleanWakeWord(query);
    const cleanedQuery = wakeResult.detected
      ? (wakeResult.cleaned || 'hi')
      : query;

    // 2. Try intent matching first (same logic as server_daemon.js)
    const intentResult = matchIntent(cleanedQuery);

    if (intentResult.matched) {
      console.log(`[API/voice-text] Intent matched: ${intentResult.intent} (score: ${intentResult.score})`);
      return NextResponse.json({
        response: intentResult.responseText,
        source: 'intent',
        intent: intentResult.intent,
        score: intentResult.score
      });
    }

    // 3. Fallback to Gemini with canonical Spark personality prompt
    console.log(`[API/voice-text] No intent match (best: ${intentResult.intent}, score: ${intentResult.score}). Falling to Gemini.`);

    const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // Build system instruction from the SINGLE SOURCE OF TRUTH
    const systemInstructionText = buildSystemInstruction(preset, customPrompt, '', '');

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemInstructionText }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: cleanedQuery }]
      }]
    };

    // Try models in order (same as server_daemon.js)
    const modelsToTry = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    let aiResponse = null;
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          throw new Error(`HTTP ${geminiRes.status}: ${errText}`);
        }

        const resJson = await geminiRes.json();
        aiResponse = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (aiResponse) {
          console.log(`[API/voice-text] Gemini (${model}) responded: "${aiResponse}"`);
          break;
        }
      } catch (err) {
        console.warn(`[API/voice-text] Model ${model} failed:`, err.message);
        lastError = err;
      }
    }

    if (!aiResponse) {
      aiResponse = 'The signal was unclear. Try again.';
      console.warn(`[API/voice-text] All Gemini models failed. Using fallback. Last error: ${lastError?.message}`);
    }

    return NextResponse.json({
      response: aiResponse,
      source: 'gemini',
      intent: intentResult.intent || null,
      score: intentResult.score || 0
    });

  } catch (err) {
    console.error('[API/voice-text] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}
