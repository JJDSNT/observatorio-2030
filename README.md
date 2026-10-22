# Observatório 2030

Uma previsão viva sobre os principais vetores tecnológicos, científicos, econômicos e espaciais entre 2026 e 2030.

## O que é

O Observatório 2030 acompanha apenas acontecimentos capazes de **confirmar, antecipar, atrasar ou contradizer** a timeline-base.

### Radar

O radar de monitoramento é definido exclusivamente em [`data/topics.json`](data/topics.json). A lista de tópicos e os respectivos critérios de acompanhamento são carregados pela página `#topicos` automaticamente, sem IDs fixos no JavaScript. O monitoramento interativo pode consultar esse cadastro antes da pesquisa, incluindo tópicos novos, e comparar as descobertas com `data/timeline.json`. A tarefa agendada do ChatGPT mantém uma cópia explícita dos tópicos e critérios no próprio prompt, pois a leitura pública do GitHub falhou no ambiente agendado; alterações exigem sincronização manual da tarefa. O arquivo `data/events.json` registra somente acontecimentos substanciais com fontes e avaliação de maturidade.

Cada tópico possui `id`, `name`, `watch` e `group`. Os grupos visuais são declarados em `groups` no mesmo JSON; tópicos com grupo desconhecido aparecem em «Outros tópicos», sem desaparecer da interface. Adicionar um tópico ao site exige apenas editar `data/topics.json`; não é necessário alterar `app.js`. Para incluí-lo também no monitoramento agendado, atualizar o prompt da automação.

A configuração de qualquer monitoramento externo/recorrente deve usar este arquivo como referência para sincronização; o site estático, por si só, não executa buscas nem atualiza automaticamente prompts de tarefas agendadas.

## Estrutura de dados

- `data/timeline.json` — previsão-base e suas revisões.
- `data/events.json` — marcos observados e seu impacto.
- `data/topics.json` — domínios acompanhados.

O site é deliberadamente estático e orientado a dados: novas observações podem ser publicadas atualizando os JSONs, sem depender de um framework ou processo de build.

## Aplicativo e alertas

O site também funciona como PWA instalável, com leitura offline e alertas opt-in para novos marcos. O frontend é publicado pelo GitHub Pages e registra as inscrições push no Worker `observatorio-2030-push`.

- Aplicativo: <https://jjdsnt.github.io/observatorio-2030/>
- Backend push: <https://observatorio-2030-push.jaimejosediasnt.workers.dev>
- Ativação: use **Ativar alertas de novos marcos** no cabeçalho e permita notificações no navegador.
- Desativação: o mesmo controle remove a inscrição do navegador e do backend.

Os valores privados ficam exclusivamente nos secrets da Cloudflare e do GitHub; a chave VAPID pública permanece no `push/wrangler.toml`.

## Metodologia

Notícias incrementais, rumores e marketing não entram no histórico. Um evento deve possuir evidência suficientemente robusta e alterar materialmente a leitura de pelo menos um item da timeline.

Início do registro: **2 de outubro de 2026**.
