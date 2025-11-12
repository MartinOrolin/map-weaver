
# Dungeon Map Weaver - Local Dev

## Quick start (development)

1. Install Node.js (LTS) and npm.
2. In project root, install client deps:
   ```bash
   npm install
   ```

3. Install server deps and start server:
   ```bash
   cd server
   npm install
   npm start
   ```
   Server listens on port 3001 and serves `/api` endpoints and `/worlds` static folders.

4. Start frontend dev server (in another terminal):
   ```bash
   npm run dev
   ```
   Vite proxies `/api` and `/socket.io` to the local server (see `vite.config.ts`).

5. Open `http://localhost:5173` (or the port printed by Vite).

## Build for production
1. Build frontend:
   ```bash
   npm run build
   ```
2. Copy `dist` folder to server root or let server serve it. The included `server/server.js` will serve `dist` if present.

## Notes
- Worlds are stored in `public/worlds/<worldId>` as folders with `maps/` and `configs/`.
- Live updates use Socket.IO. Ensure both client and server are running and the Vite proxy is configured to forward `/socket.io` to server for dev.
