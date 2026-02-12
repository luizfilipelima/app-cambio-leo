/**
 * Vercel Serverless Function: cotação persistida em Redis.
 * Aceita:
 *   - REDIS_URL (Redis Labs / conexão TCP, ex: redis://default:senha@host:porta)
 *   - ou KV_REST_API_* / UPSTASH_REDIS_REST_* (REST)
 * GET  /api/cotacao → retorna { rate, updatedAt } ou 404
 * POST /api/cotacao → body { rate, password }; salva no Redis se senha correta
 */

import { Redis } from '@upstash/redis';
import { createClient } from 'redis';

const KEY = 'leo_cambios_cotacao';

// --- Cliente Redis: REDIS_URL (TCP) ou Upstash (REST) ---
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
      error: 'Redis não configurado. Defina REDIS_URL ou (KV_REST_API_URL + KV_REST_API_TOKEN) ou (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) nas variáveis de ambiente.',
    });
  }

  if (req.method === 'GET') {
    try {
      const data = await redis.get(KEY);
      if (!data || typeof data.rate !== 'number') {
        return res.status(404).json({ error: 'Cotação não definida' });
      }
      return res.status(200).json({
        rate: data.rate,
        updatedAt: data.updatedAt || null,
      });
    } catch (err) {
      console.error('Redis GET error:', err);
      return res.status(500).json({ error: 'Erro ao ler cotação' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { rate, password } = body;

      const adminPass = process.env.ADMIN_PASS || process.env.VITE_ADMIN_PASS || '';
      if (!adminPass) {
        return res.status(500).json({ error: 'Configure ADMIN_PASS nas variáveis de ambiente da Vercel' });
      }
      if (password !== adminPass) {
        return res.status(401).json({ error: 'Senha incorreta' });
      }

      const numRate = parseFloat(rate);
      if (!Number.isFinite(numRate) || numRate <= 0) {
        return res.status(400).json({ error: 'Valor de cotação inválido' });
      }

      const updatedAt = new Date().toISOString();
      await redis.set(KEY, { rate: numRate, updatedAt });

      return res.status(200).json({ rate: numRate, updatedAt });
    } catch (err) {
      console.error('Redis POST error:', err);
      return res.status(500).json({ error: 'Erro ao salvar cotação' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
