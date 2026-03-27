require("dotenv").config();

const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v25.0";
const AUTO_REPLY_MESSAGE =
  process.env.AUTO_REPLY_MESSAGE || "Obrigado pelo comentario!";
const COMMENT_DEDUP_TTL_MS = Number(
  process.env.COMMENT_DEDUP_TTL_MS || 1000 * 60 * 60 * 24
);
const processedComments = new Map();

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "instagram-integration-webhook"
  });
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode !== "subscribe") {
    return res.status(400).json({ error: "hub.mode invalido" });
  }

  if (!META_VERIFY_TOKEN) {
    return res
      .status(500)
      .json({ error: "META_VERIFY_TOKEN nao configurado no ambiente" });
  }

  if (token !== META_VERIFY_TOKEN) {
    return res.status(403).json({ error: "Token de verificacao invalido" });
  }

  return res.status(200).send(challenge);
});

app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object !== "instagram") {
    return res.status(404).json({ error: "Evento nao suportado" });
  }

  try {
    const commentIds = extractCommentIds(body);

    if (commentIds.length === 0) {
      console.log(
        "Webhook recebido sem comentario respondavel. Payload:",
        JSON.stringify(body)
      );
      return res.status(200).json({
        ok: true,
        processed: 0,
        message: "Nenhum comentario encontrado para responder"
      });
    }

    const results = [];

    for (const commentId of commentIds) {
      if (hasRecentlyProcessedComment(commentId)) {
        console.log(
          `Comentario ${commentId} ignorado porque ja foi respondido recentemente.`
        );
        continue;
      }

      const replyResult = await replyToComment(commentId, AUTO_REPLY_MESSAGE);
      markCommentAsProcessed(commentId);
      results.push(replyResult);
    }

    return res.status(200).json({
      ok: true,
      processed: results.length,
      results
    });
  } catch (error) {
    console.error("Erro ao processar webhook:", error);
    return res.status(500).json({
      error: "Falha ao processar webhook",
      details: error.message
    });
  }
});

function extractCommentIds(payload) {
  const ids = [];

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (!shouldReplyToCommentChange(entry, change)) {
        continue;
      }

      const commentId = change.value?.id || change.value?.comment_id;

      if (commentId) {
        ids.push(commentId);
      }
    }
  }

  return [...new Set(ids)];
}

function shouldReplyToCommentChange(entry, change) {
  if (change.field !== "comments") {
    return false;
  }

  const comment = change.value || {};
  const commentId = comment.id || comment.comment_id;
  const authorId = comment.from?.id;
  const instagramAccountId = entry?.id;

  if (!commentId) {
    return false;
  }

  if (comment.parent_id) {
    console.log(
      `Comentario ${commentId} ignorado porque ja e uma resposta a outro comentario.`
    );
    return false;
  }

  if (
    authorId &&
    instagramAccountId &&
    String(authorId) === String(instagramAccountId)
  ) {
    console.log(
      `Comentario ${commentId} ignorado porque foi criado pela propria conta do Instagram.`
    );
    return false;
  }

  return true;
}

function hasRecentlyProcessedComment(commentId) {
  cleanupProcessedComments();

  const processedAt = processedComments.get(commentId);

  if (!processedAt) {
    return false;
  }

  return Date.now() - processedAt < COMMENT_DEDUP_TTL_MS;
}

function markCommentAsProcessed(commentId) {
  cleanupProcessedComments();
  processedComments.set(commentId, Date.now());
}

function cleanupProcessedComments() {
  const now = Date.now();

  for (const [commentId, processedAt] of processedComments.entries()) {
    if (now - processedAt >= COMMENT_DEDUP_TTL_MS) {
      processedComments.delete(commentId);
    }
  }
}

async function replyToComment(commentId, message) {
  if (!META_ACCESS_TOKEN) {
    throw new Error("META_ACCESS_TOKEN nao configurado no ambiente");
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${commentId}/replies?access_token=${encodeURIComponent(
    META_ACCESS_TOKEN
  )}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Meta Graph API retornou ${response.status}: ${JSON.stringify(data)}`
    );
  }

  console.log(`Resposta enviada para o comentario ${commentId}:`, data);

  return {
    commentId,
    metaResponse: data
  };
}

app.listen(PORT, () => {
  console.log(`Servidor escutando na porta ${PORT}`);
});
