'use strict';
const os = require('os');
const path = require('path');

// Los HOME aislados viven fuera de ~/.claude para que el hook.js real nunca los vea.
const TMP = process.env.RIG_TMP || path.join(os.tmpdir(), 'agent-flow-rig');
const BASE_PORT = Number(process.env.RIG_BASE_PORT || 3011);   // 3001 es la instancia viva del usuario
const WORKERS = Number(process.env.RIG_WORKERS || 6);
const RIG_DIR = path.join(os.homedir(), '.claude', 'agent-flow', 'rig');

module.exports = { TMP, BASE_PORT, WORKERS, RIG_DIR };
