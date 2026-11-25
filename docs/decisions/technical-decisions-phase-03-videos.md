---
scope_type: phase
related_phases: [3]
status: decided
date: 2026-11-24
scope_description: "Upload direto de até 10GB, armazenamento S3/MinIO, fila Redis/BullMQ, worker FFmpeg/ffprobe separado, streaming por Range, download e URL única de vídeos vinculados ao canal."
---

# Technical Decisions — Phase 03: Upload e Processamento de Vídeos

_Subprojects in scope:_

- `nestjs-project/` — API de upload/processamento, entidade Video, MinIO/S3, Redis/BullMQ, worker separado e endpoints de streaming/download.

## TD-01: Fila de processamento

**Scope:** Backend

**Capability:** Serviço de processamento em segundo plano (filas)

**Context:** O upload precisa iniciar processamento sem bloquear a API. A fila precisa suportar retries, concorrência limitada, recuperação de jobs abandonados e execução distribuída.

**Options:**

### Option A: BullMQ com Redis
- Queue nativa para TypeScript/NestJS, retries com backoff, stalled jobs, concorrência e eventos.
- **Pros:** Integração madura com NestJS, worker distribuível, operação simples em Docker, menor alteração no modelo de dados.
- **Cons:** Redis adicional em produção; requer idempotência e lock para evitar processamento duplicado.

### Option B: Postgres como fila
- BullMQ em backend PostgreSQL ou pg-boss.
- **Pros:** Reutiliza PostgreSQL e reduz infraestrutura.
- **Cons:** Menos alinhado ao padrão Nest/BullMQ, mais carga no banco transacional e concorrência menos natural.

### Option C: RabbitMQ
- Broker AMQP com DLX e ack/nack.
- **Pros:** Semântica robusta de mensageria distribuída.
- **Cons:** Integração e operação mais pesadas para o volume inicial do projeto.

**Recommendation:** Option A — BullMQ com Redis é o melhor equilíbrio entre integração NestJS, capacidade de retry e infraestrutura Docker simples.

**Decision:** A (BullMQ com Redis)

**Libraries:** `bullmq@^5.x`, `@nestjs/bullmq@^11.x`, `ioredis@^5.x`

---

## TD-02: Estratégia de upload

**Scope:** Backend

**Capability:** Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance

**Context:** O upload passa pelo objeto e não pela API, mas a API precisa pré-cadastrar o vídeo e verificar a conclusão antes de publicar o job.

**Options:**

### Option A: URL S3 pré-assinada PUT
- API cria rascunho e retorna uma PUT URL curta, com chave privada derivada do UUID do vídeo e limite de 10GB.
- **Pros:** Dados nunca passam pela API, suporte nativo a objetos grandes e troca direta para S3 AWS.
- **Cons:** Necessita confirmação explícita da conclusão e limites por política/cliente.

### Option B: Multipart upload via proxy da API
- API recebe partes e coordena upload no S3.
- **Pros:** Controle centralizado e webhooks simples.
- **Cons:** Trava recursos da API e torna o proxy um ponto de fragilidade para arquivos grandes.

### Option C: tus resumable protocol
- Servidor tus recebe chunks e retoma uploads.
- **Pros:** Retomada robusta e observabilidade de partes.
- **Cons:** Dependência adicional e protocolo mais complexo que o requisito imediato.

**Recommendation:** Option A — URL preassinada PUT evita o proxy da API e usa a mesma API S3 em MinIO/S3.

**Decision:** A (S3 presigned PUT)

**Libraries:** `@aws-sdk/client-s3@^3.x`, `@aws-sdk/s3-request-presigner@^3.x`

---

## TD-03: Processamento e thumbnail

**Scope:** Backend

**Capability:** Processamento automático do vídeo após upload (extração de duração e metadados); Geração automática de thumbnail a partir de um frame do vídeo

**Context:** FFmpeg e ffprobe precisam operar em um objeto do storage sem manter o vídeo inteiro na API.

**Options:**

