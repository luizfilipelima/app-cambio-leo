/**
 * Vercel Serverless Function: cotação persistida em Vercel KV (Redis).
 * GET  /api/cotacao → retorna { rate, updatedAt } ou 404
 * POST /api/cotacao → body { rate, password }; salva no KV se senha correta
 */

import { kv } from '@vercel/kv';

const KEY = 'leo_cambios_cotacao';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const data = await kv.get(KEY);
      if (!data || typeof data.rate !== 'number') {
        return res.status(404).json({ error: 'Cotação não definida' });
      }
      return res.status(200).json({
        rate: data.rate,
        updatedAt: data.updatedAt || null,
      });
    } catch (err) {
      console.error('KV GET error:', err);
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
      await kv.set(KEY, { rate: numRate, updatedAt });

      return res.status(200).json({ rate: numRate, updatedAt });
    } catch (err) {
      console.error('KV POST error:', err);
      return res.status(500).json({ error: 'Erro ao salvar cotação' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
