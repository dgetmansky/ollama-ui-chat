# Ollama UI v1 Technical Design

## Goal

Зафиксировать техническую реализацию `v1` для одностраничного локального UI, который работает с локальным backend, проксирует запросы к Ollama API, хранит JSON-сессии в файловой системе и запускается одной пользовательской командой.

## Chosen Approach

Для `v1` принимается следующая схема:

- `frontend`: `React + Vite + TypeScript`;
- `backend`: `Express + TypeScript`;
- `runtime`: локальный запуск одной командой через `./run.sh`;
- `storage`: JSON-файлы в папке `sessions/`;
- `integration`: frontend работает только с локальным backend и не ходит в Ollama напрямую.

Эта схема выбрана как самая быстрая для разработки UI:

- `Vite` дает быстрый hot reload;
- `Express` достаточно прост для прокси и файловых операций;
- разделение frontend/backend сохраняет прозрачность API и упрощает диагностику;
- `run.sh` скрывает внутреннюю механику запуска и удовлетворяет требованию "одна команда".

## Why Not Alternatives

### Next.js

`Next.js` не дает практического преимущества для `v1`, но добавляет лишний framework-level runtime. Для локального диагностического инструмента это лишняя сложность.

### Electron

`Electron` логичен только если позже понадобится отдельный desktop package. Для `v1` это преждевременное усложнение.

### Frontend + bare Node HTTP

Голый `node:http` для backend уменьшает зависимости, но делает серверный код менее удобным для сопровождения. Экономия не окупает ухудшение читаемости.

## System Boundaries

### Frontend Responsibilities

Frontend отвечает за:

- отображение одностраничного UI;
- локальное состояние экрана;
- рендеринг списка сессий, чата и диагностических блоков;
- отображение loading, streaming и error states;
- отправку команд локальному backend;
- отображение частичного ответа во время streaming.

Frontend не отвечает за:

- прямую работу с Ollama API;
- чтение и запись `sessions/*.json`;
- вычисление derived metrics;
- нормализацию различий между `/api/chat` и `/api/generate`.

### Backend Responsibilities

Backend отвечает за:

- чтение списка сессий;
- создание, открытие, удаление и сохранение JSON-сессий;
- проксирование вызовов к Ollama API;
- унификацию поведения `/api/chat` и `/api/generate`;
- сбор `last_request`, `last_response`, `last_stats`;
- вычисление `derived_metrics`;
- остановку активного streaming-запроса;
- разделение ошибок Ollama и ошибок файлового хранилища.

Backend является единственной точкой записи в `sessions/`.

## Runtime Model

Пользователь запускает проект одной командой:

```bash
./run.sh
```

`run.sh` в `v1` делает следующее:

1. проверяет наличие установленных зависимостей;
2. создает папку `sessions/`, если ее еще нет;
3. запускает backend dev server;
4. запускает frontend Vite dev server;
5. печатает локальный URL для открытия UI.

Внутри `run.sh` разрешено использовать параллельный запуск процессов. Для пользователя это остается одной командой.

## Local Backend API

Frontend работает с локальным backend по собственному API. Он не обращается к Ollama напрямую.

### Health and Models

- `GET /backend/health`
  - возвращает состояние локального backend;
- `GET /backend/ollama/ping`
  - проверяет доступность Ollama;
- `GET /backend/ollama/models`
  - возвращает список моделей на основе `/api/tags`.

### Sessions

- `GET /backend/sessions`
  - возвращает список локальных сессий;
- `POST /backend/sessions`
  - создает новую пустую сессию;
- `GET /backend/sessions/:id`
  - возвращает полную сессию;
- `DELETE /backend/sessions/:id`
  - удаляет сессию.

### Chat Execution

- `POST /backend/sessions/:id/run`
  - запускает запрос к Ollama для выбранной сессии;
  - принимает текущий пользовательский ввод и актуальные настройки;
  - обновляет историю, диагностические данные и JSON-сессию;
- `POST /backend/requests/:requestId/abort`
  - останавливает активный streaming-запрос.

## Session File Model

Каждая сессия хранится отдельным JSON-файлом в `sessions/`.

Имя файла:

```text
YYYY-MM-DDTHH-MM-SS-<uuid>.json
```

Базовая структура `v1`:

```json
{
  "id": "2026-04-22T10-15-03-550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-04-22T10:15:03Z",
  "updated_at": "2026-04-22T10:20:11Z",
  "endpoint": "/api/chat",
  "model": "llama3.1:8b",
  "stream": true,
  "request_options": {
    "num_predict": 256,
    "temperature": 0.7
  },
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    },
    {
      "role": "assistant",
      "content": "Hi. How can I help?"
    }
  ],
  "last_request": {},
  "last_response": {},
  "last_stats": {},
  "derived_metrics": {},
  "runtime": {
    "last_request_id": null,
    "last_status": "idle"
  }
}
```

Поле `runtime` нужно для прозрачного отображения состояния последнего выполнения и связи с abort-механизмом. В `v1` оно остается минимальным.

## Request Flow

### `/api/chat`

