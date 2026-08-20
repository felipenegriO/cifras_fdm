# Ajuda e suporte

## Objetivo

A Central de Ajuda oferece guias de tarefas, glossário, diagnóstico do dispositivo e orientações contextuais sem interromper o fluxo principal.

## Conteúdo e pontos de entrada

- `/ajuda.php` exibe busca local, filtros junto aos resultados, retorno imediato da quantidade, dez guias e glossário.
- Botões com `data-help-article` abrem um drawer reutilizável com conteúdo obtido pela API; no celular, as ações contextuais são terciárias, têm área de toque mínima de 44 px e não ultrapassam o painel.
- Os guias críticos cobrem primeira cifra, repertório, palco offline, Live, Ensaio, integrantes, importação, permissões e privacidade.
- A página e seus assets entram no cache offline quando a funcionalidade está globalmente ativa.

## Disponibilidade

- `HELP_CENTER_ENABLED=false` desativa a funcionalidade globalmente.
- `usuarios.config.ajudaDesativada=true` desativa a funcionalidade para a conta.
- A preferência pode ser alterada em Configurações ou marcada na própria Central; o backend persiste a escolha e a sessão é atualizada.
- Quando desativada, pontos de entrada não são renderizados e página/APIs respondem `404`.
- O navegador também registra a escolha em `localStorage` para impedir a reabertura de uma cópia offline antiga.

## Segurança e privacidade

- Página e APIs exigem autenticação.
- Eventos exigem CSRF e aceitam apenas nomes conhecidos.
- A telemetria registra evento e identificador do artigo, sem texto de busca ou PII.
- O conteúdo do drawer é criado com nós DOM e `textContent`.

## Testes

- PHPUnit valida catálogo, referências, glossário, flag global e preferência.
- Playwright valida busca, toque em todos os filtros e guias no celular, drawer responsivo, API, telemetria, persistência no banco, ocultação definitiva e uso offline real.
