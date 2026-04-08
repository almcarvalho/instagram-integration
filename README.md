# Seja membro no youtube e garanta vídeos top como esse

<img width="1446" height="976" alt="image" src="https://github.com/user-attachments/assets/3580c1b9-40f0-4b8d-a06d-5ec0d172f790" />


https://www.youtube.com/watch?v=VZ5C0O0z_IM&t

Aplicacao Node.js com Express pronta para Heroku que:

- expone `GET /webhook` para validacao do desafio da Meta
- recebe eventos em `POST /webhook`
- responde automaticamente a comentarios do Instagram usando a Graph API da Meta

## Requisitos

- Node.js 20+
- App configurado na Meta para enviar eventos do Instagram
- URL publica do webhook

## Variaveis de ambiente

Copie `.env.example` para `.env` e preencha:

```env
PORT=3000
META_VERIFY_TOKEN=seu-token-de-validacao
META_ACCESS_TOKEN=seu-token-de-acesso-da-meta
META_GRAPH_VERSION=v25.0
AUTO_REPLY_MESSAGE=Obrigado pelo comentario! 😊
```

## Instalar

```bash
npm install
```

## Rodar localmente

```bash
npm run dev
```

## Validacao do webhook

A Meta chama o endpoint com:

```http
GET /webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=123456
```

Se `hub.verify_token` for igual a `META_VERIFY_TOKEN`, a aplicacao responde com o valor de `hub.challenge`.

## Exemplo de payload aceito

O projeto espera eventos de comentarios (`field: comments`). Quando encontrar um `commentId`, faz a chamada equivalente a:

```bash
curl -X POST "https://graph.facebook.com/v25.0/COMMENT_ID/replies?access_token=SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Obrigado pelo comentario! 😊\"}"
```

## Deploy no Heroku

```bash
heroku create
heroku config:set META_VERIFY_TOKEN=seu-token
heroku config:set META_ACCESS_TOKEN=seu-token-da-meta
heroku config:set META_GRAPH_VERSION=v25.0
heroku config:set AUTO_REPLY_MESSAGE="Obrigado pelo comentario! 😊"
git push heroku main
```

## Observacao

Esta implementacao responde automaticamente a comentarios do Instagram. Se voce quiser responder DM do Instagram, a Meta usa outro endpoint e outro formato de evento.
