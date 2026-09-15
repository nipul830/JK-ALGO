# JK Algo Hub Backend

Secure server-side broker gateway for JK Algo Hub.

## Purpose
- Keep Delta API secrets off the public frontend.
- Sign authenticated Delta Exchange requests server-side.
- Provide a single broker adapter interface for Paper/Testnet/Live.
- WebSocket/REST synchronization belongs here.

## Environment
Copy .env.example to .env and set credentials only on the server.

This repository does not contain real API keys or secrets.
