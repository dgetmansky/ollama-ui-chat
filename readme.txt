Ниже моё последнее сообщение и добавленные заметки по Ollama.

Рекомендации по UI под твой кейс:

Что тебе уже нужно
1. выбор модели из `/api/tags`
2. чат
3. под чатом весь raw/stat JSON от API
4. история сообщений
5. переключатель `stream on/off`

Что ещё я бы добавил
6. кнопка “Refresh models”
   чтобы перечитывать список моделей без перезапуска

7. переключатель endpoint: `/api/chat` vs `/api/generate`
   иногда полезно сравнить поведение

8. отдельный блок “Last request payload”
   чтобы видеть, что реально ушло в API

9. отдельный блок “Last response raw JSON”
   не только статистика, а вообще весь ответ целиком

10. кнопку “Copy stats” / “Copy raw JSON”
   удобно для сравнения моделей

11. поля options:
   - `num_predict`
   - `temperature`
   - возможно `top_p`
   - возможно `seed`

12. счётчик времени на клиенте
   wall-clock от отправки до конца ответа, рядом с серверными duration

13. кнопку Stop / Abort для stream
   если модель подвисла или ушла думать

14. переключатель “show thinking/raw chunks”
   если reasoning-модель шлёт длинные traces

15. сохранение истории в localStorage
   чтобы не терять чат при обновлении страницы

16. preset-профили
   например:
   - Fast
   - Balanced
   - Concise
   которые просто подставляют `num_predict` и `temperature`

17. табличку derived metrics
   считать и показывать:
   - tokens/sec по prompt
   - tokens/sec по eval
   - total sec
   - load sec

18. кнопку “Ping /api/tags”
   чтобы быстро понять, жив ли endpoint

Моя рекомендация по минимальному v1
Я бы делал только это:
- model select
- chat area
- stream toggle
- `num_predict`
- `temperature`
- raw JSON
- pretty stats block
- refresh models
- local history

Это уже даст тебе почти всё нужное без лишнего.

Заметки по Ollama
- Внешний Ollama server используется как удалённый inference backend.
- Для HTTP API достаточно работающего `ollama serve`; `ollama run` не
нужен для самого API.
- Метрики, которые видны в `ollama run <model> --verbose`, доступны и
через HTTP API в ответах `/api/generate` и `/api/chat`.
- Полезные поля метрик API: `total_duration`, `load_duration`,
`prompt_eval_count`, `prompt_eval_duration`, `eval_count`,
`eval_duration`.
- Выбор модели в нативном Ollama API обычно делается через поле
`model` в POST-запросе.
- `ollama list` показывает модели на диске; `ollama ps` показывает
модели, загруженные в память.
- Для локального UI с удалённым Ollama можно использовать Open WebUI в
Docker и SSH tunnel.
- Готовый Docker image Open WebUI: `ghcr.io/open-webui/open-webui:main`.
- Рекомендованная команда запуска локально:
  `docker run -d --name open-webui --restart unless-stopped -p
3000:8080 --add-host=host.docker.internal:host-gateway -e
OLLAMA_BASE_URL=http://host.docker.internal:11434 -v
open-webui:/app/backend/data ghcr.io/open-webui/open-webui:main`
- Чтобы контейнер видел Ollama через SSH tunnel, tunnel должен слушать
не только `127.0.0.1`, а адрес, доступный контейнеру, например:
  `ssh -g -L 0.0.0.0:11434:127.0.0.1:11434 user@server`
- Для reasoning/thinking в интерактивном `ollama run` есть команды:
  `/set think`
  `/set nothink`
- Для скорости ответа главный параметр, найденный в доке, это `num_predict`.
- В Modelfile/API также есть полезные параметры: `temperature`,
`top_p`, `top_k`, `stop`, `seed`, `num_ctx`, `repeat_penalty`.

