# Elitr: AI Development Context (AGENTS.md)

This file provides strict context and rules for AI coding assistants (like Claude Code) working on the **Elitr** repository.

## Project Goal
Build a multi-agent application where Agent A (Analyst) sells data to Agent B (Execution) using Binance's **b402 payments**, and Agent B trades tokenized stocks on BSC using the **Binance Web3 API**.

## Technical Directives for Claude
1. **Monorepo Structure**: Scaffold this project as a monorepo.
   - `/apps/web`: The Next.js dashboard.
   - `/apps/analyst-agent`: The Node.js server exposing the sentiment API (protected by b402).
   - `/apps/execution-agent`: The core trading loop.
2. **API Integrations**: 
   - All Binance Web3 API calls must be properly authenticated using the request signing methods detailed in the Binance Developer Docs.
   - Dry-run all transactions using the **Transaction API** (`/transaction-api`) before attempting to execute them via the Trading API.
3. **Environment Variables**: Never commit `.env` files. Ensure `.gitignore` is properly configured for all API keys and wallet private keys.
4. **Tokenized Stocks Focus**: The core assets being traded MUST be from `bStocks`, `Ondo`, or `xStocks`. Ensure the RWA Data API is hardcoded to query these platforms.

## Next Steps for Claude
1. Read `README.md` and `ARCHITECTURE.md` to understand the full flow.
2. Scaffold the monorepo.
3. Start by building the `analyst-agent` and implementing the `b402-payments` gateway.
