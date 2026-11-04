# Liangqi · 两讫

> Contas claras, dívidas quitadas.

**Idiomas:** [简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Português** · [Русский](README.ru.md)

**Aplicativo online:** https://arksc.cn:8002/workbook/  
**Código-fonte:** [Gitee](https://gitee.com/PharaohMan/liangqi-app) · [GitHub](https://github.com/yejunhui/liangqi-app)  
**Licença:** AGPL-3.0-or-later

Liangqi é um **aplicativo web de contabilidade compartilhada local-first** que separa gastos em dinheiro de compras no crédito:

- **Gastos em dinheiro** são descontados da poupança imediatamente.
- **Compras no crédito** não mexem na poupança: contam como despesa no registo e aumentam o passivo. No pagamento, a despesa não é contada novamente; apenas poupança, passivo e ativos disponíveis diminuem.
- O **pagamento da dívida** move ativos para passivos; a despesa já foi reconhecida na compra.

Os dados ficam no navegador por padrão. Você pode ter vários livros e conectar um repositório GitHub, Gitee ou WebDAV para compartilhar um livro entre várias pessoas.

![Painel do Liangqi](docs/screenshots/dashboard.png)

## Como funciona

| Ação | Ativos / poupança | Passivos | Despesa |
| --- | ---: | ---: | ---: |
| Compra em dinheiro | −100 | 0 | +100 |
| Compra no crédito | 0 | +100 | +100 |
| Pagamento da dívida | −100 | −100 | 0 |
| Empréstimo recebido | +100 | +100 | 0 |

- Uma compra no crédito conta como despesa no registo e aumenta o passivo; não mexe na poupança, por isso **os ativos disponíveis não mudam**.
- O pagamento não conta a despesa novamente; apenas reduz os ativos disponíveis.
- Patrimônio líquido = ativos − passivos. A compra no crédito reduz o patrimônio ao aumentar o passivo; o pagamento não altera.

## Principais recursos

- **Vários livros**: família, viagem, negócio etc., com troca rápida.
- **Contas de ativo e passivo**: dinheiro, banco, cartão de crédito, Huabei, empréstimos e saldo inicial.
- **Faturas**: nome, categoria, vencimento, pagamento parcial e status.
- **Pagamentos**: pague a partir de uma conta de ativo e reduza passivo e poupança; a despesa já foi contada na compra.
- **Membros**: vincule faturas e lançamentos aos membros da família; livros compartilhados com login por membro.
- **Tags e categorias de dois níveis**: contexto, finalidade e pessoa; categorias pai/filho.
- **Orçamentos e lançamentos recorrentes**: mensais ou anuais, por categoria, tag ou membro.
- **Importação CSV**: WeChat, Alipay e bancos, com detecção automática de colunas.
- **Multimoeda e anexos**: câmbio, valor original e arquivos de até 10 MB.
- **Análises e relatórios**: evolução, categorias, tags, membros, tendência de 6 meses, CSV e PDF.
- **Assistente de IA**: com uma API compatível com OpenAI, analisa o livro e sugere orçamentos.
- **PWA e offline**: instale no desktop ou celular e abra a interface offline.
- **10 idiomas**: chinês simplificado e tradicional, inglês, japonês, coreano, espanhol, francês, alemão, português e russo.

## Início rápido

Use o aplicativo online ou execute localmente:

```bash
pnpm install
pnpm dev
```

Build:

```bash
pnpm build:workbook
```

O guia detalhado de implantação está em [docs/deployment.md](docs/deployment.md) (em chinês).

## Dados e privacidade

- O livro fica no **IndexedDB** do navegador, com `localStorage` como reserva.
- Com um repositório remoto, os dados ficam no seu GitHub / Gitee ou WebDAV. O Liangqi não tem servidor de dados.
- As senhas dos membros são armazenadas apenas como **hash PBKDF2**, nunca em texto puro.
- Tokens e chaves de API de IA ficam no `localStorage` do dispositivo e não passam pelos servidores do Liangqi.
- Limpar os dados do navegador apaga o livro local. Exporte backups regularmente.

## Apoiar o projeto

Se o Liangqi for útil, você pode apoiar o desenvolvimento com Alipay ou WeChat:

| Alipay | WeChat |
| --- | --- |
| <img src="public/support/alipay-qr.jpg" alt="QR do Alipay" width="200" /> | <img src="public/support/wechat-qr.jpg" alt="QR do WeChat" width="200" /> |

## Licença

Publicado sob a **GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)**. Veja [LICENSE](LICENSE) para o texto completo.

- Você pode usar, modificar e redistribuir o programa.
- Ao distribuir uma versão modificada, forneça o código-fonte correspondente e o texto da licença.
- Se modificar o programa e disponibilizá-lo pela rede, a seção 13 da AGPL exige oferecer aos usuários o código-fonte correspondente.
- Versões anteriores foram publicadas sob GPL-3.0-or-later. Essas permissões continuam válidas.

Consulte [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) para licenças de terceiros.

## Aviso

O Liangqi é uma ferramenta de contabilidade, não aconselhamento financeiro, fiscal ou de investimento. Exporte um backup antes de usar. Os autores não se responsabilizam por perda de dados, erros de cálculo ou danos decorrentes do uso do software.
