# EdgeBet - Betting Decision Support Platform

## Overview

EdgeBet is a production-quality MVP for football odds analysis, expected value detection, CLV tracking, and disciplined betting analytics. The platform focuses on **process quality**, not outcomes, helping users make data-driven betting decisions while maintaining strict discipline metrics.

### Core Philosophy

- **CLV > Win Rate**: Closing Line Value is the true measure of betting skill
- **No Bet is Valid**: The model can recommend not betting - this is a valid output
- **Behavioral Discipline**: Track and flag undisciplined betting patterns
- **Risk-First Analysis**: Identify weaknesses in model predictions before betting

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  Dashboard | Matches | Value Bets | Bet Tracker             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend (Express + tRPC)                        │
│  API Routes | CLV Calculations | Behavioral Metrics         │
│  LLM Adversarial Analysis | Data Aggregation                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│          Database (PostgreSQL + Drizzle ORM)                │
│  leagues | teams | matches | odds_snapshots                 │
│  model_predictions | tracked_bets | adversarial_analysis    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│         Python Prediction Worker (Future)                   │
│  Reads matches & odds → Generates predictions → Writes EV   │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
edgebet/
├── client/                          # Next.js frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx        # Summary stats & charts
│   │   │   ├── Matches.tsx          # Upcoming/recent matches
│   │   │   ├── ValueBets.tsx        # EV opportunities
│   │   │   ├── BetTracker.tsx       # CLV & behavioral tracking
│   │   │   └── Home.tsx             # Landing page
│   │   ├── components/
│   │   │   ├── DashboardLayout.tsx  # Sidebar navigation wrapper
│   │   │   └── ui/                  # shadcn/ui components
│   │   ├── lib/trpc.ts              # tRPC client setup
│   │   └── index.css                # Global styles (dark theme)
│   └── public/
├── server/                          # Express backend
│   ├── routers.ts                   # tRPC procedures (main API)
│   ├── analytics.ts                 # CLV & behavioral metrics
│   ├── adversarialAnalysis.ts       # LLM risk identification
│   ├── analytics.test.ts            # Vitest tests
│   ├── db.ts                        # Database helpers
│   └── _core/                       # Framework plumbing
├── drizzle/                         # Database schema & migrations
│   ├── schema.ts                    # Table definitions
│   ├── 0001_*.sql                   # Generated migration
│   └── migrations/
├── scripts/
│   └── seed.mjs                     # Mock data seeder
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Database Schema

### Tables

**leagues** - Football leagues (Premier League, La Liga, etc.)
- id, name, country, season

**teams** - Football teams
- id, name, leagueId, country

**matches** - Football matches
- id, leagueId, homeTeamId, awayTeamId, matchDate, status
- homeTeamGoals, awayTeamGoals, homeTeamXG, awayTeamXG

**bookmakers** - Betting operators (Betfair, Pinnacle, etc.)
- id, name, country

**odds_snapshots** - Historical odds at different times
- id, matchId, bookmakerId, homeOdds, drawOdds, awayOdds, timestamp

**model_predictions** - ML model outputs (populated by Python worker)
- id, matchId, homeWinProb, drawProb, awayWinProb, confidence
- evScore, predictionOutput, riskNotes, modelVersion

**tracked_bets** - User's placed bets with CLV tracking
- id, userId, matchId, bookmakerId, betType
- oddsTaken, stake, evAtEntry, result, closingOdds, clv, pnl
- isNoBetOverride, isWarningOverride, stakeAfterLoss, rapidBettingFlag

**adversarial_analysis** - LLM-generated risk analysis
- id, matchId, predictionId, riskNotes, marketWarnings
- modelWeaknesses, uncertaintyFlags, analysisType

## API Routes (tRPC)

### Matches
```
GET /api/trpc/matches.list
  - List upcoming/recent matches
  - Params: status, leagueId, limit, offset

GET /api/trpc/matches.get
  - Get single match details
  - Params: matchId
```

### Odds
```
GET /api/trpc/odds.getLatest
  - Get latest odds for a match
  - Params: matchId
```

### Predictions
```
GET /api/trpc/predictions.get
  - Get model prediction for a match
  - Params: matchId

POST /api/trpc/predictions.update
  - Update prediction (Python worker endpoint)
  - Params: matchId, evScore, predictionOutput, riskNotes
```

