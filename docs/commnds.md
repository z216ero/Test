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

## API (Minimal API)
- `dotnet build`
- `dotnet test`

## Полезное
- Остановить Aspire: `Ctrl+C`