# n8n workflows

Five importable workflows. n8n orchestrates embedding, retrieval and answer generation -
it is never the database, and it never holds a Supabase credential.

| File | Path | Job |
| --- | --- | --- |
| `embed-workflow.json` | `/webhook/academia-embed` | Upsert a document's chunks into Pinecone |
| `query-workflow.json` | `/webhook/academia-query` | Search a project's namespace, return ids |
| `answer-workflow.json` | `/webhook/academia-answer` | Build the prompt, run OpenRouter, return the answer |
| `questions-workflow.json` | `/webhook/academia-questions` | Write defense questions, with multiple choice |
| `mnemonics-workflow.json` | `/webhook/academia-mnemonics` | Turn ordered lists into memory aids |

Index host baked into both: `academia-scribes-qs7v7wv.svc.aped-4627-b74a.pinecone.io`.
If you recreate the index, update the URL in the two HTTP Request nodes.

**The index's `field_map` names the text field `text`** - not `chunk_text`. `Build Records`
must emit that exact key or Pinecone rejects the whole batch with
`Missing field_mapping field 'text'`. If you rebuild the index with a different field name,
this is the line that has to change with it.

## Live on the instance

Instance: `https://4av76vuk.rpcld.net` (self-hosted on RepoCloud). Note it is shut down
between working sessions - when it is off, upload indexing and Ask both fail.

| Workflow | Id | State |
| --- | --- | --- |
| Academia Scribes - Embed | `PPEqgvwktq6DtkW1` | active |
| Academia Scribes - Query | `WhNQrPs0apx0EzPn` | active |
| Academia Scribes - Answer | `g2rZ9pjdTKsfPd8U` | created **inactive** |

All three were created through the n8n MCP connector rather than imported.

### Known break: the Webhook credential is wrong on all three

Embed and Query both have `hhTc4zHU3PM5Mpo3` ("Header Auth account 3") on the **Webhook**
node *and* the Pinecone node. One credential, two different required headers - so the
Webhook nodes are checking for Pinecone's `Api-Key` and reject the app:

```
POST /webhook/academia-embed  → 403 "Authorization data is wrong!"
POST /webhook/academia-query  → 403 "Authorization data is wrong!"
```

Pinecone is fine; the app simply cannot get in. Answer's Webhook node was left with **no**
credential on purpose, so n8n flags it rather than inheriting the same fault silently.

The fix is one new credential in the UI - Header Auth, header name `Authorization`, value
`Bearer <N8N_WEBHOOK_SECRET>` - attached to the Webhook node of all three workflows. The
Pinecone nodes keep `hhTc4zHU3PM5Mpo3`.

The files here are the source of truth for their shape. They deliberately carry **no**
`credentials` blocks - credential ids are instance-specific and secrets never belong in a
repo.

## Credentials - the part that is easy to get wrong

**A credential's name is only a label. The header it sends is configured *inside* it.**
Getting these confused is what broke the first setup: credential names were typed into the
nodes' header-parameter fields, so Pinecone received a header called `Pinecone API` in one
workflow and the n8n webhook secret in the other.

Create **two** Header Auth credentials:

| Call it | Header **name** inside it | Header **value** | Attach to |
| --- | --- | --- | --- |
| Academia Webhook Auth | `Authorization` | `Bearer <N8N_WEBHOOK_SECRET>` | the **Webhook** node, all three workflows |
| Pinecone API | `Api-Key` | your `pcsk_...` | the **Pinecone** node, Embed and Query |

The Answer workflow needs no Header Auth credential of its own beyond the webhook one -
its model node uses the existing **OpenRouter account** credential (`openRouterApi`).

`N8N_WEBHOOK_SECRET` is in the app's `.env.local`; the values must match exactly, `Bearer `
prefix included.

Two rules worth stating plainly:

- **One credential cannot serve both nodes.** They send different headers.
- **Never put a key in a header parameter.** Those are stored in plaintext in the workflow
  definition. Only credentials are encrypted.

Then copy each **Production URL** into the app's `.env.local` as `N8N_EMBED_WEBHOOK_URL`
and `N8N_QUERY_WEBHOOK_URL`. The Test URL accepts one call per "Listen for test event"
click - don't wire that one up.

