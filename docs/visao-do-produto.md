# Visão do produto

## Propósito

O Cifrô é um SaaS para bandas organizarem cifras, setlists, roteiros, ensaios e apresentações ao vivo. O contexto de trabalho é sempre uma banda selecionada, e os dados de conteúdo são isolados por banda.

## Atores

| Ator | Escopo | Capacidades principais |
|---|---|---|
| Visitante | Público | Ver landing, cadastrar conta, entrar e recuperar senha |
| Básico | Banda atual | Consultar conteúdo, seguir o Live e usar recursos de apresentação |
| Gestor | Banda atual | Capacidades do básico e edição de músicas, setlists e roteiros; pode ser host Live |
| Administrador | Banda atual | Capacidades do gestor e gestão de membros |
| Master | Global | Acesso a todas as bandas e painel global de bandas |

## Jornadas principais

1. Visitante cria conta e banda, recebe token, define senha e entra no plano gratuito.
2. Usuário seleciona uma banda e visualiza as cifras disponíveis.
3. Gestor cadastra músicas, organiza setlists e cria roteiros.
4. Host abre uma cifra no Modo Live; seguidores acompanham música e rolagem.
5. Músico usa o Modo Ensaio com áudio, loop A/B e alteração de pitch.
6. Aplicação mantém shell e dados da banda para consulta offline.
7. Administrador acompanha limites do plano e pode contratar plano pago.

## Restrições centrais

- Conteúdo pertence a uma banda e deve ser filtrado por `banda_id`.
- A banda atual e o papel do usuário ficam na sessão PHP.
- Escritas autenticadas usam token CSRF.
- O plano gratuito limita músicas a 10 e bandas administradas a 1.
- O plano gratuito permite 1 banda e até 10 músicas.
