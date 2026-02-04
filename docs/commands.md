# Команды проекта (шпаргалка)

## Запуск всего стека (Aspire)
- `dotnet run --project apps/apphost`
  - поднимает Postgres, сервис миграций и API
  - в Aspire Dashboard сервис `migrations` должен завершиться перед стартом API

## EF Core миграции (design-time)
- Создать миграцию:
  - `dotnet ef migrations add <Name> --project apps/api --startup-project apps/api`
- Connection string для design-time (используется только `ConnectionStrings:Default`):
  - PowerShell:
    - `$env:ConnectionStrings__Default="Host=localhost;Port=5432;Database=app_db;Username=postgres;Password=<пароль>"`
  - или user-secrets:
    - `dotnet user-secrets --project apps/api set "ConnectionStrings:Default" "Host=localhost;Port=5432;Database=app_db;Username=postgres;Password=<пароль>"`
- Применение миграций: автоматически через сервис `migrations` при запуске AppHost (ручной `dotnet ef database update` обычно не нужен).
Примечание:
- Для создания миграций AppHost запускать НЕ нужно.
- Для применения миграций AppHost запускать НУЖНО.

## API (Minimal API)
- `dotnet build`
- `dotnet test`

## Mobile Bootstrap
- Установить зависимости:
  - `cd apps/mobile`
  - `npm install`
- Запустить Metro:
  - `npx react-native start`
- Запустить Android (нужен запущенный эмулятор):
  - `npx react-native run-android`

## Mobile UI (Tamagui)
- Tamagui подключен как основной UI toolkit (Provider в `App.tsx`, конфиг в `tamagui.config.ts`).
- Команды запуска:
  - `cd apps/mobile`
  - `npm install`
  - `npx react-native start`
  - `npx react-native run-android`

## Mobile Navigation
- Подключен React Navigation (native stack), 2 экрана: Home и Trainers.
- Команды запуска:
  - `cd apps/mobile`
  - `npm install`
  - `npx react-native start`
  - `npx react-native run-android`

## Push (Android, FCM)
- В `apps/mobile/android/app` нужен `google-services.json` из Firebase Console (НЕ хранить в репозитории).
- В API задать Firebase credentials через env/secret:
  - `Push__FirebaseCredentialsPath=<path-to-service-account.json>`
  - или `Push__FirebaseCredentialsJson=<json>`
  - (опционально) `Push__FirebaseProjectId=<project-id>`
- Для локального запуска с Aspire можно задавать эти переменные в окружении перед `dotnet run --project apps/apphost`.

## OpenAPI snapshot и клиент
- Обновить `docs/openapi.json` из запущенного API:
  - `.\scripts\update-openapi.ps1 -BaseUrl https://localhost:<port>`
  - или `setx API_BASE_URL https://localhost:<port>` и затем `.\scripts\update-openapi.ps1`
- Сгенерировать TypeScript клиент (Orval):
  - `cd apps/mobile`
  - `npm run generate:api`
- `apps/mobile/src/generated` генерируется автоматически, не редактировать вручную.

## Сброс базы данных (Aspire + DataVolume)
- Остановить Aspire (`Ctrl+C`)
- Удалить volume Postgres:
  - `docker volume ls`
  - `docker volume rm <volume_name>`
- Запустить заново:
  - `dotnet run --project apps/apphost`
  - migrations применятся автоматически
