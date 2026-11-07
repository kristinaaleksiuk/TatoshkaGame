import express from 'express';
import sql from 'mssql/msnodesqlv8.js';

// Подключение через вашу учётную запись Windows: логин и пароль не нужны.
const SERVER = process.env.DB_SERVER || 'KRISTISHKINS\\SQLEXPRESS';
const DATABASE = process.env.DB_NAME || 'TatoskaFrends';
const DRIVER = process.env.DB_DRIVER || 'ODBC Driver 18 for SQL Server';

const pool = await new sql.ConnectionPool({
  connectionString:
    `Driver={${DRIVER}};Server=${SERVER};Database=${DATABASE};` +
    'Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;'
}).connect();

const app = express();
app.use(express.json({ limit: '2kb' }));
app.use(express.static('public'));

app.get('/api/leaderboard', async (req, res) => {
  try {
    const r = await pool.request().query(
      'SELECT TOP 100 Pid AS pid, Name AS name, Tries AS tries FROM dbo.Results ORDER BY Tries ASC, UpdatedAt ASC'
    );
    res.json(r.recordset);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'db' });
  }
});

app.post('/api/result', async (req, res) => {
  const { pid, name, tries } = req.body || {};
  if (typeof pid !== 'string' || pid.length < 1 || pid.length > 64 ||
      !Number.isInteger(tries) || tries < 1 || tries > 144) {
    return res.status(400).json({ error: 'bad input' });
  }
  const safeName = String(name || 'Игрок').trim().slice(0, 16) || 'Игрок';
  try {
    // у игрока хранится лучший (минимальный) результат
    await pool.request()
      .input('Pid', sql.NVarChar(64), pid)
      .input('Name', sql.NVarChar(16), safeName)
      .input('Tries', sql.Int, tries)
      .query(`
        UPDATE dbo.Results
        SET Name = @Name,
            UpdatedAt = CASE WHEN @Tries < Tries THEN SYSUTCDATETIME() ELSE UpdatedAt END,
            Tries = CASE WHEN @Tries < Tries THEN @Tries ELSE Tries END
        WHERE Pid = @Pid;
        IF @@ROWCOUNT = 0
          INSERT INTO dbo.Results (Pid, Name, Tries, UpdatedAt)
          VALUES (@Pid, @Name, @Tries, SYSUTCDATETIME());
      `);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'db' });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log('Игра: http://localhost:' + port));