## What crosses the wire

**Embed** - the app sends chunk ids and text; n8n reshapes it to Pinecone's NDJSON and
upserts. Pinecone embeds on arrival (integrated inference), so no embedding key is needed.

```jsonc
// request
{ "documentId": "…", "projectId": "…", "userId": "…",
  "namespace": "u_<userId>__p_<projectId>",
  "chunks": [{ "id": "<uuid>", "index": 0, "content": "…" }] }

// response - the app flips exactly these rows to embedded = true
{ "embedded": ["<uuid>"], "failed": [{ "chunkId": "…", "error": "…" }] }
```

**Query** - the app sends a question; n8n returns matching chunk ids and scores.

```jsonc
{ "namespace": "u_<userId>__p_<projectId>", "question": "…", "topK": 8 }
→ { "matches": [{ "chunkId": "<uuid>", "score": 0.87 }] }
```

**Answer** - the app sends the question plus excerpts it has *already* read from Postgres.

```jsonc
{ "projectId": "…", "userId": "…", "question": "…",
  "chunks": [{ "id": "<uuid>", "chapter": 3, "label": "Methodology", "content": "…" }] }
→ { "answer": "…" }
```

This is the one call that carries chunk text out of the app, and it is safe only because
of *when* it happens: the caller hydrated those chunks under the student's own session
first, so RLS already decided what is in the payload. The Answer workflow must therefore
only format what it was given - adding any lookup of its own would route around that.

Two further rules for that workflow:

- **Excerpt order is the citation contract.** `Build Prompt` numbers excerpts in the order
  received, the model cites them as `[1]`, `[2]`, and the app maps those back to chunk ids
  *by position*. Reordering or dropping one misattributes a source.
- **Turn execution saving off** (Workflow Settings → save successful production executions
  → none, already set in the JSON). Otherwise every answer stores a copy of the student's
  project text in n8n's execution history - which `get_execution` can read back.

### Why generation moved here

Editing the prompt on the canvas beats redeploying the app for a wording change. The cost
is that a webhook response is all-or-nothing, so answers cannot stream - the student waits
on a spinner rather than watching text arrive. Worth revisiting before Phase 5's mock
defense, where waiting is more expensive.

Token counts are also not returned: `chainLlm` reports the completion, not usage. Cost
tracking will need either an estimate or a swap of the chain node for an HTTP Request node
against OpenRouter directly.

### The query workflow returns ids, never text

This is the load-bearing detail. The app hydrates chunk text from Postgres under the
student's own session, so Row Level Security decides what can reach the prompt. Returning
`chunk_text` from this workflow would route around that check - the answer would be built
from Pinecone's copy instead of from rows the student is allowed to read.

Do not add `chunk_text` to the query response, however convenient it looks.

## Known trade-off

Integrated inference embeds server-side, which means Pinecone receives the chunk text and
stores it as metadata. Student text therefore exists in Pinecone as well as Postgres.

The hydration rule above still holds - the app never *serves* text it read from Pinecone -
but the isolation guarantee is "never served" rather than "unreachable". To keep text out
of Pinecone entirely you would embed with a separate provider (OpenAI, Voyage) and upsert
bare vectors via `/vectors/upsert`, at the cost of another API key.

## Notes

- **Auth is a static bearer token, not the HMAC.** The app also sends
  `x-academia-signature` and `x-academia-timestamp` (HMAC-SHA256 over
  `"{timestamp}.{body}"`), which additionally covers replay and body tampering. Verifying
  it needs `crypto` in a Code node, which self-hosted n8n only allows with
  `NODE_FUNCTION_ALLOW_BUILTIN=crypto`. Set that and you can tighten the Webhook nodes.
- **Namespaces need no setup** - Pinecone creates them on first upsert.
- **`X-Pinecone-API-Version: 2025-04`** is pinned in both HTTP nodes. If Pinecone's
  records API shape changes, that header and the two Code nodes are what to check.
- **Input cap:** `llama-text-embed-v2` takes 2048 tokens. The app chunks to roughly 800,
  and the embed workflow rejects anything over the cap with a reason rather than failing
  the whole batch.
