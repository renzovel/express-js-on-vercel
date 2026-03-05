import express, { Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import admin from "firebase-admin";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from "path";

const upload = multer();

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

const s3 = new S3Client({
  region: "auto", // Required by AWS SDK, not used by R2
  // Provide your R2 endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  endpoint: "https://7b5715952bf4840de4e3254fce132177.r2.cloudflarestorage.com",
  credentials: {
    // Provide your R2 Access Key ID and Secret Access Key
    accessKeyId: "129f2a02aee73f74f85828f24210ddd3",
    secretAccessKey: "167d9cee252e7ea914a9df0226e0c4fd8f86945f00b913adbfd258b37a82f271",
  },
});

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
    const topic = await admin.messaging().subscribeToTopic(token, "global");

    console.log(`Token ${token} suscrito al topic 'global'`, topic);

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error suscribiendo al topic" });
  }
});

app.post("/upload-and-send", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File;
    const { title, body } = req.body as {
      title: string;
      body: string;
    };
    if (!title || !body) {
      return res.status(400).json({success: false, error: "Title y body requeridos" });
    }
    const key = `images/${Date.now()}-${uuidv4()}-${path.extname(file.originalname)}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: "vercel",
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    const publicUrl = `https://pub-28158015a1b84668815dbc6df48fc608.r2.dev/${key}`;
    console.log("Archivo subido a R2:", publicUrl);
    const response = await admin.messaging().send({
      notification: {
        title,
        body,
        imageUrl: publicUrl,
      },
      data: {
        title,
        body,
        imageUrl: publicUrl,
      },
      topic: "global",
    });
    console.log("Notificación enviada con imagen:", response);
    return res.json({ success: true, key , publicUrl, response });
  } catch (error) {
    console.error(error);
    return res.status(500).json({success: false, error: "Error subiendo el archivo", message: error.message.toString() });
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
