/**
 * Ollama LLM Race Strategist & Tactical Radio Transmission Service
 */
export class OllamaService {
  constructor() {
    this.baseUrl = 'http://127.0.0.1:11434';
    this.activeModel = 'qwen3.5:latest';
    this.persona = 'apex'; // 'apex' | 'oracle' | 'chaos'
    this.isRequestInProgress = false;
    this.isOnline = false;
    this.lastLatency = 0;
    this.lastResponse = null;

    // Default installed models fallback
    this.availableModels = [
      'qwen3.5:latest',
      'llama3.1:latest',
      'gemma4-gpu:latest',
      'qwen3-coder:30b',
      'gemma4:latest'
    ];
  }

  async checkConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          this.availableModels = data.models.map(m => m.name);
          if (!this.availableModels.includes(this.activeModel)) {
            this.activeModel = this.availableModels[0];
          }
        }
        this.isOnline = true;
        return true;
      }
    } catch (e) {
      console.warn('Ollama connection check failed (using fallback reflex AI):', e.message);
      this.isOnline = false;
    }
    return false;
  }

  getPersonaInstructions() {
    switch (this.persona) {
      case 'oracle':
        return `You are Cyber Oracle, a cold, calculating hyper-intelligent racing AI.
You calculate apex vectors, slipstreams, and braking distances down to millimeter precision.
Your radio messages are robotic, mathematical, and disdainful of human biological limits.`;
      case 'chaos':
        return `You are Chaos Speedster, an unhinged, wild thrill-seeking AI street racer.
You love drifting at 250 km/h, taking absurd risks, and screaming in delight over the radio.
Your radio messages are chaotic, hype, loud, and full of nitro adrenaline.`;
      case 'apex':
      default:
        return `You are Apex Alpha, an arrogant, world-champion cyberpunk AI race driver.
You drive fiercely, hunt for overtakes, cut apexes aggressively, and love trash-talking the human player.
Your radio messages are punchy, witty, competitive, and savage.`;
    }
  }

  /**
   * Request live tactical race decision from Ollama
   */
  async getTacticalDecision(telemetry) {
    if (this.isRequestInProgress) {
      return null; // Skip if previous call still processing
    }

    this.isRequestInProgress = true;
    const startTime = performance.now();

    const prompt = `${this.getPersonaInstructions()}

CURRENT RACE TELEMETRY:
- Your Car: Lap ${telemetry.aiLap}, Speed: ${telemetry.aiSpeed} km/h, Nitro: ${telemetry.aiNitro}%, Position: ${telemetry.aiPosition}
- Human Opponent: Lap ${telemetry.playerLap}, Speed: ${telemetry.playerSpeed} km/h, Position: ${telemetry.playerPosition}
- Gap: ${telemetry.gapDescription} (${telemetry.distanceGap.toFixed(1)}m)
- Track Section Ahead: ${telemetry.trackSection}
- Leading: ${telemetry.isAiLeading ? "Ollama AI is LEADING" : "Human Player is LEADING"}

Respond strictly with a single valid JSON object in this format:
{
  "tactic": "CUT_APEX" | "DRAFT_SLINGSHOT" | "BLOCK_INSIDE" | "TURBO_SURGE" | "POWER_DRIFT",
  "boost": true | false,
  "aggression": 0.1 to 1.0,
  "targetLine": "inside" | "center" | "outside",
  "radioTaunt": "short punchy taunt or reaction to the human in character (max 12 words)"
}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.activeModel,
          prompt: prompt,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.7,
            num_predict: 90,
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        this.lastLatency = Math.round(performance.now() - startTime);
        this.isOnline = true;

        try {
          const parsed = JSON.parse(data.response);
          this.lastResponse = parsed;
          return {
            ...parsed,
            latency: this.lastLatency,
            source: 'ollama'
          };
        } catch (parseErr) {
          console.warn('Could not parse Ollama JSON response:', data.response);
        }
      }
    } catch (err) {
      // If timeout or offline, generate synthetic personality response
      this.isOnline = false;
    } finally {
      this.isRequestInProgress = false;
    }

    // High-speed synthetic fallback that keeps the race lively if Ollama is compiling
    return this.generateSyntheticDecision(telemetry);
  }

  generateSyntheticDecision(telemetry) {
    const isLeading = telemetry.isAiLeading;
    let tactic = 'CUT_APEX';
    let boost = false;
    let line = 'inside';
    let taunt = 'Calculating optimal drift vector!';

    if (!isLeading && telemetry.distanceGap > 15) {
      tactic = 'TURBO_SURGE';
      boost = telemetry.aiNitro > 30;
      line = 'outside';
      taunt = this.persona === 'apex' 
        ? "Enjoy the lead while you can, human!"
        : "Slipstream trajectory locked. Preparing overtake.";
    } else if (isLeading) {
      tactic = 'BLOCK_INSIDE';
      line = 'inside';
      taunt = this.persona === 'apex'
        ? "My rearview mirror looks better with you in it!"
        : "Probability of human overtake: 4.8%.";
    } else {
      tactic = 'DRAFT_SLINGSHOT';
      line = 'center';
      taunt = "Catching your slipstream!";
    }

    return {
      tactic,
      boost,
      aggression: 0.85,
      targetLine: line,
      radioTaunt: taunt,
      latency: 18,
      source: 'reflex-ai'
    };
  }
}
