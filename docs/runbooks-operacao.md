# Runbooks operacionais — Cifrô

## Metas

- RPO: 24 horas.
- RTO: 4 horas.
- Retenção de backup: 30 dias.
- `/health`: processo PHP disponível, sem consultar dependências.
- `/ready`: aplicação e banco disponíveis.

## Banco indisponível

1. Confirmar `/health` 200 e `/ready` 503.
2. Localizar o `request_id` no log estruturado.
3. Verificar DNS, credenciais, limite de conexões e disponibilidade do MySQL.
4. Não executar migrações ou restaurações diretamente no banco principal durante o diagnóstico.
5. Após recuperar, validar login, sync e uma leitura por banda.

## Restauração

1. Selecionar o backup criptografado mais recente e conferir data/tamanho.
2. Executar `restore_database.php --file=<arquivo> --target-db=cifro_restore_<id>`.
3. Apontar uma instância isolada para o banco restaurado.
4. Validar contagens, autenticação, bandas, músicas, repertórios e aceites legais.
5. Registrar duração e evidência. Nunca restaurar diretamente sobre o banco principal.

## SMTP indisponível

1. Confirmar eventos `email.sent` ausentes e erros pelo `request_id`.
2. Validar host, porta, TLS e credenciais sem registrá-las em logs.
3. Manter mensagens públicas neutras para não enumerar contas.
4. Reenviar convites e recuperações somente após normalização.

## Stripe

1. Validar assinatura e horário do webhook no painel Stripe.
2. Localizar `stripe.webhook_received` pelo tipo do evento.
3. Reprocessar o evento pelo painel somente após confirmar idempotência.
4. Conferir plano e `stripe_subscription_id` da banda afetada.

## Sync e Live

1. Localizar `sync.data_requested` ou `live.update_requested` pelo `request_id`.
2. Confirmar banda anonimizada, latência e status HTTP.
3. Verificar `content_revision` e conflito 409 antes de qualquer correção manual.
4. Em indisponibilidade, preservar snapshots locais e impedir sobrescrita do servidor.

## Incidente de segurança

1. Restringir acesso, preservar logs e abrir linha do tempo.
2. Rotacionar somente os segredos potencialmente expostos.
3. Invalidar sessões e tokens afetados.
4. Avaliar impacto por banda sem expor dados pessoais em canais de incidente.
5. Acionar responsáveis legais quando aplicável.

## Rollback

1. Suspender deploys e identificar a última versão saudável.
2. Fazer backup antes do rollback.
3. Reverter aplicação; banco só pode ser revertido por migração compensatória testada.
4. Validar `/health`, `/ready`, login, sync, edição e Live.
5. Monitorar erros e latência por 30 minutos.

## Teste de alertas

1. Usar ambiente isolado.
2. Configurar `APP_URL`, `BACKUP_TARGET_DIR` e `ALERT_WEBHOOK_URL` de teste.
3. Simular readiness indisponível e backup com mais de 25 horas.
4. Executar `monitor.php` e confirmar saída diferente de zero e recebimento do alerta.
5. Restaurar dependências e confirmar execução com saída zero.
