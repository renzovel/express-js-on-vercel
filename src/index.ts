import express, { Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FB_PROJECT_ID,
      clientEmail: process.env.FB_CLIENT_EMAIL,
      privateKey: process.env.FB_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const app = express()
app.use(express.json());

// ⚠️ En producción usa base de datos
const tokens: string[] = [];

// Registrar token
app.post("/register", async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };

  if (!token) {
    return res.status(400).json({ error: "Token requerido" });
  }

  try {
    await admin.messaging().subscribeToTopic(token, "global");

    return res.json({ success: true, token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error suscribiendo al topic" });
  }
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
    const response = await admin.messaging().send({
      notification: {
        title,
        body,
      },
      topic: "global",
    });

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
