# Changelog

## 1.3.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

## 1.2.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

### Fixed
- Frontend test suite stabilized: all 8 tests pass
- Upload.test.tsx: fixed duplicate text match (used getByRole for heading)
- Upload.test.tsx: added required field inputs (name, sampleRate, duration) for upload test
- SignalList.test.tsx: added complete mock including setLoading for delete test
- App.test.tsx: fixed login redirect test (isLoading=false to render Login page)
- react-hot-toast mock: fixed default export in vi.mock for proper toast import

### Security
- No hardcoded secrets; all configuration via environment variables
- Secure OIDC flow with state, nonce, and PKCE
- HttpOnly, SameSite=Lax session cookies
- CSRF protection on state-changing operations
- Role-based authorization on all data endpoints

## 1.1.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

## 1.0.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-23

### Added
- Initial project scaffold with FastAPI backend and React/TypeScript frontend
- Signal upload API supporting CSV, JSON, and NPY formats
- Signal listing with pagination and filtering
- Signal detail view with metadata
- Analysis engine with four methods:
  - Statistical analysis (Z-score anomaly detection)
  - Spectral analysis (spectral entropy anomaly detection)
  - Isolation Forest ML anomaly detection
  - Comprehensive analysis (all methods combined)
- Analysis results persistence with anomaly counts
- Export analysis results as JSON or CSV
- OIDC authentication via Keycloak with PKCE
- Role-based access control (viewer, operator, admin)
- Session management with HttpOnly cookies
- Audit logging for all user actions
- Dashboard with signal overview and statistics
- Signal upload page with drag-and-drop
- Signal list page with search and pagination
- Signal detail page with analysis controls
- Docker Compose deployment with Keycloak and PostgreSQL
- Backend tests with pytest (auth, models, signal analysis)
- Frontend tests with Vitest and React Testing Library
- CI/CD workflow configuration

### Security
- No hardcoded secrets; all configuration via environment variables
- Secure OIDC flow with state, nonce, and PKCE
- HttpOnly, SameSite=Lax session cookies
- CSRF protection on state-changing operations
- Role-based authorization on all data endpoints

---

Alan Vo · [alanvo.net](https://alanvo.net) · [X: @alanvoasi](https://x.com/alanvoasi)
