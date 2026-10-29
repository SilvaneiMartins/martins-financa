# Como contribuir

Obrigado por ajudar a deixar o Martins Finança melhor para as famílias brasileiras!

## Fluxo

1. Abra uma *issue* descrevendo o problema ou a ideia (use os modelos).
2. Faça um fork e crie sua branch a partir de `develop` (`feat/importar-fatura-pdf`, `fix/fatura-fechamento`).
3. Rode `pnpm typecheck`, `pnpm test` e `cargo test` (em `apps/desktop/src-tauri/`) antes do PR.
4. Abra o PR para a branch `develop` explicando o que mudou e como testar. Prints de tela ajudam muito.

> Branches: `develop` recebe o trabalho do dia a dia; `main` é protegida e só recebe PRs vindos de `develop` quando uma versão vai ser publicada.

## Regras do projeto

- **Dinheiro sempre em centavos (inteiros)**. Use `toCents` / `brl` de `apps/desktop/src/lib/format.ts`.
- **SQL sempre parametrizado** (`?`). Nunca concatene valores digitados pelo usuário.
- **Mudança no banco = nova migração** no fim de `apps/desktop/src-tauri/src/migrations.rs`. Nunca altere uma migração publicada.
- Regras de negócio ficam em `apps/desktop/src/lib/repo.ts` e devem ter teste em `apps/desktop/tests/`.
- Textos da interface em português do Brasil, linguagem simples.
- Nunca anexe bancos de dados ou extratos reais em issues/PRs.

## Commits

Prefira mensagens curtas no imperativo: `adiciona importação de fatura`, `corrige vencimento no fim do mês`.
