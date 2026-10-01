FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY backend/VisorDatosSig.Api/VisorDatosSig.Api.csproj backend/VisorDatosSig.Api/
RUN dotnet restore backend/VisorDatosSig.Api/VisorDatosSig.Api.csproj

COPY backend/VisorDatosSig.Api/ backend/VisorDatosSig.Api/
RUN dotnet publish backend/VisorDatosSig.Api/VisorDatosSig.Api.csproj \
    --configuration Release \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "VisorDatosSig.Api.dll"]
