/**
 * Vercel Serverless Function: cotações PYG e USD persistidas em Redis.
 * GET  /api/cotacao → retorna { pyg, usd, updatedAtPyg, updatedAtUsd }
 * POST /api/cotacao → body { pyg?, usd?, password }; atualiza um ou ambos
 */

import { Redis } from '@upstash/redis';
import { createClient } from 'redis';

const KEY_PYG = 'leo_cambios_cotacao_pyg';
const KEY_USD = 'leo_cambios_cotacao_usd';

let nodeRedisClient = null;

async function getRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    if (!nodeRedisClient) {
      nodeRedisClient = createClient({ url: redisUrl });
      nodeRedisClient.on('error', (err) => console.error('Redis Client Error', err));
      await nodeRedisClient.connect();
    }
    return {
      get: async (k) => {
        const raw = await nodeRedisClient.get(k);
        return raw ? JSON.parse(raw) : null;
      },
      set: async (k, v) => {
        await nodeRedisClient.set(k, JSON.stringify(v));
      },
    };
  }

  const restUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (restUrl && restToken) {
    const upstash = new Redis({ url: restUrl, token: restToken });
    return {
      get: (k) => upstash.get(k),
      set: (k, v) => upstash.set(k, v),
    };
  }

  return null;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const redis = await getRedis();
  if (!redis) {
    return res.status(500).json({
      error: 'Redis não configurado. Defina REDIS_URL ou variáveis Upstash/KV.',
    });
  }

  if (req.method === 'GET') {
    try {
      const [dataPyg, dataUsd] = await Promise.all([redis.get(KEY_PYG), redis.get(KEY_USD)]);
      const pyg = dataPyg && typeof dataPyg.rate === 'number' ? dataPyg.rate : null;
      const usd = dataUsd && typeof dataUsd.rate === 'number' ? dataUsd.rate : null;
      return res.status(200).json({
        pyg,
        usd,
        updatedAtPyg: dataPyg?.updatedAt || null,
        updatedAtUsd: dataUsd?.updatedAt || null,
      });
    } catch (err) {
      console.error('Redis GET error:', err);
      return res.status(500).json({ error: 'Erro ao ler cotação' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { pyg, usd, password } = body;

      const adminPass = process.env.ADMIN_PASS || process.env.VITE_ADMIN_PASS || '';
      if (!adminPass) {
        return res.status(500).json({ error: 'Configure ADMIN_PASS nas variáveis de ambiente.' });
      }
      if (password !== adminPass) {
        return res.status(401).json({ error: 'Senha incorreta' });
      }

      const now = new Date().toISOString();
      const updates = {};

      if (typeof pyg === 'number' || (pyg != null && pyg !== '')) {
        const numPyg = parseFloat(pyg);
        if (Number.isFinite(numPyg) && numPyg > 0) {
          await redis.set(KEY_PYG, { rate: numPyg, updatedAt: now });
          updates.pyg = numPyg;
          updates.updatedAtPyg = now;
        }
      }
      if (typeof usd === 'number' || (usd != null && usd !== '')) {
        const numUsd = parseFloat(usd);
        if (Number.isFinite(numUsd) && numUsd > 0) {
          await redis.set(KEY_USD, { rate: numUsd, updatedAt: now });
          updates.usd = numUsd;
          updates.updatedAtUsd = now;
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Envie pyg e/ou usd com valor válido.' });
      }

      const [dataPyg, dataUsd] = await Promise.all([redis.get(KEY_PYG), redis.get(KEY_USD)]);
      return res.status(200).json({
        pyg: dataPyg?.rate ?? updates.pyg ?? null,
        usd: dataUsd?.rate ?? updates.usd ?? null,
        updatedAtPyg: dataPyg?.updatedAt ?? updates.updatedAtPyg ?? null,
        updatedAtUsd: dataUsd?.updatedAt ?? updates.updatedAtUsd ?? null,
      });
    } catch (err) {
      console.error('Redis POST error:', err);
      return res.status(500).json({ error: 'Erro ao salvar cotação' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