### Option A: Worker container separado com FFmpeg/ffprobe
- Worker baixa temporariamente o objeto para disco local, executa ffprobe/ffmpeg e envia thumbnail/metadados de volta.
- **Pros:** Independente da API, escalável, usa ferramentas maduras e mantém processamento pesado fora da API.
- **Cons:** Requer espaço temporário e limpeza garantida de arquivos temporários.

### Option B: Processamento in-process na API
- API executa FFmpeg a partir de um handler HTTP/job.
- **Pros:** Menor implantação inicial.
- **Cons:** Bloqueia capacidade da API e viola a separação assíncrona necessária.

**Recommendation:** Option A — container worker dedicado com imagem que contenha FFmpeg/ffprobe.

**Decision:** A (worker dedicado com FFmpeg/ffprobe)

**Libraries:** `FFmpeg 7.x`/`ffprobe 7.x` via imagem Debian Alpine, sem wrapper npm obrigatório

---

## TD-04: Streaming e download

**Scope:** Backend

**Capability:** Reprodução via streaming; Download do vídeo pelo usuário

**Context:** Vídeos prontos devem ser reproduzidos por HTTP sem exigir o arquivo completo, com suporte a Range.

**Options:**

### Option A: Proxy HTTP da API com Range 206
- API resolve o objeto e retorna chunks por stream, processando `Range` e `Content-Range`.
- **Pros:** Controle de autorização e implementação independente do cliente; funciona em produção atrás de S3 via proxy até migrar para CDN.
- **Cons:** Consome banda da API e proxya bytes.

### Option B: URL S3 pré-assinada GET
- API entrega URL curta para streaming/download direto.
- **Pros:** Menor carga no servidor e melhor banda.
- **Cons:** CORS/headers dependem do storage e Range é delegado ao cliente; autorização depende da URL curta.

**Recommendation:** Option A para o MVP local/privado com S3, podendo migrar para GET URLs assinadas em produção.

**Decision:** A (streaming via API com Range; download via cabeçalho attachment)

**Libraries:** —

---

## TD-05: URL única e chave de storage

**Scope:** Backend

**Capability:** URL única por vídeo, sem conflito com outros vídeos

**Context:** A URL pública deve ser estável e não colidir entre canais/vídeos.

**Options:**

### Option A: UUID v4 persistido como slug
- `slug = crypto.randomUUID()` com índice único e rota `/videos/:slug/stream`.
- **Pros:** Sem conflito prático, não expõe o UUID numérico interno e é fácil de validar.
- **Cons:** Slug não legível e não responde busca por título.

### Option B: UUID v7 ou slug baseado em título
- Mais legível ou ordenável, mas exige normalização e retenção de unicidade.
- **Pros:** Melhor URL legível.
- **Cons:** Colisão e normalização requerem nova complexidade não necessária nesta fase.

**Recommendation:** Option A — UUID v4 exclusivo persistido no vídeo e usado em todas as rotas públicas.

**Decision:** A (UUID v4 único)

**Libraries:** —

---

## TD-06: Ciclo de status e falha

**Scope:** Backend

**Capability:** Pré-cadastro automático do vídeo como rascunho; Processamento automático do vídeo após upload

**Context:** O estado deve representar a transição segura do upload ao resultado processado e permitir diagnóstico.

**Options:**

### Option A: Máquina de estados com draft → processing → ready/error
- Confirmar upload move o vídeo a `processing`; worker usa transições idempotentes e persiste `processing_error` no terminal `error`.
- **Pros:** Estado observável, simples de testar e compatível com o plano original.
- **Cons:** Requer proteção contra transições obsoletas e jobs duplicados.

### Option B: Estados baseados em flags independentes
- upload_complete, processing_complete, etc.
- **Pros:** Mais granular.
- **Cons:** Combinações inválidas e ambiguidades aumentam a complexidade sem necessidade.

**Recommendation:** Option A — estados explícitos e transições centralizadas no serviço de vídeos.

**Decision:** A (draft → processing → ready/error)

**Libraries:** —

---
