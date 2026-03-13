# FundLens Frontend

## Commands

- `npm install`
- `npm run dev`
- `npm run build`

## Environment

- `VITE_API_URL`: base HTTP URL for the Lambda Function URL or API Gateway HTTP endpoint.
- `VITE_PROGRESS_WS_URL`: API Gateway WebSocket URL used for real-time analysis trace updates.

The frontend is configured for live backend traffic only.

## Windows and WSL

Do not reuse the same `node_modules` directory across Windows PowerShell and WSL.
Vite, Rollup, and esbuild install native optional packages per OS, so a tree created on
Windows will miss Linux binaries inside WSL, and vice versa.

If you switch environments, remove `node_modules` and reinstall in the environment you
plan to run:

- WSL: `rm -rf node_modules && npm install`
- PowerShell: `Remove-Item node_modules -Recurse -Force; npm install`

## Live Analysis Trace

The analyzing screen prefers real-time push over polling.

- If `VITE_PROGRESS_WS_URL` is set, the client opens a WebSocket and sends `{ "action": "subscribeProgress", "session_id": "..." }`.
- If the socket is unavailable or closes, the client falls back to `GET /progress?session_id=...`.
- The socket expects an API Gateway route named `subscribeProgress`.

## AWS WebSocket Notes

To enable true server-driven progress updates in production:

- Configure an API Gateway WebSocket API with route selection expression `$request.body.action`.
- Add routes for `$connect`, `$disconnect`, `subscribeProgress`, and optional `ping`.
- Point those routes at the backend Lambda that serves `orchestrator.py`.
- Set `WEBSOCKET_CALLBACK_URL` in Lambda if you want the backend to post updates without deriving the callback URL from the socket event.

If the WebSocket API is not deployed yet, the app still works through polling.
