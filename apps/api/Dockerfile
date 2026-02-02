# build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# монорепа: копируем всё
COPY . .

# publish API
RUN dotnet publish apps/api/Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish ./

# Render прокидывает PORT (важно слушать его)
ENV ASPNETCORE_URLS=http://0.0.0.0:${PORT}

ENTRYPOINT ["dotnet", "Api.dll"]
