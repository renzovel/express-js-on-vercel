import express, { Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import admin from "firebase-admin";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const serviceAccountPath = path.join(
  __dirname,
  "../financeiro-382320-firebase-adminsdk-dqnmu-1b5429b40d.json"
);

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, "utf-8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const app = express()
app.use(express.json());

// ⚠️ En producción usa base de datos
const tokens: string[] = [];

// Registrar token
app.post("/register", (req: Request, res: Response) => {
  const { token } = req.body as { token: string };

  if (!token) {
    return res.status(400).json({ error: "Token requerido" });
  }

  if (!tokens.includes(token)) {
    tokens.push(token);
  }

  console.log("Tokens registrados:", tokens);

  return res.json({ success: true });
});

// Enviar notificación a TODOS
app.post("/send-all", async (req: Request, res: Response) => {
  const { title, body } = req.body as {
    title: string;
    body: string;
  };

  if (!title || !body) {
    return res.status(400).json({ error: "Title y body requeridos" });
  }

  if (tokens.length === 0) {
    return res.status(400).json({ error: "No hay dispositivos registrados" });
  }

  try {
    const response = await admin.messaging().sendEachForMulticast({
      notification: {
        title,
        body,
      },
      tokens,
    });

    console.log("Resultado envío:", response);

    return res.json({ success: true, response });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error enviando notificación" });
  }
});

// Health check
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
