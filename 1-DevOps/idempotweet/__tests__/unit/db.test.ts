import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPoolQuery = vi.hoisted(() => vi.fn());
const mockPoolEnd = vi.hoisted(() => vi.fn());

vi.mock("pg", () => {
  class MockPool {
    query = mockPoolQuery;
    end = mockPoolEnd;
  }
  return { Pool: MockPool };
});

import { query, initializeDatabase, getIdems, getTotalCount, createIdem, closePool } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("query", () => {
  it("delegates to pool.query with text and params", async () => {
    const mockResult = { rows: [{ id: "1" }], rowCount: 1 };
    mockPoolQuery.mockResolvedValueOnce(mockResult);

    const result = await query("SELECT 1", []);

    expect(mockPoolQuery).toHaveBeenCalledWith("SELECT 1", []);
    expect(result).toBe(mockResult);
  });

  it("delegates to pool.query without params", async () => {
    const mockResult = { rows: [], rowCount: 0 };
    mockPoolQuery.mockResolvedValueOnce(mockResult);

    const result = await query("SELECT 1");

    expect(mockPoolQuery).toHaveBeenCalledWith("SELECT 1", undefined);
    expect(result).toBe(mockResult);
  });
});

describe("initializeDatabase", () => {
  it("runs CREATE TABLE, ALTER TABLE, and CREATE INDEX", async () => {
    mockPoolQuery.mockResolvedValue({});

    await initializeDatabase();

    expect(mockPoolQuery).toHaveBeenCalledTimes(3);
    expect(mockPoolQuery.mock.calls[0][0]).toContain("CREATE TABLE IF NOT EXISTS idems");
    expect(mockPoolQuery.mock.calls[1][0]).toContain("ALTER TABLE idems ADD COLUMN IF NOT EXISTS is_seeded");
    expect(mockPoolQuery.mock.calls[2][0]).toContain("CREATE INDEX IF NOT EXISTS idx_idems_created_at");
  });

  it("re-throws on database error", async () => {
    const error = new Error("Connection refused");
    mockPoolQuery.mockRejectedValueOnce(error);

    await expect(initializeDatabase()).rejects.toThrow("Connection refused");
  });
});

describe("getIdems", () => {
  const mockRow = {
    id: "idem-1",
    author: "Alice",
    content: "Hello world",
    created_at: new Date("2025-01-15T10:00:00Z"),
    is_seeded: false,
  };

  it("returns mapped idems with includeSeeded=true (default)", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [mockRow] });

    const result = await getIdems(1, 10);

    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY created_at DESC"),
      [10, 0]
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "idem-1",
      author: "Alice",
      content: "Hello world",
      createdAt: mockRow.created_at.toISOString(),
      isSeeded: false,
    });
  });

  it("computes correct offset for page > 1", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    await getIdems(3, 5);

    expect(mockPoolQuery).toHaveBeenCalledWith(expect.any(String), [5, 10]);
  });

  it("filters seeded rows when includeSeeded=false", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    await getIdems(1, 20, false);

    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE is_seeded = false"),
      [20, 0]
    );
  });
});

describe("getTotalCount", () => {
  it("returns total count including seeded (default)", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ count: "42" }] });

    const count = await getTotalCount();

    expect(count).toBe(42);
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT COUNT(*)"),
      undefined
    );
    expect(mockPoolQuery.mock.calls[0][0]).not.toContain("is_seeded");
  });

  it("returns count excluding seeded when includeSeeded=false", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ count: "7" }] });

    const count = await getTotalCount(false);

    expect(count).toBe(7);
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE is_seeded = false"),
      undefined
    );
  });
});

describe("createIdem", () => {
  it("inserts idem with correct parameters", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    await createIdem({
      id: "idem-99",
      author: "Bob",
      content: "Test post",
      createdAt: "2025-06-01T12:00:00Z",
    });

    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO idems"),
      ["idem-99", "Bob", "Test post", "2025-06-01T12:00:00Z"]
    );
  });
});

describe("closePool", () => {
  it("calls pool.end()", async () => {
    mockPoolEnd.mockResolvedValueOnce(undefined);

    await closePool();

    expect(mockPoolEnd).toHaveBeenCalledTimes(1);
  });
});
