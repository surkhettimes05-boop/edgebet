# EdgeBet MVP - Project TODO

## Database & Schema
- [x] Create Prisma schema with all tables: teams, leagues, matches, bookmakers, odds_snapshots, model_predictions, tracked_bets
- [x] Add tracked_bets fields: odds_taken, stake, result, ev_at_entry, closing_odds, clv
- [x] Add model_predictions fields for Python worker: ev_score, prediction_output, risk_notes
- [x] Run database migrations and verify schema
- [x] Create mock data seeder script
- [x] Seed database with realistic football data

## Bet Tracking & CLV System
- [x] Implement manual bet tracker with odds, stake, result, EV at entry
- [x] Calculate CLV (Closing Line Value) for each bet
- [x] Implement behavioral metrics: no-bet respect rate, warning override rate
- [x] Implement stake escalation detection (>40% increase after losses)
- [x] Implement rapid betting frequency detection
- [x] Create bet history table with all tracking data
- [x] Create CLV summary cards for aggregate metrics

## LLM Adversarial Analyst Layer
- [x] Create backend analysis module for risk identification
- [x] Implement deterministic template-based prompting
- [x] Add graceful fallback to mock responses if LLM unavailable
- [x] Create risk notes generation from model predictions
- [x] Create market warnings from odds movements
- [x] Identify model weaknesses and missing information
- [x] Add UI components for risk notes and market warnings

## Backend API Routes (tRPC)
- [x] Create matches router with list, get, create operations
- [x] Create odds_snapshots router with CRUD operations
- [x] Create model_predictions router with CRUD operations
- [x] Create tracked_bets router with CRUD, CLV calculation operations
- [x] Create behavioral metrics router for discipline tracking
- [x] Create LLM adversarial analysis router
- [x] Create dashboard stats router for summary data

## Frontend Pages
- [x] Dashboard page (/dashboard) with summary statistics and Recharts charts
- [x] Matches page (/matches) with upcoming/recent matches list and risk analysis
- [x] Value Bets page (/value-bets) with EV detection, confidence indicators, and market warnings
- [x] Bet Tracker page (/bet-tracker) with CLV tracking, behavioral metrics, and P&L data
- [x] Setup DashboardLayout with sidebar navigation across all pages
- [x] Add risk notes and adversarial analysis display on value-bets and matches pages

## Recharts Integration
- [x] EV trend chart on dashboard
- [x] ROI over time chart on dashboard
- [x] Odds movement visualization on matches/value-bets pages
- [x] P&L tracking chart on bet-tracker page

## Python Integration Hooks
- [x] Reserve schema fields in model_predictions for Python worker outputs
- [x] Create placeholder endpoint for Python worker to write predictions
- [x] Document Python integration points

## Testing & Verification
- [x] Write vitest tests for API routes
- [x] Write vitest tests for CLV calculations
- [x] Write vitest tests for behavioral metrics detection
- [x] Write vitest tests for LLM adversarial analysis
- [ ] Verify frontend/backend integration
- [x] Test mock data seeding
- [ ] Verify all pages render correctly
- [x] Test LLM fallback to mock responses

## Deployment & Documentation
- [x] Create comprehensive README with setup instructions
- [x] Document folder structure and architecture
- [x] Document how frontend/backend connect
- [x] Document Python prediction script integration points
- [ ] Create checkpoint before final delivery