1. frontend отправляет `POST /backend/sessions/:id/run`;
2. backend загружает сессию;
3. backend формирует массив сообщений по данным сессии и новому пользовательскому вводу;
4. backend вызывает Ollama `/api/chat`;
5. backend собирает ответ, статистику и derived metrics;
6. backend записывает обновленную сессию в файл;
7. backend возвращает унифицированный результат frontend'у.

### `/api/generate`

1. frontend отправляет `POST /backend/sessions/:id/run`;
2. backend загружает сессию;
3. backend преобразует историю сообщений в prompt;
4. backend вызывает Ollama `/api/generate`;
5. backend собирает ответ, статистику и derived metrics;
6. backend записывает обновленную сессию в файл;
7. backend возвращает унифицированный результат frontend'у.

Различия endpoint'ов остаются на backend-слое. Для frontend обе схемы максимально унифицированы.

## Streaming Model

В `v1` streaming поддерживается только через локальный backend.

Поведение:

- frontend инициирует streaming через `POST /backend/sessions/:id/run`;
- backend создает `requestId` и начинает читать поток от Ollama;
- frontend получает частичные обновления ответа;
- при `Stop` frontend вызывает `POST /backend/requests/:requestId/abort`;
- backend останавливает локальный поток, сохраняет частичный результат и завершает сессию в согласованном состоянии.

Для `v1` важнее надежность и прозрачность, чем универсальный streaming framework. Если потребуется, допустимо использовать простой механизм server-sent events или проксируемый HTTP stream, но это будет решено на уровне implementation plan.

## UI Composition

Один экран состоит из четырех зон:

- верхняя control bar;
- левая колонка sessions;
- центральная chat area;
- правая или нижняя diagnostics panel.

Приоритет пространства:

1. control bar;
2. chat area;
3. diagnostics;
4. sessions list.

Мокап, утвержденный как визуальное направление:

- `docs/mockups/ollama-ui-v1-page-mockup.png`

## Proposed Repository Structure

```text
.
├── docs/
├── sessions/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   └── styles/
│   └── index.html
├── backend/
│   └── src/
│       ├── routes/
│       ├── services/
│       ├── storage/
│       ├── ollama/
│       ├── metrics/
│       ├── types/
│       └── index.ts
├── run.sh
└── package.json
```

### Frontend Decomposition

- `app/`: корневой экран и bootstrap;
- `components/`: переиспользуемые UI-блоки;
- `features/control-bar/`: endpoint, model, stream, options;
- `features/sessions/`: список сессий;
- `features/chat/`: история сообщений, input, send, stop;
- `features/diagnostics/`: request, response, stats, metrics;
- `lib/`: клиент локального backend и мелкие утилиты.

### Backend Decomposition

- `routes/`: HTTP endpoints локального backend;
- `services/`: orchestration-логика;
- `storage/`: работа с `sessions/*.json`;
- `ollama/`: клиент и адаптеры Ollama API;
- `metrics/`: вычисление derived metrics;
- `types/`: типы сессий, запросов и ответов.

## Error Model

В `v1` нужно явно различать:

- `ollama_unreachable`;
- `ollama_request_failed`;
- `session_read_failed`;
- `session_write_failed`;
- `invalid_session_data`;
- `request_aborted`.

Frontend должен показывать эти ошибки как разные состояния, а не сводить их к одному generic message.

## First Vertical Slice

Первый implementation slice должен дать рабочий путь от запуска до первого успешного ответа:

1. `./run.sh` поднимает frontend и backend;
2. UI открывается в браузере;
3. backend умеет вернуть models list;
4. backend умеет создать новую сессию;
5. UI умеет выбрать модель и отправить сообщение;
6. backend умеет вызвать `/api/chat` в non-streaming режиме;
7. UI показывает ответ, `last_request`, `last_response`, `stats`, `derived_metrics`;
8. сессия сохраняется в `sessions/`.

Streaming, abort и `/api/generate` должны входить в `v1`, но не обязаны быть первым вертикальным срезом.

## Testing Strategy

В `v1` тестирование строится так:

- backend unit tests для session storage и derived metrics;
- backend integration tests для локальных API routes;
- frontend component tests для ключевых состояний экрана;
- ручная проверка основного сценария через реальный Ollama endpoint.

Главная цель тестов `v1` - защитить:

- согласованность JSON-сессий;
- корректность derived metrics;
- различение ошибок backend/storage;
- базовый рабочий цикл отправки запроса.

## Scope Guardrails

В этот дизайн осознанно не входят:

- SSR;
- многостраничная навигация;
- база данных;
- аккаунты;
- импорт/экспорт сессий;
- расширенный visual payload editor;
- сравнение двух ответов side-by-side;
- множественные backend'ы одновременно.

## Open Implementation Decisions

На уровне дизайна зафиксировано только одно: все должно запускаться одной пользовательской командой.

Следующие детали допускается принять уже в implementation plan, без пересмотра дизайна:

- точный способ параллельного запуска процессов внутри `run.sh`;
- точный transport для streaming между backend и frontend;
- конкретная тестовая библиотека для frontend;
- точная схема dev/prod scripts в `package.json`.
