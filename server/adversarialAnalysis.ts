import { invokeLLM } from "./_core/llm";

export interface AnalysisInput {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeWinProb?: number;
  drawProb?: number;
  awayWinProb?: number;
  confidence?: number;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  homeTeamXG?: number;
  awayTeamXG?: number;
  recentOddsMovement?: string;
}

export interface AnalysisOutput {
  riskNotes: string;
  marketWarnings: string | null;
  modelWeaknesses: string | null;
  uncertaintyFlags: string | null;
  analysisType: "template_based" | "llm_generated" | "mock";
}

/**
 * Template-based risk analysis (deterministic, no hallucinations)
 */
function templateBasedAnalysis(input: AnalysisInput): AnalysisOutput {
  const risks: string[] = [];
  const warnings: string[] = [];
  const weaknesses: string[] = [];
  const uncertainties: string[] = [];

  // Risk detection rules
  if (input.confidence && input.confidence < 0.6) {
    risks.push("Low model confidence - prediction reliability uncertain");
  }

  if (input.homeTeamXG && input.awayTeamXG) {
    const xgDiff = Math.abs(input.homeTeamXG - input.awayTeamXG);
    if (xgDiff > 1.5) {
      risks.push(`Significant xG differential (${xgDiff.toFixed(2)}) - may indicate data quality issues`);
    }
  }

  // Market warning detection
  if (input.homeOdds && input.drawOdds && input.awayOdds) {
    const impliedProbs = {
      home: 1 / input.homeOdds,
      draw: 1 / input.drawOdds,
      away: 1 / input.awayOdds,
    };
    const totalImplied = impliedProbs.home + impliedProbs.draw + impliedProbs.away;

    if (totalImplied < 0.95) {
      warnings.push("Odds appear mispriced - implied probabilities don't sum to 100%");
    }
  }

  if (input.recentOddsMovement === "significant") {
    warnings.push("Significant late market movement detected - possible information asymmetry");
  }

  // Model weakness detection
  if (!input.homeTeamXG || !input.awayTeamXG) {
    weaknesses.push("Missing xG data - model may lack key performance metrics");
  }

  if (input.confidence && input.confidence < 0.55) {
    weaknesses.push("Model uncertainty elevated - consider reducing stake size");
  }

  // Uncertainty flags
  if (input.homeWinProb && input.awayWinProb) {
    const probDiff = Math.abs(input.homeWinProb - input.awayWinProb);
    if (probDiff < 0.05) {
      uncertainties.push("Home/away probabilities very close - match is highly uncertain");
    }
  }

  return {
    riskNotes: risks.length > 0 ? risks.join("; ") : "No major risks identified",
    marketWarnings: warnings.length > 0 ? warnings.join("; ") : null,
    modelWeaknesses: weaknesses.length > 0 ? weaknesses.join("; ") : null,
    uncertaintyFlags: uncertainties.length > 0 ? uncertainties.join("; ") : null,
    analysisType: "template_based",
  };
}

/**
 * Mock LLM analysis (fallback when LLM unavailable)
 */
function mockLLMAnalysis(input: AnalysisInput): AnalysisOutput {
  const mockRisks = [
    "Recent form suggests potential undervaluation",
    "Injury data incomplete for key players",
    "Odds movement contradicts model direction",
    "Recent xG inflated by weak opposition",
    "Market consensus differs significantly from model",
  ];

  const mockWarnings = [
    "Significant late movement detected",
    "Bookmaker odds suggest different expectation",
    "Market liquidity concerns",
  ];

  const mockWeaknesses = [
    "Limited historical data for this matchup",
    "Model trained on different competition level",
    "Tactical changes not reflected in data",
  ];

  const riskNotes = mockRisks[Math.floor(Math.random() * mockRisks.length)];
  const marketWarnings = Math.random() > 0.5 ? mockWarnings[Math.floor(Math.random() * mockWarnings.length)] : null;
  const modelWeaknesses = Math.random() > 0.5 ? mockWeaknesses[Math.floor(Math.random() * mockWeaknesses.length)] : null;

  return {
    riskNotes,
    marketWarnings,
    modelWeaknesses,
    uncertaintyFlags: null,
    analysisType: "mock",
  };
}

/**
 * LLM-based adversarial analysis (with fallback)
 * Uses deterministic prompting to avoid hallucinations
 */
export async function analyzeMatchRisks(input: AnalysisInput): Promise<AnalysisOutput> {
  try {
    // First, always run template-based analysis
    const templateAnalysis = templateBasedAnalysis(input);

    // Try to enhance with LLM if available
    try {
      const prompt = `You are a betting risk analyst. Analyze this football match for risks and weaknesses in the model prediction.

Match: ${input.homeTeam} vs ${input.awayTeam}
Model Prediction: Home ${(input.homeWinProb || 0).toFixed(2)}, Draw ${(input.drawProb || 0).toFixed(2)}, Away ${(input.awayWinProb || 0).toFixed(2)}
Model Confidence: ${(input.confidence || 0).toFixed(2)}
Current Odds: Home ${input.homeOdds?.toFixed(2)}, Draw ${input.drawOdds?.toFixed(2)}, Away ${input.awayOdds?.toFixed(2)}
Home xG: ${input.homeTeamXG?.toFixed(2)}, Away xG: ${input.awayTeamXG?.toFixed(2)}

Provide ONLY:
1. One specific risk concern (be concrete, avoid generic statements)
2. One market warning if applicable
3. One model weakness if applicable

Format as JSON: {"risk": "...", "warning": "...", "weakness": "..."}`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a betting risk analyst. Provide only factual, specific concerns. Never predict match outcomes. Output valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      if (response.choices?.[0]?.message?.content) {
        try {
          const content = response.choices[0].message.content;
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              riskNotes: parsed.risk || templateAnalysis.riskNotes,
              marketWarnings: parsed.warning || templateAnalysis.marketWarnings,
              modelWeaknesses: parsed.weakness || templateAnalysis.modelWeaknesses,
              uncertaintyFlags: templateAnalysis.uncertaintyFlags,
              analysisType: "llm_generated",
            };
          }
        } catch (e) {
          // JSON parsing failed, fall back to template
          console.warn("LLM response parsing failed, using template analysis");
        }
      }
    } catch (llmError) {
      // LLM call failed, use template analysis
      console.warn("LLM analysis failed, using template analysis:", llmError);
    }

    return templateAnalysis;
  } catch (error) {
    console.error("Analysis error:", error);
    // Final fallback to mock
    return mockLLMAnalysis(input);
  }
}

/**
 * Batch analyze multiple matches
 */
export async function analyzeMultipleMatches(inputs: AnalysisInput[]): Promise<AnalysisOutput[]> {
  return Promise.all(inputs.map((input) => analyzeMatchRisks(input)));
}
