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

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
