# InfoLoom Phase 3 Architecture: Exploratory Data Analysis & Custom Scroll Landing

```
+-------------------------------------------------------------------------------------------------+
|                                        FRONTEND CLIENT                                          |
|                                                                                                 |
|   +---------------------------------------+       +-----------------------------------------+   |
|   |         Landing Page Portal           |       |            Authenticated Shell          |   |
|   |   (ScrollPortal: 5 Nested Scenes,     |       |   (Sidebar Nav, Dashboard, Datasets,   |   |
|   |    Hero Artwork 3D Transformations,   |       |    EDA Visualizer, Insights, History,   |   |
|   |    Sergena Brand Font, Desktop Tilt)  |       |    Settings)                            |   |
|   +---------------------------------------+       +-----------------------------------------+   |
|                        |                                               |                        |
|                        +-----------------------+-----------------------+                        |
|                                                |                                                |
|                                     TanStack Query Client                                       |
|                                  Chart.js / react-chartjs-2                                     |
+------------------------------------------------|------------------------------------------------+
                                                 | HTTP / JSON (Bearer JWT)
                                                 v
+-------------------------------------------------------------------------------------------------+
|                                         BACKEND API                                             |
|                                                                                                 |
|   FastAPI REST Layer (/api/v1/datasets/{id}/eda)                                                |
|   ├── GET /eda (full cached or real-time EDA)                                                   |
|   ├── POST /eda/refresh (force cache bypass)                                                    |
|   ├── GET /eda/correlations                                                                     |
|   └── GET /eda/feature-importance                                                               |
|                                                |                                                |
|   +--------------------------------------------v--------------------------------------------+   |
|   |                                     EDAService                                          |   |
|   |   - KPIs & Memory Profiling                                                             |   |
|   |   - Summary Statistics (Moments, IQR, Skewness, Kurtosis)                               |   |
|   |   - Correlation Engine (Pearson, Multicollinearity Signal Detection)                    |   |
|   |   - Univariate Distributions (Histogram binning & Category frequencies)                 |   |
|   |   - Feature Importance (Baseline Random Forest Classifier / Regressor)                  |   |
|   +--------------------------------------------+--------------------------------------------+   |
|                                                |                                                |
|                   +----------------------------+----------------------------+                   |
|                   |                                                         |                   |
|                   v                                                         v                   |
|       +-----------------------+                                 +-----------------------+       |
|       |     Postgres DB       |                                 |    Storage Volume     |       |
|       |  (eda_reports cache)  |                                 |   (Raw & Cleaned CSV) |       |
|       +-----------------------+                                 +-----------------------+       |
+-------------------------------------------------------------------------------------------------+
```

## Architectural Highlights
1. **Separation of Concerns**: The EDA calculation engine operates purely on `pandas` and `scikit-learn` within `EDAService`, abstracted from HTTP routers and persistence repositories.
2. **Caching Strategy**: EDA results are serialized as JSON in `eda_reports`. When datasets are mutated (e.g. through the cleaning pipeline), caches are invalidated to ensure statistical correctness.
3. **Frontend Presentation**: The landing page uses a custom `ScrollPortal` component that translates camera perspective through 5 progressive phases of data ingestion to deployment, while the authenticated app shell maintains high information density with Chart.js visualizations.
