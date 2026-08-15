# n8n workflows

Two importable workflows. n8n orchestrates embedding and retrieval only — it is never the
database, and it never holds a Supabase credential.

| File | Path | Job |
| --- | --- | --- |
| `embed-workflow.json` | `/webhook/academia-embed` | Upsert a document's chunks into Pinecone |
| `query-workflow.json` | `/webhook/academia-query` | Search a project's namespace, return ids |

Index host baked into both: `academia-scribes-qs7v7wv.svc.aped-4627-b74a.pinecone.io`.
If you recreate the index, update the URL in the two HTTP Request nodes.

## Live on the instance

Both already exist and are active — created through the n8n MCP connector, not imported:

| Workflow | Id |
| --- | --- |
| Academia Scribes — Embed | `PPEqgvwktq6DtkW1` |
| Academia Scribes — Query | `WhNQrPs0apx0EzPn` |

The files here are the source of truth for their shape. They deliberately carry **no**
`credentials` blocks — credential ids are instance-specific and secrets never belong in a
repo.

## Credentials — the part that is easy to get wrong

**A credential's name is only a label. The header it sends is configured *inside* it.**
Getting these confused is what broke the first setup: credential names were typed into the
nodes' header-parameter fields, so Pinecone received a header called `Pinecone API` in one
workflow and the n8n webhook secret in the other.

Create **two** Header Auth credentials:

| Call it | Header **name** inside it | Header **value** | Attach to |
| --- | --- | --- | --- |
| Academia Webhook Auth | `Authorization` | `Bearer <N8N_WEBHOOK_SECRET>` | the **Webhook** node, both workflows |
| Pinecone API | `Api-Key` | your `pcsk_...` | the **Pinecone** node, both workflows |

`N8N_WEBHOOK_SECRET` is in the app's `.env.local`; the values must match exactly, `Bearer `
prefix included.

Two rules worth stating plainly:

- **One credential cannot serve both nodes.** They send different headers.
- **Never put a key in a header parameter.** Those are stored in plaintext in the workflow
  definition. Only credentials are encrypted.

Then copy each **Production URL** into the app's `.env.local` as `N8N_EMBED_WEBHOOK_URL`
and `N8N_QUERY_WEBHOOK_URL`. The Test URL accepts one call per "Listen for test event"
click — don't wire that one up.

## What crosses the wire

**Embed** — the app sends chunk ids and text; n8n reshapes it to Pinecone's NDJSON and
upserts. Pinecone embeds on arrival (integrated inference), so no embedding key is needed.

```jsonc
// request
{ "documentId": "…", "projectId": "…", "userId": "…",
  "namespace": "u_<userId>__p_<projectId>",
  "chunks": [{ "id": "<uuid>", "index": 0, "content": "…" }] }

// response — the app flips exactly these rows to embedded = true
{ "embedded": ["<uuid>"], "failed": [{ "chunkId": "…", "error": "…" }] }
```

**Query** — the app sends a question; n8n returns matching chunk ids and scores.

```jsonc
{ "namespace": "u_<userId>__p_<projectId>", "question": "…", "topK": 8 }
→ { "matches": [{ "chunkId": "<uuid>", "score": 0.87 }] }
```

### The query workflow returns ids, never text

This is the load-bearing detail. The app hydrates chunk text from Postgres under the
student's own session, so Row Level Security decides what can reach the prompt. Returning
`chunk_text` from this workflow would route around that check — the answer would be built
from Pinecone's copy instead of from rows the student is allowed to read.

Do not add `chunk_text` to the query response, however convenient it looks.

## Known trade-off

Integrated inference embeds server-side, which means Pinecone receives the chunk text and
stores it as metadata. Student text therefore exists in Pinecone as well as Postgres.

The hydration rule above still holds — the app never *serves* text it read from Pinecone —
but the isolation guarantee is "never served" rather than "unreachable". To keep text out
of Pinecone entirely you would embed with a separate provider (OpenAI, Voyage) and upsert
bare vectors via `/vectors/upsert`, at the cost of another API key.

## Notes

- **Auth is a static bearer token, not the HMAC.** The app also sends
  `x-academia-signature` and `x-academia-timestamp` (HMAC-SHA256 over
  `"{timestamp}.{body}"`), which additionally covers replay and body tampering. Verifying
  it needs `crypto` in a Code node, which self-hosted n8n only allows with
  `NODE_FUNCTION_ALLOW_BUILTIN=crypto`. Set that and you can tighten the Webhook nodes.
- **Namespaces need no setup** — Pinecone creates them on first upsert.
- **`X-Pinecone-API-Version: 2025-04`** is pinned in both HTTP nodes. If Pinecone's
  records API shape changes, that header and the two Code nodes are what to check.
- **Input cap:** `llama-text-embed-v2` takes 2048 tokens. The app chunks to roughly 800,
  and the embed workflow rejects anything over the cap with a reason rather than failing
  the whole batch.
