# Product development plan

Each round completes one feature or repair. Future items are planned, not implemented claims.

## Current round

test-fixes

## Roadmap

### test-fixes — Fix frontend test failures and stabilize test suite

Status: done

Acceptance:
- All backend tests pass (11/11)
- All frontend tests pass (8/8)
- Fixed Upload.test.tsx duplicate text match
- Fixed Upload.test.tsx missing required fields
- Fixed SignalList.test.tsx missing setLoading mock
- Fixed App.test.tsx login redirect test
- Fixed react-hot-toast mock default export

Implementation: `frontend/src/__tests__/Upload.test.tsx`, `frontend/src/__tests__/SignalList.test.tsx`, `frontend/src/__tests__/App.test.tsx`, `frontend/src/__tests__/setup.ts`

Tests: `frontend/src/__tests__/Upload.test.tsx`, `frontend/src/__tests__/SignalList.test.tsx`, `frontend/src/__tests__/App.test.tsx`

### signal-analysis-engine — Signal analysis domain engine with ML-based anomaly detection

Status: planned

Acceptance:
- Ingest time-series signal data via API
- Compute statistical features (mean, variance, spectral entropy)
- Isolation Forest anomaly detection on signal windows
- Persist analyses with UTC timestamps
- Export results as JSON/CSV

Implementation: `backend/app/models/signal.py`, `backend/app/services/signal_analysis.py`, `backend/app/api/signals.py`, `backend/app/core/ml.py`

Tests: `backend/tests/test_signal_analysis.py`, `backend/tests/test_ml_anomaly.py`

### signal-dashboard — Signal analysis dashboard with real-time visualization

Status: planned

Acceptance:
- Upload signal data (CSV/JSON)
- View anomaly detection results with timestamps
- Filter by time range, anomaly score threshold
- Export filtered results
- Responsive UI with loading/error/empty states

Implementation: `frontend/src/components/SignalUpload.tsx`, `frontend/src/components/SignalDashboard.tsx`, `frontend/src/components/AnomalyTable.tsx`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/api/signals.ts`

Tests: `frontend/src/__tests__/SignalDashboard.test.tsx`, `frontend/src/__tests__/SignalUpload.test.tsx`

### rag-query-workflow — RAG-based signal knowledge query workflow

Status: planned

Acceptance:
- Index signal analysis reports and domain docs
- Natural language query for signal patterns
- Grounded responses with citations
- Opt-in LLM explanations labeled advisory

Implementation: `backend/app/services/rag.py`, `backend/app/api/rag.py`, `frontend/src/components/RAGQuery.tsx`, `frontend/src/pages/RAGQuery.tsx`

Tests: `backend/tests/test_rag.py`, `frontend/src/__tests__/RAGQuery.test.tsx`

### ci-cd-docs — CI/CD, documentation, and portfolio metadata

Status: planned

Acceptance:
- GitHub Actions CI workflow passing
- README with architecture diagram and API reference
- CHANGELOG.md
- portfolio.json with schema_version=1
- LICENSE MIT

Implementation: `.github/workflows/ci.yml`, `README.md`, `CHANGELOG.md`, `portfolio.json`, `LICENSE`, `pyproject.toml`

---

Alan Vo · [alanvo.net](https://alanvo.net) · [X: @alanvoasi](https://x.com/alanvoasi)
