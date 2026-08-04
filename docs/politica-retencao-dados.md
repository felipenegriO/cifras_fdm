# Política técnica de retenção — Cifrô

Versão técnica: 2026-08-03

| Dado | Retenção | Destino |
|---|---:|---|
| Token de ativação ou redefinição | até 7 dias após expiração/uso | exclusão definitiva |
| Sessão e rate limit | até o fim da janela configurada | exclusão automática |
| Conta ativa e associações | enquanto o serviço for utilizado | exportação disponível ao titular |
| Conta excluída | exclusão imediata dos dados pessoais | bandas sem outros membros também são excluídas |
| Aceites legais | enquanto a conta existir | exclusão em cascata com a conta |
| Logs técnicos | 30 dias | rotação e exclusão; sem conteúdo, senha, token ou IP em claro |
| Backups | 30 dias | expiração automática; restauração sujeita à reaplicação das exclusões |

O endereço IP usado como evidência de aceite é armazenado apenas como HMAC. A chave não deve ser mantida no banco.
