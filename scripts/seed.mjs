import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

async function seed() {
  const connection = await mysql.createConnection(DATABASE_URL);

  try {
    console.log("🌱 Starting database seed...");

    // Clear existing data (in reverse order of foreign key dependencies)
    console.log("Clearing existing data...");
    await connection.execute("DELETE FROM adversarial_analysis");
    await connection.execute("DELETE FROM tracked_bets");
    await connection.execute("DELETE FROM model_predictions");
    await connection.execute("DELETE FROM odds_snapshots");
    await connection.execute("DELETE FROM matches");
    await connection.execute("DELETE FROM teams");
    await connection.execute("DELETE FROM bookmakers");
    await connection.execute("DELETE FROM leagues");

    // Seed leagues
    console.log("Seeding leagues...");
    const leagues = [
      ["Premier League", "England", "2024-25"],
      ["La Liga", "Spain", "2024-25"],
      ["Serie A", "Italy", "2024-25"],
      ["Bundesliga", "Germany", "2024-25"],
      ["Ligue 1", "France", "2024-25"],
    ];
    for (const [name, country, season] of leagues) {
      await connection.execute(
        "INSERT INTO leagues (name, country, season) VALUES (?, ?, ?)",
        [name, country, season]
      );
    }

    // Get league IDs
    const [leagueRows] = await connection.execute("SELECT id, name FROM leagues");
    const leagueMap = Object.fromEntries(leagueRows.map((r) => [r.name, r.id]));

    // Seed teams
    console.log("Seeding teams...");
    const teams = [
      // Premier League
      ["Manchester City", leagueMap["Premier League"], "England"],
      ["Liverpool", leagueMap["Premier League"], "England"],
      ["Arsenal", leagueMap["Premier League"], "England"],
      ["Manchester United", leagueMap["Premier League"], "England"],
      ["Chelsea", leagueMap["Premier League"], "England"],
      ["Tottenham", leagueMap["Premier League"], "England"],
      // La Liga
      ["Real Madrid", leagueMap["La Liga"], "Spain"],
      ["Barcelona", leagueMap["La Liga"], "Spain"],
      ["Atletico Madrid", leagueMap["La Liga"], "Spain"],
      ["Sevilla", leagueMap["La Liga"], "Spain"],
      // Serie A
      ["Juventus", leagueMap["Serie A"], "Italy"],
      ["Inter Milan", leagueMap["Serie A"], "Italy"],
      ["AC Milan", leagueMap["Serie A"], "Italy"],
      ["Napoli", leagueMap["Serie A"], "Italy"],
      // Bundesliga
      ["Bayern Munich", leagueMap["Bundesliga"], "Germany"],
      ["Borussia Dortmund", leagueMap["Bundesliga"], "Germany"],
      ["RB Leipzig", leagueMap["Bundesliga"], "Germany"],
      // Ligue 1
      ["Paris Saint-Germain", leagueMap["Ligue 1"], "France"],
      ["Marseille", leagueMap["Ligue 1"], "France"],
    ];
    for (const [name, leagueId, country] of teams) {
      await connection.execute(
        "INSERT INTO teams (name, leagueId, country) VALUES (?, ?, ?)",
        [name, leagueId, country]
      );
    }

    // Get team IDs
    const [teamRows] = await connection.execute("SELECT id, name FROM teams");
    const teamMap = Object.fromEntries(teamRows.map((r) => [r.name, r.id]));

    // Seed bookmakers
    console.log("Seeding bookmakers...");
    const bookmakers = [
      ["Betfair", "UK"],
      ["Pinnacle", "Netherlands"],
      ["DraftKings", "USA"],
      ["FanDuel", "USA"],
      ["Bet365", "UK"],
    ];
    for (const [name, country] of bookmakers) {
      await connection.execute(
        "INSERT INTO bookmakers (name, country) VALUES (?, ?)",
        [name, country]
      );
    }

    // Get bookmaker IDs
    const [bookmakersRows] = await connection.execute(
      "SELECT id, name FROM bookmakers"
    );
    const bookmakersMap = Object.fromEntries(
      bookmakersRows.map((r) => [r.name, r.id])
    );

    // Seed matches
    console.log("Seeding matches...");
    const matchPairs = [
      ["Manchester City", "Liverpool", leagueMap["Premier League"]],
      ["Arsenal", "Manchester United", leagueMap["Premier League"]],
      ["Chelsea", "Tottenham", leagueMap["Premier League"]],
      ["Real Madrid", "Barcelona", leagueMap["La Liga"]],
      ["Atletico Madrid", "Sevilla", leagueMap["La Liga"]],
      ["Juventus", "Inter Milan", leagueMap["Serie A"]],
      ["AC Milan", "Napoli", leagueMap["Serie A"]],
      ["Bayern Munich", "Borussia Dortmund", leagueMap["Bundesliga"]],
      ["RB Leipzig", "Bayern Munich", leagueMap["Bundesliga"]],
      ["Paris Saint-Germain", "Marseille", leagueMap["Ligue 1"]],
    ];

    const matchIds = [];
    for (const [homeTeam, awayTeam, leagueId] of matchPairs) {
      const homeTeamId = teamMap[homeTeam];
      const awayTeamId = teamMap[awayTeam];
      const matchDate = new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000);

      const [result] = await connection.execute(
        "INSERT INTO matches (leagueId, homeTeamId, awayTeamId, matchDate, status, homeTeamXG, awayTeamXG) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [leagueId, homeTeamId, awayTeamId, matchDate, "scheduled", 1.5 + Math.random(), 1.2 + Math.random()]
      );
      matchIds.push(result.insertId);
    }

    // Seed odds snapshots
    console.log("Seeding odds snapshots...");
    for (const matchId of matchIds) {
      for (const bookmakerId of Object.values(bookmakersMap)) {
        const homeOdds = 1.5 + Math.random() * 2;
        const awayOdds = 1.5 + Math.random() * 3;
        const drawOdds = 3.0 + Math.random() * 1.5;

        await connection.execute(
          "INSERT INTO odds_snapshots (matchId, bookmakerId, homeOdds, drawOdds, awayOdds, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
          [matchId, bookmakerId, homeOdds.toFixed(3), drawOdds.toFixed(3), awayOdds.toFixed(3), new Date()]
        );
      }
    }

    // Seed model predictions
    console.log("Seeding model predictions...");
    for (const matchId of matchIds) {
      const homeWinProb = Math.random() * 0.6;
      const awayWinProb = Math.random() * 0.4;
      const drawProb = 1 - homeWinProb - awayWinProb;
      const confidence = 0.5 + Math.random() * 0.4;
      const evScore = (Math.random() - 0.5) * 10;

      await connection.execute(
        "INSERT INTO model_predictions (matchId, homeWinProb, drawProb, awayWinProb, confidence, evScore, modelVersion) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          matchId,
          homeWinProb.toFixed(4),
          drawProb.toFixed(4),
          awayWinProb.toFixed(4),
          confidence.toFixed(4),
          evScore.toFixed(4),
          "v1.0",
        ]
      );
    }

    // Seed adversarial analysis
    console.log("Seeding adversarial analysis...");
    const riskTemplates = [
      "Recent form suggests potential undervaluation",
      "Injury data incomplete for key players",
      "Odds movement contradicts model direction",
      "Recent xG inflated by weak opposition",
      "Market consensus differs significantly from model",
      "Late team news could impact prediction accuracy",
    ];

    for (const matchId of matchIds) {
      const riskNotes = riskTemplates[Math.floor(Math.random() * riskTemplates.length)];
      const marketWarnings = Math.random() > 0.5 ? "Significant late movement detected" : null;
      const modelWeaknesses = Math.random() > 0.5 ? "Limited historical data for this matchup" : null;

      await connection.execute(
        "INSERT INTO adversarial_analysis (matchId, riskNotes, marketWarnings, modelWeaknesses, analysisType) VALUES (?, ?, ?, ?, ?)",
        [matchId, riskNotes, marketWarnings, modelWeaknesses, "template_based"]
      );
    }

    console.log("✅ Database seeded successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

seed().catch(console.error);
