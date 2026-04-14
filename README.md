# Chromosome Hi-C Graph Explorer

Web-based scaffold for exploring chromosome Hi-C interaction graphs.

# How to run
cd /project_graph_theory
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
deactivate

cd frontend
npm install
cd ..

Terminal 1

cd "/Users/abhishekpandey/Desktop/Graph theory/project_graph_theory/backend"
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

Terminal 2

cd "/Users/abhishekpandey/Desktop/Graph theory/project_graph_theory/frontend"
npm run dev -- --host 127.0.0.1 --port 5173

## Stack

- **Backend**: FastAPI + pandas + NetworkX
- **Frontend**: React + TypeScript + Vite
- **Graph renderer**: Cytoscape.js via `react-cytoscapejs`

## Folder tree

```text
project/
  backend/
    app/
      __init__.py
      main.py
      config.py
      routers/
        __init__.py
        health.py
        graph.py
      services/
        __init__.py
        data_loader.py
        graph_builder.py
        metrics.py
        gene_mapping.py
        graph_service.py
      models/
        __init__.py
        schemas.py
      utils/
        __init__.py
        logging.py
    data/
    outputs/
    requirements.txt
    requirements-dev.txt
    start_backend.sh
  frontend/
    package.json
    index.html
    src/
      App.tsx
      main.tsx
      styles.css
      components/
        ControlPanel.tsx
        GraphView.tsx
        InfoPanel.tsx
      pages/
        ExplorerPage.tsx
      services/
        api.ts
      hooks/
        useGraphData.ts
      types/
        graph.ts
        react-cytoscapejs.d.ts
  README.md
```

## API design

- `GET /api/health` → backend health
- `GET /api/graph/current` → graph built from local data files
- `GET /api/graph/demo` → alias for current local-file graph

Backend modules are split so you can scale each concern independently:

- **Data loading**: `app/services/data_loader.py`
- **Graph building**: `app/services/graph_builder.py`
- **Metrics**: `app/services/metrics.py`
- **Gene mapping**: `app/services/gene_mapping.py`
- **Orchestration**: `app/services/graph_service.py`

File ingestion modules:

- **Hi-C loader**: `app/services/hic_loader.py`
- **Gene loader**: `app/services/gene_loader.py`
- **Shared validators**: `app/services/validators.py`

### Config-driven ingestion

The backend reads the following environment variables (optional):

- `TARGET_CHROMOSOME` (default: `chr2`)
- `HIC_FILE_PATH` (default: `backend/data/hic_data/chr2_1mb.txt`)
- `GENE_FILE_PATH` (default: `backend/data/GM12878_gene_expression.tsv`)
- `REMOVE_SELF_LOOPS` (default: `true`)
- `BIN_SIZE` (default: `1000000`)

### Default graph filtering (web demo)

Graph construction uses a visually clean default strategy in `app/services/graph_filter_config.py`:

- `min_weight_threshold = 10000`
- remove all self-loops (`bin1 == bin2`)
- optional near-diagonal exclusion (`remove_near_diagonal_bins = 1` means remove `|bin1-bin2| <= 1` bin)
- compute distance-normalized edge strength via observed/expected by genomic distance
- keep positive enrichment edges (`observed_expected - 1 > 0`)
- `top_percent_strongest_edges = 1.0` (disabled by default)
- `top_k_neighbors_per_node = 8`
- `distance_epsilon = 1e-6`

This produces:

- an **original weighted graph**
- a **filtered graph** for web rendering
- a **distance graph** with `distance = 1 / (weight + epsilon)`

## Centrality metrics

Node-level centrality is computed in `app/services/centrality.py`:

- **weighted degree centrality** on the original weighted graph
- **weighted betweenness centrality** on the distance graph
- **weighted closeness centrality** on the distance graph

Each metric is stored as:

- raw value
- normalized value in `[0, 1]` for frontend coloring

For disconnected graphs, closeness uses NetworkX with `wf_improved=True` so
disconnected components are handled safely and isolated nodes get closeness `0.0`.

Node metrics are exported per chromosome to:

- `backend/outputs/node_metrics_<chromosome>.csv`
- `backend/outputs/node_metrics_<chromosome>.json`

## Community detection

Community assignment is implemented in `app/services/communities.py`.

- Preferred method: **Louvain** (`python-louvain`)
- Fallback: NetworkX **greedy modularity communities**

Each node receives an integer `community_id` (stable remapped IDs).
If available, modularity score is included in API metadata (`community_modularity`).

Outputs per chromosome:

- Node assignments:
  - `backend/outputs/node_communities_<chromosome>.csv`
  - `backend/outputs/node_communities_<chromosome>.json`
- Community summaries:
  - `backend/outputs/community_summary_<chromosome>.csv`
  - `backend/outputs/community_summary_<chromosome>.json`

## Sample construction for one chromosome

Current default builds from `chr2_1mb.txt`.

- Endpoint: `GET /api/graph/current?chromosome=chr2`
- Response metadata includes original/filtered/distance summaries:
  - node count
  - edge count
  - connected components
  - density

## Local setup

### Prerequisites

- Python **3.9+**
- Node.js **18.18+**
- npm **9+**

### Linux/macOS

```bash
cd "/Users/abhishekpandey/Desktop/Graph theory/project_graph_theory"
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

cd frontend
npm install
cd ..
```

### Windows (PowerShell)

```powershell
cd "C:\path\to\project_graph_theory"
python -m venv backend/.venv
.\backend\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend/requirements.txt

cd frontend
npm install
cd ..
```

## Run locally

### Backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm run dev
```

Open:

- Frontend: `http://127.0.0.1:5173`
- FastAPI docs: `http://127.0.0.1:8000/docs`
- Health endpoint: `http://127.0.0.1:8000/api/health`

## Adding a new chromosome file

If you add a new Hi-C file (for example `backend/data/hic_data/chr9_1mb.txt`), you can load it directly from the UI by entering `chr9`.

The backend now auto-generates missing frontend artifacts on first request (`/api/graph`, `/api/communities`, etc.) using `backend/build_graph_artifacts.py` internally.

- If the input file exists, artifacts are created automatically under `backend/outputs/frontend_artifacts/chr9/`.
- If the input file is missing, you get a clear error indicating the chromosome Hi-C input file was not found.
