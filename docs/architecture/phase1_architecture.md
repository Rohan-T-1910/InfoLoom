# InfoLoom Phase 1 Architecture: Authentication & Dataset Management

## Overview
Phase 1 establishes the core backend foundations for InfoLoom: secure multi-tenant user authentication and streaming dataset upload and management.

---

## Layered Clean Architecture

```mermaid
flowchart TD
    Client["Client / Frontend"] --> API["API Layer (FastAPI Routers)"]
    API --> Deps["Dependencies (Auth & DB Session)"]
    API --> Services["Service Layer (Business Logic)"]
    Services --> Repos["Repository Layer (Query Abstraction)"]
    Services --> Storage["File Storage (uploads/user_{id}/)"]
    Repos --> DB[(PostgreSQL Database)]
```

### Layer Responsibilities
- **API (`app/api/`)**: Defines endpoints, routes, query/body parameter validation, and HTTP status codes.
- **Dependencies (`app/api/dependencies.py`)**: Handles per-request database session management (`get_db`) and JWT token extraction/validation (`get_current_user`).
- **Services (`app/services/`)**: Implements business rules: password hashing, JWT generation, file streaming, MIME/extension verification, CSV parsing, metadata extraction, and multi-tenant access control.
- **Repositories (`app/repositories/`)**: Encapsulates all SQLAlchemy queries (`select`, `add`, `delete`, filtering by `user_id`).
- **Models (`app/models/`)**: SQLAlchemy declarative models (`User`, `Dataset`) mapping to database tables.
- **Schemas (`app/schemas/`)**: Pydantic models for data validation, serialization, and OpenAPI documentation.
- **Core (`app/core/`)**: Application configurations (`Settings`) and security utilities (`hash_password`, `verify_password`, `create_access_token`).

---

## Authentication Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Client
    participant API as FastAPI Router
    participant Service as AuthService
    participant Repo as UserRepository
    participant DB as PostgreSQL

    Note over User,DB: Registration Flow
    User->>API: POST /api/v1/auth/register (name, email, password)
    API->>Service: register(user_in)
    Service->>Repo: get_by_email(email)
    Repo->>DB: SELECT * FROM users WHERE email = :email
    DB-->>Repo: None
    Service->>Service: hash_password(password) using bcrypt
    Service->>Repo: create(user, hashed_password)
    Repo->>DB: INSERT INTO users ...
    DB-->>Repo: User record
    Service-->>API: User
    API-->>User: 201 Created (UserResponse without password)

    Note over User,DB: Login & Token Issuance
    User->>API: POST /api/v1/auth/login (email, password)
    API->>Service: authenticate(email, password)
    Service->>Repo: get_by_email(email)
    Repo->>DB: SELECT * FROM users WHERE email = :email
    DB-->>Repo: User record
    Service->>Service: verify_password(plain, hash)
    Service->>Service: create_access_token(sub=user.id, claims)
    Service-->>API: Token(access_token, bearer)
    API-->>User: 200 OK (access_token)
```

---

## Dataset Ingestion & Streaming Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Authenticated Client
    participant Auth as Auth Dependency
    participant API as Dataset Router
    participant Service as DatasetService
    participant Disk as Local File Storage
    participant Repo as DatasetRepository
    participant DB as PostgreSQL

    User->>API: POST /api/v1/datasets/upload (file: multipart/form-data)
    API->>Auth: Validate Bearer JWT Token
    Auth-->>API: Current User (id, email)
    API->>Service: upload_dataset(file, user_id)
    Service->>Service: Validate extension (.csv) & Content-Type
    Service->>Disk: Stream chunks (64KB) to uploads/user_{id}/{uuid}_{name}
    Note over Service,Disk: If bytes > MAX_UPLOAD_SIZE, delete file & abort with 413
    Service->>Service: Inspect CSV headers, row counts, & column data types
    Service->>Repo: create(user_id, metadata, file_path)
    Repo->>DB: INSERT INTO datasets ...
    DB-->>Repo: Dataset record
    Service-->>API: Dataset
    API-->>User: 201 Created (DatasetDetailResponse)
```

---

## Multi-Tenancy & Security Guarantees
1. **Strict Ownership Isolation**: Every query in `DatasetRepository` filters by `user_id == current_user.id`. Even if a user knows another user's dataset ID, requests return `404 Not Found`.
2. **Path Traversal Protection**: Filenames are sanitized via `os.path.basename` and regex alphanumeric scrubbing before writing to disk.
3. **RAM Exhaustion (DoS) Protection**: Uploads are processed in 64KB streaming chunks rather than loaded into memory all at once.
4. **Cascading Deletions**: Deleting a user cascades to all their datasets via `ondelete='CASCADE'`.
