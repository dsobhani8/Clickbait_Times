# Runtime Prompts

This directory is the source of truth for prompt files used by the app/backend runtime.

Current pipeline roles:
- `regular_body_rewrite.py`
- `regular_title_lead_rewrite.py`
- `clickbait_title_lead_rewrite.py`
- `clickbait_body_rewrite.py`

Code mapping:
- `backend/rewrite-prompts.js`

Notes:
- In runtime code, the `facts_only` variant currently maps to the `regular_*` prompt files because this stage is the neutral/facts-only branch of the pipeline.
- Legacy research prompts under `modules/**/prompts/*.py` are kept locally for reference but are no longer the runtime source of truth.
