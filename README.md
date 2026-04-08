# GITGLE - GitHub Repository Search System

A search system for indexing and searching GitHub repositories with relevance-based ranking. The system automatically loads, indexes, and provides an interactive interface for searching a repository database.

## What's Included

The project contains three main components:

**Crawl** - loading repository metadata from a curated dataset
**Index** - building an inverted index for fast keyword-based search
**Search** - interactive search interface with result ranking

All three components run sequentially with a single command.

## Architecture

The project uses a distributed architecture with the following components:

- `src/cli/` - command-line interface for crawl, index, and search operations
- `src/pipelines/` - data processing pipelines (crawlPipeline, indexPipeline, searchPipeline)
- `src/search/` - search and indexing logic (tokenization, stemming, TF-IDF ranking)
- `src/services/` - utility services (storageKeys, seedLoader, githubApi)
- `src/runtime/` - distributed in-memory data store
- `distribution.js` - in-memory KV store initialization

### System Diagrams

The project includes documentation with component and interaction diagrams:

- `docs/diagrams/architecture/` - system and component architecture diagrams
- `docs/diagrams/flow/` - data flow diagrams for crawl, index, and search
- `docs/diagrams/sequence/` - sequence diagrams of module interactions
- `docs/diagrams/state/` - document state machine diagrams
- `docs/diagrams/useCase/` - usage scenario diagrams

## Installation

After cloning the repository, install dependencies:

```bash
npm install
```

This installs all required packages listed in package.json:

- **@brown-ds/distribution** (v0.2.32) - distributed system for data exchange and storage
- **natural** (v6.7.0) - natural language processing (tokenization, stemming, TF-IDF scoring)
- **html-to-text** (v9.0.5) - converts HTML to plain text (for README processing)
- **node-fetch** (v2.7.0) - HTTP requests (for GitHub API integration)
- **yargs** (v17.7.2) - command-line argument parsing

All packages will be downloaded to the `node_modules` folder automatically.

## Running

To execute the complete cycle (crawl → index → search):

```bash
npm run auto
```

The system performs the following:

1. Loads a list of 36 repositories from `data/seeds/github-repos.txt`
2. Stores metadata for each repository in the data store
3. Builds an inverted index from documents and README files
4. Launches the interactive search interface

After indexing completes, enter search queries:

```
gitgle> javascript
gitgle> python
gitgle> database
```

The system returns relevant repositories ranked by TF-IDF score and metadata (language, stars, etc.).

To exit the search, type `exit` or press Ctrl+C.
