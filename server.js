const express = require('express');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'postgres.heredia.ar',
  port: 7777,
  user: 'supostgres',
  password: 'd0pam1na',
  database: 'app',
});

const app = express();
app.use(express.json());

async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS storage (
    table_name TEXT PRIMARY KEY,
    data JSONB
  );`);
}

ensureTable().catch((err) => console.error('Error creating table', err));

app.post('/select', async (req, res) => {
  const { table } = req.body;
  try {
    const result = await pool.query('SELECT data FROM storage WHERE table_name = $1', [table]);
    if (result.rows.length === 0) {
      return res.json(null);
    }
    res.json(result.rows[0].data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.post('/update', async (req, res) => {
  const { table, data } = req.body;
  try {
    await pool.query(
      `INSERT INTO storage (table_name, data) VALUES ($1, $2)
       ON CONFLICT (table_name) DO UPDATE SET data = EXCLUDED.data`,
      [table, data]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

app.post('/clearTable', async (req, res) => {
  const { table } = req.body;
  try {
    await pool.query('DELETE FROM storage WHERE table_name = $1', [table]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Clear failed' });
  }
});

app.post('/clearAllData', async (_req, res) => {
  try {
    await pool.query('DELETE FROM storage');
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Clear all failed' });
  }
});

app.post('/factoryReset', async (_req, res) => {
  try {
    await pool.query('DROP TABLE IF EXISTS storage');
    await ensureTable();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Factory reset failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`DB server running on port ${PORT}`);
});
