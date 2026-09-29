# InsightForge AI — Full Development Roadmap (End-to-End)

**Mentor model:** Senior Engineer / Junior Dev. No code until a phase's design is approved. One module at a time.

You've said no time ceiling, so this is now one continuous roadmap, full scope, no cut features. Every phase starts with an explicit **"Learn This First"** checklist — treat it as a gate. Don't move into a phase's tasks until you've at least read/understood its checklist; we'll still teach in-depth together when we get there, but this tells you what to pre-study so our sessions go faster.

---

## PHASE 0 — Planning & Foundations

### 📚 Learn This First
- **SQL:** normalization (1NF–3NF), primary/foreign keys, indexing basics
- **Backend:** layered/clean architecture (`api/ services/ repositories/ models/ schemas/ core/`), REST resource modeling
- **Docs:** [FastAPI project structure](https://fastapi.tiangolo.com/tutorial/bigger-applications/), [PostgreSQL docs — data types & constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- Estimated learning time: 5–7 hrs

### Milestones
- 0.1 Repo/monorepo setup (`/backend /frontend /infra /docs`)
- 0.2 Architecture diagram, full DB schema v1, API list, data flow diagram
- 0.3 Roadmap sign-off with me before any code

---

## PHASE 1 — Authentication & Dataset Management

### 📚 Learn This First
- **Backend/Security:** password hashing (bcrypt/argon2) and why not SHA-256, JWT structure (header/payload/signature), access vs refresh tokens, OAuth2PasswordBearer flow, dependency injection (`Depends()`)
- **SQL:** UNIQUE constraints, foreign keys, cascading deletes, query filtering by owner (multi-tenancy)
- **Cloud (light):** local vs object storage concepts (why S3 later, not yet)
- **Docs:** [FastAPI security docs](https://fastapi.tiangolo.com/tutorial/security/), [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [jwt.io](https://jwt.io/introduction)
- Estimated learning time: 15–18 hrs

### Milestones & Tasks
- 1.1 User model + registration endpoint
- 1.2 Login + JWT issuing
- 1.3 Auth middleware for protected routes
- 1.4 User profile endpoint
- 1.5 CSV upload endpoint (size/type validation, streaming vs full-load)
- 1.6 Dataset metadata table with strict per-user ownership
- 1.7 List / view / delete dataset + dataset history

**Interview topics after this phase:** JWT vs session auth, stateless auth at scale, multi-tenant data isolation, file upload security (path traversal, size DoS).

---

## PHASE 2 — Data Validation & Automatic Cleaning

### 📚 Learn This First
- **ML/Stats:** descriptive statistics (mean/median/std/percentiles), IQR & z-score outlier detection, missing-data mechanisms (MCAR/MAR/MNAR — conceptual level is enough)
- **SQL:** aggregate queries, `JSONB` columns in Postgres (for storing flexible cleaning reports)
- **Backend:** pipeline / strategy design pattern (so cleaning steps are swappable, testable units, not one big script)
- **Docs:** [pandas — missing data](https://pandas.pydata.org/docs/user_guide/missing_data.html), [scikit-learn preprocessing guide](https://scikit-learn.org/stable/modules/preprocessing.html)
- Estimated learning time: 8–10 hrs

### Milestones & Tasks
- 2.1 Schema/type detection, missing-value report, duplicate detection, outlier flags
- 2.2 Automatic cleaning pipeline (imputation strategies, dedup, type coercion)
- 2.3 Persisted "cleaning report" shown to the user (transparency)

**Interview topics:** why different imputation strategies for different missingness types, IQR vs z-score trade-offs, designing idempotent data pipelines.

---

## PHASE 3 — EDA Engine & Dashboard

### 📚 Learn This First
- **ML/Stats:** correlation vs causation, distribution shape/skewness, basic feature importance (from a quick baseline model)
- **Backend:** response caching strategy, pagination for large datasets
- **Frontend:** Next.js data fetching patterns, Chart.js basics, Tailwind utility-first CSS
- **Docs:** [Chart.js docs](https://www.chartjs.org/docs/latest/), [Next.js data fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- Estimated learning time: 10 hrs

### Milestones & Tasks
- 3.1 Backend EDA service (summary stats, correlation matrix, distributions, feature importance)
- 3.2 Frontend dashboard consuming EDA API (KPIs, charts, dataset summary)
- 3.3 Caching EDA results

**Interview topics:** caching strategy trade-offs (TTL vs invalidation), when correlation is misleading, designing APIs for chart-consumption.

---

## PHASE 4 — ML Core: Regression + Classification

### 📚 Learn This First (biggest study block in the project — budget real time)
- **ML, study in this order:**
  1. Bias-variance tradeoff
  2. Train/test/validation split, why random shuffling can leak information
  3. Cross-validation (k-fold, stratified k-fold)
  4. Regression metrics: RMSE, MAE, R²
  5. Classification metrics: accuracy, precision, recall, F1, ROC-AUC — and when each matters more
  6. Overfitting/underfitting, regularization (L1/L2)
  7. Hyperparameter tuning: GridSearchCV, RandomizedSearchCV
  8. Ensemble methods: why Random Forest / XGBoost typically beat a single decision tree
  9. Data leakage: what it is, how pipelines prevent it
- **Backend:** async/background job processing (Celery + Redis, or FastAPI `BackgroundTasks` as v1 shortcut), model serialization (`joblib`), idempotency
- **Cloud (light):** where trained model artifacts live (disk now, S3 later)
- **Docs:** [scikit-learn model evaluation](https://scikit-learn.org/stable/modules/model_evaluation.html), [scikit-learn Pipeline](https://scikit-learn.org/stable/modules/compose.html), [XGBoost docs](https://xgboost.readthedocs.io/en/stable/), [Celery docs](https://docs.celeryq.dev/en/stable/)
- Estimated learning time: 25–30 hrs

### Milestones & Tasks
- 4.1 Preprocessing pipeline (encoding, scaling, split) as a reusable serializable `sklearn.Pipeline`
- 4.2 Training service — multiple models per task type (regression: Linear/RandomForest/XGBoost; classification: Logistic/RandomForest/XGBoost)
- 4.3 Model comparison/leaderboard with cross-validation
- 4.4 Background job execution so training doesn't block the API
- 4.5 Prediction endpoint (load saved model, predict on new input)

**Interview topics:** why CV over a single split, precision/recall trade-off in a business context, why tree ensembles are a strong default, avoiding data leakage in pipelines.

---

## PHASE 5 — Clustering (Customer Segmentation)

### 📚 Learn This First
- **ML:** distance metrics (Euclidean, cosine), K-Means algorithm, elbow method, silhouette score, when clustering makes sense vs supervised learning
- **Docs:** [scikit-learn clustering guide](https://scikit-learn.org/stable/modules/clustering.html)
- Estimated learning time: 6–8 hrs

### Milestones & Tasks
- 5.1 Feature prep for clustering (scaling is critical here)
- 5.2 K-Means training + elbow/silhouette selection of k
- 5.3 Cluster profiling ("Segment A = high spend, low frequency")
- 5.4 API + dashboard visualization of segments

---

## PHASE 6 — Time Series Forecasting

### 📚 Learn This First
- **ML:** stationarity, trend/seasonality decomposition, why you never randomly shuffle time series for train/test, ARIMA basics or Prophet's model assumptions
- **Docs:** [statsmodels time series](https://www.statsmodels.org/stable/tsa.html), [Prophet docs](https://facebook.github.io/prophet/docs/quick_start.html)
- Estimated learning time: 10–12 hrs

### Milestones & Tasks
- 6.1 Time series preprocessing (resampling, handling gaps)
- 6.2 Forecast model training (Prophet or ARIMA/SARIMA)
- 6.3 Forecast evaluation (MAPE, backtesting on rolling windows)
- 6.4 API + dashboard chart for forecast vs actual

---

## PHASE 7 — Anomaly Detection

### 📚 Learn This First
- **ML:** unsupervised anomaly scoring, Isolation Forest, z-score-based detection, precision/recall trade-offs specific to rare-event detection
- **Docs:** [scikit-learn novelty/outlier detection](https://scikit-learn.org/stable/modules/outlier_detection.html)
- Estimated learning time: 6 hrs

### Milestones & Tasks
- 7.1 Isolation Forest pipeline on numeric features
- 7.2 Threshold tuning + explanation of flagged anomalies
- 7.3 API + dashboard flags

---

## PHASE 8 — AI-Generated Business Insights

### 📚 Learn This First
- **Concept:** this is a rules/threshold + trend-detection + templated NLG engine, not a black-box model — you need to be able to explain the detection logic in an interview
- **Backend:** template rendering, optionally structuring an LLM call for phrasing only (detection logic stays yours)
- Estimated learning time: 5–6 hrs

### Milestones & Tasks
- 8.1 Define insight rules (% change thresholds, top-contributor detection, trend direction)
- 8.2 Insight generation service (rules → structured facts → template sentences)
- 8.3 (Optional) LLM-polish layer for more natural phrasing
- 8.4 Dashboard insight feed

---

## PHASE 9 — Reports

### 📚 Learn This First
- **Backend:** PDF generation (WeasyPrint or ReportLab), template-driven document generation
- **Docs:** [WeasyPrint docs](https://doc.courtbouillon.org/weasyprint/stable/)
- Estimated learning time: 4 hrs

### Milestones & Tasks
- 9.1 PDF report (dataset summary + EDA charts + model results + insights)
- 9.2 CSV export of predictions

---

## PHASE 10 — Model Management / Registry

### 📚 Learn This First
- **Backend:** model versioning strategies, artifact lineage tracking, rollback design
- Estimated learning time: 4–5 hrs

### Milestones & Tasks
- 10.1 Model registry table (version, metrics, training params, dataset ref)
- 10.2 Load/activate/rollback endpoints
- 10.3 Delete model + cleanup of artifacts

---

## PHASE 11 — Deployment, CI/CD, Monitoring

### 📚 Learn This First
- **Cloud:** Docker networking, docker-compose, EC2 setup + security groups, environment variable management, Nginx reverse proxy basics
- **DevOps:** GitHub Actions pipeline stages (lint → test → build → deploy)
- **Docs:** [Docker Compose docs](https://docs.docker.com/compose/), [GitHub Actions docs](https://docs.github.com/en/actions), [AWS EC2 getting started](https://docs.aws.amazon.com/ec2/)
- Estimated learning time: 14–16 hrs

### Milestones & Tasks
- 11.1 Dockerize backend, frontend, Postgres via docker-compose
- 11.2 Deploy to AWS EC2, env var management, structured logging
- 11.3 GitHub Actions CI/CD (lint/test/build/deploy)
- 11.4 Basic monitoring/error logging dashboard
- 11.5 README, architecture doc, demo video (this is what recruiters actually look at)

---

## Rough Effort Totals (full scope)

| Phase | Learning | Dev |
|---|---|---|
| 0 Planning | 5–7 hrs | 4–6 hrs |
| 1 Auth & Datasets | 15–18 hrs | 20–25 hrs |
| 2 Cleaning | 8–10 hrs | 15–18 hrs |
| 3 EDA/Dashboard | 10 hrs | 20–25 hrs |
| 4 Regression/Classification | 25–30 hrs | 30–35 hrs |
| 5 Clustering | 6–8 hrs | 10–12 hrs |
| 6 Forecasting | 10–12 hrs | 12–15 hrs |
| 7 Anomaly Detection | 6 hrs | 8–10 hrs |
| 8 AI Insights | 5–6 hrs | 10–12 hrs |
| 9 Reports | 4 hrs | 10 hrs |
| 10 Model Registry | 4–5 hrs | 8–10 hrs |
| 11 Deployment/CI-CD | 14–16 hrs | 15–18 hrs |
| **Total** | **~112–132 hrs** | **~162–186 hrs** |

That's roughly **275–320 total hours**. At full dedication (say 4–5 hrs/day), that's about **2–2.5 months**. We'll track actual progress against this and adjust as we go — estimates always drift once we hit real code.

---

## Next Step

We start **Phase 0, Milestone 0.2**: architecture diagram, DB schema v1, API list. No code until that's done and reviewed. Let me know when you're ready to begin, or if you want to first spend a day just reading through the Phase 0 and Phase 1 "Learn This First" docs.
