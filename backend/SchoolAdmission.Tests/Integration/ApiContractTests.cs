using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Xunit;

namespace SchoolAdmission.Tests.Integration;

/// <summary>
/// End-to-end HTTP tests of the eight contract routes: exact JSON field names,
/// status codes, header validation, and business rules, against PostgreSQL.
/// </summary>
public sealed class ApiContractTests
{
    private const string StudentA = "20152691234567890";
    private const string StudentB = "20152691234567891";

    [PostgreSqlFact]
    public async Task CreateClass_Returns201WithContractShape()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        await using var factory = new AdmissionApiFactory(database.ConnectionString);
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/classes",
            new { name = "Class 6 - Morning Shift", totalSeats = 120 });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await ReadJsonAsync(response);
        AssertHasExactly(body, "id", "name", "totalSeats");
        Assert.StartsWith("c_", body.GetProperty("id").GetString());
        Assert.Equal("Class 6 - Morning Shift", body.GetProperty("name").GetString());
        Assert.Equal(120, body.GetProperty("totalSeats").GetInt32());
        Assert.NotNull(response.Headers.Location);
    }

    [PostgreSqlFact]
    public async Task CreateClass_InvalidPayloads_Return400NotServerError()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        await using var factory = new AdmissionApiFactory(database.ConnectionString);
        var client = factory.CreateClient();

        string[] payloads =
        [
            "{}",
            "{\"name\":\"\",\"totalSeats\":10}",
            "{\"name\":\"   \",\"totalSeats\":10}",
            "{\"name\":\"Class 7\",\"totalSeats\":0}",
            "{\"name\":\"Class 7\",\"totalSeats\":-5}",
            "{\"name\":\"Class 7\",\"totalSeats\":\"ten\"}",
            "{\"name\":\"Class 7\",\"totalSeats\":1.5}",
            "{\"name\":\"Class 7\"}",
            "{\"totalSeats\":10}",
            "{not json",
            "[]"
        ];

        foreach (var payload in payloads)
        {
            var response = await client.PostAsync(
                "/classes",
                new StringContent(payload, Encoding.UTF8, "application/json"));
            Assert.True(
                response.StatusCode == HttpStatusCode.BadRequest,
                $"Payload {payload} returned {(int)response.StatusCode}.");
        }

        var listed = await client.GetFromJsonAsync<JsonElement>("/classes");
        Assert.Equal(0, listed.GetArrayLength());
    }

    [PostgreSqlFact]
    public async Task ListAndGetClass_ReturnSeatMetrics()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        await using var factory = new AdmissionApiFactory(database.ConnectionString);
        var client = factory.CreateClient();
        var classId = await CreateClassAsync(client, "Class 6 - Day Shift", 3);

        var heldHold = await CreateHoldAsync(client, classId, StudentA);
        Assert.Equal(HttpStatusCode.Created, heldHold.StatusCode);
        var confirmedHold = await ReadJsonAsync(await CreateHoldAsync(client, classId, StudentB));
        var confirm = await SendAsync(
            client,
            HttpMethod.Post,
            $"/holds/{confirmedHold.GetProperty("holdId").GetString()}/confirm",
            StudentB);
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);

        var list = await client.GetFromJsonAsync<JsonElement>("/classes");
        Assert.Equal(1, list.GetArrayLength());
        var listed = list[0];
        AssertHasExactly(
            listed,
            "id", "name", "totalSeats", "heldSeats", "confirmedSeats", "availableSeats");
        AssertMetrics(listed, total: 3, held: 1, confirmed: 1, available: 1);

        var single = await client.GetAsync($"/classes/{classId}");
        Assert.Equal(HttpStatusCode.OK, single.StatusCode);
        AssertMetrics(await ReadJsonAsync(single), total: 3, held: 1, confirmed: 1, available: 1);
    }

    [PostgreSqlFact]
    public async Task UnknownOrMalformedIds_Return404()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        await using var factory = new AdmissionApiFactory(database.ConnectionString);
        var client = factory.CreateClient();
        var missingClass = $"c_{Guid.NewGuid():N}";
        var missingHold = $"h_{Guid.NewGuid():N}";

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/classes/{missingClass}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/classes/c_123")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/classes/does-not-exist")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/holds/{missingHold}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/holds/h_789")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await CreateHoldAsync(client, missingClass, StudentA)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await SendAsync(client, HttpMethod.Post, $"/holds/{missingHold}/confirm", StudentA)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await SendAsync(client, HttpMethod.Delete, $"/holds/{missingHold}", StudentA)).StatusCode);
    }

    [PostgreSqlFact]
    public async Task StudentHeader_MissingOrInvalid_Returns400()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        await using var factory = new AdmissionApiFactory(database.ConnectionString);
        var client = factory.CreateClient();
        var classId = await CreateClassAsync(client, "Class 8", 5);
        var hold = await ReadJsonAsync(await CreateHoldAsync(client, classId, StudentA));
        var holdId = hold.GetProperty("holdId").GetString();

        string?[] invalidIds = [null, "", "1234567890123456", "123456789012345678", "2015269123456789X", "2015-2691-2345678"];
        foreach (var invalid in invalidIds)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await SendAsync(client, HttpMethod.Post, $"/classes/{classId}/holds", invalid)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await SendAsync(client, HttpMethod.Post, $"/holds/{holdId}/confirm", invalid)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await SendAsync(client, HttpMethod.Delete, $"/holds/{holdId}", invalid)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await SendAsync(client, HttpMethod.Get, "/me/holds", invalid)).StatusCode);
        }

        var error = await ReadJsonAsync(await SendAsync(client, HttpMethod.Get, "/me/holds", "abc"));
        Assert.Equal("INVALID_STUDENT_ID", error.GetProperty("code").GetString());
    }

    [PostgreSqlFact]
    public async Task HoldLifecycle_FollowsContractAndRules()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        await using var factory = new AdmissionApiFactory(database.ConnectionString);
        var client = factory.CreateClient();
        var classId = await CreateClassAsync(client, "Class 9 - Morning Shift", 5);

        // 4. POST /classes/{classId}/holds
        var before = DateTimeOffset.UtcNow;
        var createResponse = await CreateHoldAsync(client, classId, StudentA);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await ReadJsonAsync(createResponse);
        AssertHasExactly(created, "holdId", "classId", "studentId", "status", "expiresAt");
        var holdId = created.GetProperty("holdId").GetString()!;
        Assert.StartsWith("h_", holdId);
        Assert.Equal(classId, created.GetProperty("classId").GetString());
        Assert.Equal(StudentA, created.GetProperty("studentId").GetString());
        Assert.Equal("HELD", created.GetProperty("status").GetString());
        var expiresAtText = created.GetProperty("expiresAt").GetString()!;
        Assert.EndsWith("Z", expiresAtText);
        var expiresAt = DateTimeOffset.Parse(expiresAtText);
        Assert.InRange(expiresAt, before.AddSeconds(598), DateTimeOffset.UtcNow.AddSeconds(601));

        // Same student, same class while active -> 409.
        var duplicate = await CreateHoldAsync(client, classId, StudentA);
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal("DUPLICATE_ACTIVE_APPLICATION", (await ReadJsonAsync(duplicate)).GetProperty("code").GetString());

        // 5. GET /holds/{holdId}
        var status = await ReadJsonAsync(await client.GetAsync($"/holds/{holdId}"));
        foreach (var field in new[] { "holdId", "classId", "status", "expiresAt" })
        {
            Assert.True(status.TryGetProperty(field, out _), $"Missing {field}");
        }

        Assert.Equal("HELD", status.GetProperty("status").GetString());
        Assert.Equal(expiresAtText, status.GetProperty("expiresAt").GetString());

        // 6. POST /holds/{holdId}/confirm — owner only, idempotent.
        Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(client, HttpMethod.Post, $"/holds/{holdId}/confirm", StudentB)).StatusCode);
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var confirm = await SendAsync(client, HttpMethod.Post, $"/holds/{holdId}/confirm", StudentA);
            Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
            var confirmed = await ReadJsonAsync(confirm);
            AssertHasExactly(confirmed, "holdId", "status");
            Assert.Equal(holdId, confirmed.GetProperty("holdId").GetString());
            Assert.Equal("CONFIRMED", confirmed.GetProperty("status").GetString());
        }

        AssertMetrics(await ReadJsonAsync(await client.GetAsync($"/classes/{classId}")), 5, 0, 1, 4);

        // A confirmed student cannot apply again to the same class; confirmed cannot be cancelled.
        Assert.Equal(HttpStatusCode.Conflict, (await CreateHoldAsync(client, classId, StudentA)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await SendAsync(client, HttpMethod.Delete, $"/holds/{holdId}", StudentA)).StatusCode);

        // 7. DELETE /holds/{holdId} — owner only, 204, idempotent; cancelled cannot be confirmed.
        var other = await ReadJsonAsync(await CreateHoldAsync(client, classId, StudentB));
        var otherId = other.GetProperty("holdId").GetString();
        Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(client, HttpMethod.Delete, $"/holds/{otherId}", StudentA)).StatusCode);
        var cancel = await SendAsync(client, HttpMethod.Delete, $"/holds/{otherId}", StudentB);
        Assert.Equal(HttpStatusCode.NoContent, cancel.StatusCode);
        Assert.Empty(await cancel.Content.ReadAsByteArrayAsync());
        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(client, HttpMethod.Delete, $"/holds/{otherId}", StudentB)).StatusCode);
        Assert.Equal("CANCELLED", (await ReadJsonAsync(await client.GetAsync($"/holds/{otherId}"))).GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await SendAsync(client, HttpMethod.Post, $"/holds/{otherId}/confirm", StudentB)).StatusCode);
        AssertMetrics(await ReadJsonAsync(await client.GetAsync($"/classes/{classId}")), 5, 0, 1, 4);

        // After cancelling, the student may apply again.
        Assert.Equal(HttpStatusCode.Created, (await CreateHoldAsync(client, classId, StudentB)).StatusCode);

        // 8. GET /me/holds — only the caller's records, newest first, with class name.
        var mine = await ReadJsonAsync(await SendAsync(client, HttpMethod.Get, "/me/holds", StudentB));
        Assert.Equal(2, mine.GetArrayLength());
        foreach (var item in mine.EnumerateArray())
        {
            foreach (var field in new[] { "holdId", "classId", "className", "status", "expiresAt" })
            {
                Assert.True(item.TryGetProperty(field, out _), $"Missing {field}");
            }

            Assert.Equal("Class 9 - Morning Shift", item.GetProperty("className").GetString());
        }

        Assert.Equal("HELD", mine[0].GetProperty("status").GetString());
        Assert.Equal("CANCELLED", mine[1].GetProperty("status").GetString());

        var otherStudent = await ReadJsonAsync(await SendAsync(client, HttpMethod.Get, "/me/holds", "99999999999999999"));
        Assert.Equal(0, otherStudent.GetArrayLength());
    }

    [PostgreSqlFact]
    public async Task FullClass_Returns409NoSeats()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        await using var factory = new AdmissionApiFactory(database.ConnectionString);
        var client = factory.CreateClient();
        var classId = await CreateClassAsync(client, "Class 10", 1);

        Assert.Equal(HttpStatusCode.Created, (await CreateHoldAsync(client, classId, StudentA)).StatusCode);
        var full = await CreateHoldAsync(client, classId, StudentB);

        Assert.Equal(HttpStatusCode.Conflict, full.StatusCode);
        Assert.Equal("NO_SEATS_AVAILABLE", (await ReadJsonAsync(full)).GetProperty("code").GetString());
    }

    [PostgreSqlFact]
    public async Task ConcurrentHttpHoldRequests_NeverExceedCapacity()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        await using var factory = new AdmissionApiFactory(database.ConnectionString);
        var client = factory.CreateClient();
        var classId = await CreateClassAsync(client, "Class 6 - Rush", 5);

        var responses = await Task.WhenAll(Enumerable.Range(0, 60).Select(index =>
            CreateHoldAsync(client, classId, (10_000_000_000_000_000L + index).ToString())));

        Assert.Equal(5, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        Assert.Equal(55, responses.Count(response => response.StatusCode == HttpStatusCode.Conflict));
        AssertMetrics(await ReadJsonAsync(await client.GetAsync($"/classes/{classId}")), 5, 5, 0, 0);
    }

    [PostgreSqlFact]
    public async Task ConcurrentConfirmations_CountConfirmedSeatOnce()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        await using var factory = new AdmissionApiFactory(database.ConnectionString);
        var client = factory.CreateClient();
        var classId = await CreateClassAsync(client, "Class 6 - Pay", 3);
        var holdId = (await ReadJsonAsync(await CreateHoldAsync(client, classId, StudentA)))
            .GetProperty("holdId").GetString();

        var responses = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ =>
            SendAsync(client, HttpMethod.Post, $"/holds/{holdId}/confirm", StudentA)));

        Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        AssertMetrics(await ReadJsonAsync(await client.GetAsync($"/classes/{classId}")), 3, 0, 1, 2);
    }

    [PostgreSqlFact]
    public async Task ExpiredHold_ReleasesSeatAndCannotBeConfirmed()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        await using var factory = new AdmissionApiFactory(database.ConnectionString, holdDurationSeconds: 2);
        var client = factory.CreateClient();
        var classId = await CreateClassAsync(client, "Class 6 - Short Hold", 1);

        var hold = await ReadJsonAsync(await CreateHoldAsync(client, classId, StudentA));
        var holdId = hold.GetProperty("holdId").GetString();
        var expiresAt = DateTimeOffset.Parse(hold.GetProperty("expiresAt").GetString()!);
        Assert.InRange(expiresAt, DateTimeOffset.UtcNow.AddSeconds(-1), DateTimeOffset.UtcNow.AddSeconds(3));
        Assert.Equal(HttpStatusCode.Conflict, (await CreateHoldAsync(client, classId, StudentB)).StatusCode);

        await Task.Delay(TimeSpan.FromSeconds(3.5));

        // Seat is free again without any special API call by the guardian.
        AssertMetrics(await ReadJsonAsync(await client.GetAsync($"/classes/{classId}")), 1, 0, 0, 1);
        Assert.Equal("EXPIRED", (await ReadJsonAsync(await client.GetAsync($"/holds/{holdId}"))).GetProperty("status").GetString());

        var lateConfirm = await SendAsync(client, HttpMethod.Post, $"/holds/{holdId}/confirm", StudentA);
        Assert.Equal(HttpStatusCode.Conflict, lateConfirm.StatusCode);
        Assert.Equal("HOLD_EXPIRED", (await ReadJsonAsync(lateConfirm)).GetProperty("code").GetString());

        Assert.Equal(HttpStatusCode.Created, (await CreateHoldAsync(client, classId, StudentB)).StatusCode);
    }

    [PostgreSqlFact]
    public async Task BackgroundWorker_MarksExpiredHoldsWithoutAnyRequest()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        await using var factory = new AdmissionApiFactory(database.ConnectionString, holdDurationSeconds: 1);
        var client = factory.CreateClient();
        var classId = await CreateClassAsync(client, "Class 6 - Worker", 2);
        var holdId = (await ReadJsonAsync(await CreateHoldAsync(client, classId, StudentA)))
            .GetProperty("holdId").GetString()!;
        var id = Guid.ParseExact(holdId.AsSpan(2), "N");

        var deadline = DateTimeOffset.UtcNow.AddSeconds(15);
        string? persisted = null;
        while (DateTimeOffset.UtcNow < deadline)
        {
            await Task.Delay(TimeSpan.FromSeconds(1));
            await using var dbContext = database.CreateDbContext();
            persisted = (await dbContext.Holds.FindAsync(id))!.Status.ToString();
            if (persisted == "Expired")
            {
                break;
            }
        }

        Assert.Equal("Expired", persisted);
    }

    [PostgreSqlFact]
    public async Task TwoBackendInstancesSharingDatabase_NeverExceedCapacity()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        await using var first = new AdmissionApiFactory(database.ConnectionString);
        await using var second = new AdmissionApiFactory(database.ConnectionString);
        var clientA = first.CreateClient();
        var clientB = second.CreateClient();
        var classId = await CreateClassAsync(clientA, "Class 6 - Two Instances", 10);

        var responses = await Task.WhenAll(Enumerable.Range(0, 80).Select(index =>
            CreateHoldAsync(
                index % 2 == 0 ? clientA : clientB,
                classId,
                (20_000_000_000_000_000L + index).ToString())));

        Assert.Equal(10, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        Assert.Equal(70, responses.Count(response => response.StatusCode == HttpStatusCode.Conflict));
        AssertMetrics(await ReadJsonAsync(await clientB.GetAsync($"/classes/{classId}")), 10, 10, 0, 0);
    }

    [PostgreSqlFact]
    public async Task CorsPreflight_AllowsFrontendOriginAndStudentHeader()
    {
        await using var database = await PostgreSqlTestDatabase.CreateAsync();
        await using var factory = new AdmissionApiFactory(database.ConnectionString);
        var client = factory.CreateClient();

        var request = new HttpRequestMessage(HttpMethod.Options, $"/classes/c_{Guid.NewGuid():N}/holds");
        request.Headers.Add("Origin", "http://localhost:5173");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "x-student-id");
        var response = await client.SendAsync(request);

        Assert.True(response.IsSuccessStatusCode);
        Assert.Equal("http://localhost:5173", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Contains("x-student-id", response.Headers.GetValues("Access-Control-Allow-Headers").Single(), StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<string> CreateClassAsync(HttpClient client, string name, int totalSeats)
    {
        var response = await client.PostAsJsonAsync("/classes", new { name, totalSeats });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJsonAsync(response)).GetProperty("id").GetString()!;
    }

    private static Task<HttpResponseMessage> CreateHoldAsync(HttpClient client, string classId, string studentId) =>
        SendAsync(client, HttpMethod.Post, $"/classes/{classId}/holds", studentId);

    private static Task<HttpResponseMessage> SendAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        string? studentId)
    {
        var request = new HttpRequestMessage(method, path);
        if (studentId is not null)
        {
            request.Headers.TryAddWithoutValidation("X-Student-Id", studentId);
        }

        return client.SendAsync(request);
    }

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

    private static void AssertHasExactly(JsonElement element, params string[] fields) =>
        Assert.Equal(
            fields.OrderBy(field => field),
            element.EnumerateObject().Select(property => property.Name).OrderBy(name => name));

    private static void AssertMetrics(JsonElement element, int total, int held, int confirmed, int available)
    {
        Assert.Equal(total, element.GetProperty("totalSeats").GetInt32());
        Assert.Equal(held, element.GetProperty("heldSeats").GetInt32());
        Assert.Equal(confirmed, element.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(available, element.GetProperty("availableSeats").GetInt32());
    }
}
