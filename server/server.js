
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const multer = require('multer');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PROJECT_ROOT = path.join(__dirname, '..');
const WORLDS_DIR = path.join(PROJECT_ROOT, 'public', 'worlds');

app.use(express.json({ limit: "50mb" }));
app.use('/api/worlds', express.static(WORLDS_DIR));
app.use('/worlds', express.static(WORLDS_DIR));

// List worlds (folders inside public/worlds)
app.get('/api/list-worlds', async (req, res) => {
  try {
    await fs.mkdir(WORLDS_DIR, { recursive: true });
    const items = await fs.readdir(WORLDS_DIR, { withFileTypes: true });
    const folders = items.filter(d=>d.isDirectory()).map(d=>d.name);
    res.json({ worlds: folders });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get world config file (e.g., configs/world.json)
app.get('/api/world/:worldId/config/:file', async (req, res) => {
  const { worldId, file } = req.params;
  const fp = path.join(WORLDS_DIR, worldId, 'configs', file);
  try {
    const txt = await fs.readFile(fp, 'utf8');
    res.json(JSON.parse(txt));
  } catch (e) {
    res.status(404).json({ error: 'not found', detail: e.message });
  }
});

// Save config file
app.put('/api/world/:worldId/config/:file', async (req, res) => {
  const { worldId, file } = req.params;
  const dir = path.join(WORLDS_DIR, worldId, 'configs');
  await fs.mkdir(dir, { recursive: true });
  const fp = path.join(dir, file);
  try {
    await fs.writeFile(fp, JSON.stringify(req.body, null, 2), 'utf8');
    // broadcast update
    io.to(worldId).emit('world:update', { file, payload: req.body });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create world (folder)
app.post('/api/world', async (req, res) => {
  const { id, name } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  const dir = path.join(WORLDS_DIR, id);
  try {
    await fs.mkdir(path.join(dir, 'maps'), { recursive: true });
    await fs.mkdir(path.join(dir, 'configs'), { recursive: true });
    await fs.mkdir(path.join(dir, 'music'), { recursive: true });
    await fs.mkdir(path.join(dir, 'images'), { recursive: true });
    const worldMeta = { id, name: name || id, rootMapId: null };
    await fs.writeFile(path.join(dir, 'configs', 'world.json'), JSON.stringify(worldMeta, null, 2), 'utf8');
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload map or music file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { worldId } = req.params;
    let destDir;
    if (req.path.includes('upload-music')) {
      destDir = path.join(WORLDS_DIR, worldId, 'music');
    } else {
      destDir = path.join(WORLDS_DIR, worldId, 'maps');
    }
    fsSync.mkdirSync(destDir, { recursive: true });
    cb(null, destDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // allow up to 100 MB for both
});


app.post('/api/world/:worldId/upload', (req, res) => {
  upload.single('file')(req, res, function (err) {
    if (err) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large' });
      }
      return res.status(400).json({ error: 'Upload error', detail: err.message });
    }

    console.log('Headers content-type:', req.headers['content-type']);
    console.log('Body (non-file fields):', req.body);
    console.log('File object:', req.file);

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        hint: "Ensure request is multipart/form-data and the file field name is 'file'",
        contentType: req.headers['content-type'],
        body: req.body
      });
    }

    const { worldId } = req.params;
    const fileUrl = `/worlds/${worldId}/maps/${req.file.originalname}`;
    res.json({ ok: true, path: fileUrl });
  });
});

app.post("/api/world/:worldId/upload-music", upload.single("file"), async (req, res) => {
  const { worldId } = req.params;
  const destPath = `/worlds/${worldId}/music/${req.file.originalname}`;
  res.json({ ok: true, path: destPath });
});

// Delete config file (supports deleting individual map files and updates maps.json/world.json)
app.delete('/api/world/:worldId/config/:file', async (req, res) => {
  const { worldId, file } = req.params;
  const cfgDir = path.join(WORLDS_DIR, worldId, 'configs');
  const filePath = path.join(cfgDir, file);

  try {
    // remove file if exists
    if (fsSync.existsSync(filePath)) {
      await fs.unlink(filePath);
    }

    // If deleting a per-map file, update maps.json and world.json
    if (file.endsWith('.json') && !file.includes('maps.json') && !file.includes('world.json')) {
      const mapsPath = path.join(cfgDir, 'maps.json');
      let maps = [];
      if (fsSync.existsSync(mapsPath)) {
        try {
          maps = JSON.parse(await fs.readFile(mapsPath, 'utf8'));
        } catch (e) {
          maps = [];
        }
      }
      const mapId = file.replace(/\.json$/, '');
      maps = maps.filter(m => m.id !== mapId);
      await fs.writeFile(mapsPath, JSON.stringify(maps, null, 2), 'utf8');

      // update world.json metadata (updatedAt/rootMapId) if present
      const worldPath = path.join(cfgDir, 'world.json');
      if (fsSync.existsSync(worldPath)) {
        try {
          const worldObj = JSON.parse(await fs.readFile(worldPath, 'utf8'));
          if (worldObj && worldObj.rootMapId === mapId) {
            worldObj.rootMapId = maps.find(m => m.level === 0)?.id || maps[0]?.id || null;
          }
          worldObj.updatedAt = new Date().toISOString();
          await fs.writeFile(worldPath, JSON.stringify(worldObj, null, 2), 'utf8');
        } catch (e) {
          // ignore parse/write errors but log
          console.warn('Could not update world.json after map delete:', e);
        }
      }
    }

    // notify clients
    try { io.to(worldId).emit('world:update', { file, payload: null }); } catch (e) { console.warn("Emit failed", e); }

    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE config failed:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

app.post("/api/world/:worldId/upload-image", upload.single("file"), async (req, res) => {
  const { worldId } = req.params;
  
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded',
      hint: "Ensure request is multipart/form-data and the file field name is 'file'"
    });
  }
  
  // Store in images folder instead of maps
  const imagesDir = path.join(WORLDS_DIR, worldId, 'images');
  fsSync.mkdirSync(imagesDir, { recursive: true });
  
  const destPath = path.join(imagesDir, req.file.originalname);
  await fs.rename(req.file.path, destPath);
  
  const fileUrl = `/worlds/${worldId}/images/${req.file.originalname}`;
  res.json({ ok: true, path: fileUrl });
});

// Serve frontend build if exists
const clientBuild = path.join(PROJECT_ROOT, 'dist');
if (fsSync.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

io.on('connection', (socket) => {
  socket.on('join', ({ worldId }) => {
    if (worldId) socket.join(worldId);
  });
  socket.on('manage:update', ({ worldId, file, payload }) => {
    io.to(worldId).emit('world:update', { file, payload });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('Server listening on', PORT));