### Tracked Bets
```
GET /api/trpc/trackedBets.list
  - List user's tracked bets
  - Params: result, limit, offset

POST /api/trpc/trackedBets.create
  - Log a new bet
  - Params: matchId, bookmakerId, betType, oddsTaken, stake, evAtEntry

POST /api/trpc/trackedBets.update
  - Update bet with result and CLV
  - Params: id, result, closingOdds
```

### Dashboard
```
GET /api/trpc/dashboard.stats
  - Get summary statistics
  - Returns: totalBets, activeBets, totalPnL, roi, winRate, avgCLV, etc.
```

### Analysis
```
GET /api/trpc/analysis.analyzeMatch
  - Get adversarial risk analysis for a match
  - Params: matchId, homeTeam, awayTeam, odds, probabilities, xG
  - Returns: riskNotes, marketWarnings, modelWeaknesses, uncertaintyFlags
```

## Key Features

### 1. CLV Tracking
- **Calculation**: `CLV = (closing_odds - opening_odds) / opening_odds * 100`
- **Purpose**: Measure if you got better odds than the market closed at
- **Positive CLV** = You got value; **Negative CLV** = You overpaid

### 2. Behavioral Metrics
- **No-Bet Respect Rate**: % of "no bet" signals honored (higher is better)
- **Warning Override Rate**: % of risk warnings ignored (lower is better)
- **Stake Escalation Detection**: Flag if stake increases >40% after losses
- **Rapid Betting Detection**: Flag if 3+ bets placed within 1 hour

### 3. LLM Adversarial Analysis
The system uses **deterministic template-based prompting** to avoid hallucinations:
- Identifies risks in model predictions
- Flags market warnings (odds movements, liquidity issues)
- Highlights model weaknesses (missing data, limited history)
- Gracefully falls back to mock responses if LLM unavailable

### 4. Dashboard Visualizations
- **CLV Trend**: Line chart showing CLV over time
- **ROI Over Time**: Bar chart of monthly ROI
- **Discipline Pie Chart**: No-Bet respect rate visualization
- **Summary Cards**: Key metrics at a glance

## Getting Started

### Prerequisites
- Node.js 22+
- PostgreSQL database
- pnpm package manager

### Installation

1. **Install dependencies**
   ```bash
   cd /home/ubuntu/edgebet
   pnpm install
   ```

2. **Database setup** (already done)
   ```bash
   # Schema created via webdev_execute_sql
   # Mock data seeded via scripts/seed.mjs
   ```

3. **Environment variables** (already configured)
   - `DATABASE_URL`: PostgreSQL connection string
   - `JWT_SECRET`: Session signing secret
   - `VITE_APP_ID`: OAuth app ID
   - `OAUTH_SERVER_URL`: OAuth backend URL

### Running Locally

1. **Start development server**
   ```bash
   pnpm dev
   ```
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000
   - tRPC API: http://localhost:3000/api/trpc

2. **Run tests**
   ```bash
   pnpm test
   ```
   - Tests include CLV calculations, behavioral metrics, and analytics

3. **Seed database** (if needed)
   ```bash
   node scripts/seed.mjs
   ```

## Frontend Pages

### /dashboard
- Summary statistics (total bets, P&L, ROI, CLV)
- CLV trend chart
- ROI over time chart
- Discipline metrics visualization
- Decision discipline pie chart

### /matches
- List of upcoming and recent matches
- League, teams, date, and xG data
- Match status badges
- Quick analysis access

### /value-bets
- Identified positive EV opportunities
- Model probability vs. implied probability
- EV% and confidence indicators
- Risk analysis section with warnings
- Bet tracking integration

### /bet-tracker
- Complete bet history table
- CLV, P&L, and odds tracking
- Behavioral flags (no-bet override, warning override, stake escalation, rapid betting)
- Summary statistics
- Behavioral insights and recommendations

## Python Integration (Future)

### Prediction Worker Architecture

The Python worker will:

1. **Read from database**
   ```sql
   SELECT m.*, os.* FROM matches m
   JOIN odds_snapshots os ON m.id = os.matchId
   WHERE m.status = 'scheduled'
   ```

2. **Generate predictions**
   - Calculate home/away/draw probabilities
   - Compute EV scores
   - Identify value opportunities

3. **Write back to database**
   ```sql
   UPDATE model_predictions
   SET homeWinProb = ?, drawProb = ?, awayWinProb = ?,
       confidence = ?, evScore = ?, predictionOutput = ?
   WHERE matchId = ?
   ```

