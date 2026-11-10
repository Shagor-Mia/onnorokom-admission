using Xunit;

// Integration tests each open their own PostgreSQL connection pools; running them
// one class at a time keeps the total below PostgreSQL's default connection limit.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
