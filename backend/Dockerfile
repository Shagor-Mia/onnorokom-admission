FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["SchoolAdmission.Api/SchoolAdmission.Api.csproj", "SchoolAdmission.Api/"]
COPY ["SchoolAdmission.Application/SchoolAdmission.Application.csproj", "SchoolAdmission.Application/"]
COPY ["SchoolAdmission.Domain/SchoolAdmission.Domain.csproj", "SchoolAdmission.Domain/"]
COPY ["SchoolAdmission.Infrastructure/SchoolAdmission.Infrastructure.csproj", "SchoolAdmission.Infrastructure/"]
RUN dotnet restore "SchoolAdmission.Api/SchoolAdmission.Api.csproj"

COPY . .
WORKDIR /src/SchoolAdmission.Api
RUN dotnet publish "SchoolAdmission.Api.csproj" --configuration Release --output /app/publish --no-restore

# --- Test stage: `docker compose --profile test run --rm backend-tests` ---
# Runs unit + PostgreSQL integration tests (TEST_DATABASE_CONNECTION is set by compose).
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS test
WORKDIR /src
COPY . .
RUN dotnet restore SchoolAdmission.sln
RUN dotnet build SchoolAdmission.sln --no-restore --configuration Release
ENTRYPOINT ["dotnet", "test", "SchoolAdmission.sln", "--no-build", "--configuration", "Release", "--logger", "console;verbosity=normal"]

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