### Integration Points

**Backend endpoint for Python worker**:
```
POST /api/trpc/predictions.update
```

**Schema fields reserved for Python output**:
- `model_predictions.evScore` - Expected value score
- `model_predictions.predictionOutput` - Raw model output (JSON)
- `model_predictions.riskNotes` - Identified risks
- `model_predictions.modelVersion` - Model version identifier

### Example Python Integration

```python
import requests
import json

# Read matches from database
matches = db.query("SELECT * FROM matches WHERE status = 'scheduled'")

for match in matches:
    # Generate prediction
    prediction = model.predict(match)
    
    # Send to backend
    requests.post(
        "http://localhost:3000/api/trpc/predictions.update",
        json={
            "matchId": match.id,
            "homeWinProb": prediction.home_prob,
            "drawProb": prediction.draw_prob,
            "awayWinProb": prediction.away_prob,
            "confidence": prediction.confidence,
            "evScore": prediction.ev_score,
            "predictionOutput": json.dumps(prediction.raw_output)
        }
    )
```

## Testing

### Unit Tests
```bash
pnpm test
```

Tests cover:
- CLV calculations (positive, negative, edge cases)
- P&L calculations (won, lost, void, pending)
- Behavioral metrics (stake escalation, rapid betting)
- Discipline metrics (no-bet respect, warning override)
- Portfolio metrics (average CLV, ROI, win rate)

### Test Examples
```typescript
// CLV calculation
calculateCLV(2.0, 2.5) // Returns 25% (positive CLV)

// Stake escalation detection
detectStakeEscalation(150, [
  { stake: 100, result: "lost" },
  { stake: 100, result: "lost" }
]) // Returns true (50% increase after losses)

// Rapid betting detection
detectRapidBetting([
  { createdAt: now - 5min },
  { createdAt: now - 10min },
  { createdAt: now - 15min }
]) // Returns true (3 bets within 1 hour)
```

## Frontend/Backend Connection

### tRPC Integration
- **Type-safe**: Full TypeScript types flow end-to-end
- **No manual API contracts**: Types generated from backend routers
- **Automatic serialization**: Dates, decimals handled correctly

### Data Flow Example
```typescript
// Frontend component
const { data: stats } = trpc.dashboard.stats.useQuery();

// Calls backend procedure
// server/routers.ts:
dashboard: router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    // Calculate and return stats
    return { totalBets, roi, avgCLV, ... }
  })
})
```

### Bet Tracking Flow
1. User logs bet via `/bet-tracker` page
2. Frontend calls `trpc.trackedBets.create.useMutation()`
3. Backend validates and detects behavioral flags
4. Bet stored with CLV/P&L fields ready for update
5. User updates result via `trpc.trackedBets.update.useMutation()`
6. Backend calculates CLV and P&L
7. Dashboard stats update automatically

## Styling & Design

### Dark Analytical Theme
- Background: `#0f172a` (slate-950)
- Foreground: `#f1f5f9` (slate-100)
- Accent: `#10b981` (emerald-500) for positive metrics
- Warning: `#ef4444` (red-500) for losses/risks
- Info: `#3b82f6` (blue-500) for neutral data

### Component Library
- **shadcn/ui**: Pre-built, accessible components
- **Recharts**: Data visualization charts
- **Tailwind CSS 4**: Utility-first styling
- **Lucide React**: Icon library

## Deployment

### Build
```bash
pnpm build
```

### Production Start
```bash
pnpm start
```

### Environment
- Node.js runtime (no Python/Docker required for deployment)
- PostgreSQL database connection required
- OAuth credentials for authentication

## Future Enhancements

1. **Live Betting**: WebSocket support for real-time odds
2. **Advanced Analytics**: Historical performance analysis
3. **Multi-user**: Team collaboration and shared models
4. **Mobile App**: Native iOS/Android apps
5. **Notifications**: Real-time alerts for value opportunities
6. **Payment Processing**: Stripe integration for premium features
7. **API Access**: Third-party integrations

## Support & Documentation

- **Database**: See `drizzle/schema.ts` for table definitions
- **API**: See `server/routers.ts` for all procedures
- **Frontend**: See `client/src/pages/` for page implementations
- **Analytics**: See `server/analytics.ts` for metric calculations
- **Tests**: See `server/analytics.test.ts` for test examples

## License

MIT
