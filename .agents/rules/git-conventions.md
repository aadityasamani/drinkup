# Git Conventions for DrinkUp

## Default Branch
- The default branch is **always `main`**, never `master`.
- All new branches should be cut from `main`.
- When creating a repo or renaming branches, always ensure the default is `main`.

## Branch Strategy
- `main` → stable, production-ready code. Do NOT push directly unless after manual testing on a feature branch.
- `feat/<feature-name>` → new features, developed and manually tested here before merging into `main`.
- `fix/<issue>` → bug fixes.

## Workflow
1. Create a feature branch from `main`: `git checkout -b feat/<name>`
2. Develop and manually test on the feature branch.
3. Once verified working, merge/push into `main`.
4. Never merge broken or untested code into `main`.
