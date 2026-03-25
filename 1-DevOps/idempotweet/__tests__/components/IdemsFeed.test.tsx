import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IdemsFeed } from "@/app/components/IdemsFeed";
import { http, HttpResponse } from "msw";
import { server } from "../setup";
import type { PaginatedIdems } from "@/types/idem";

function createMockResponse(page: number): PaginatedIdems {
  const items = Array.from({ length: 20 }, (_, i) => ({
    id: `idem-${page}-${i}`,
    author: `Author ${i}`,
    content: `Content for page ${page} item ${i}`,
    createdAt: new Date(Date.now() - i * 3600000).toISOString(),
  }));

  return {
    items,
    page,
    pageSize: 20,
    totalCount: 200,
    hasMore: page < 10,
    nextPage: page < 10 ? page + 1 : null,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("IdemsFeed", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/idems", ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        return HttpResponse.json(createMockResponse(page));
      })
    );
  });

  it("renders loading spinner initially", () => {
    render(<IdemsFeed />, { wrapper: createWrapper() });
    // LoadingSpinner renders a div with animate-spin class
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("renders idems after loading", async () => {
    render(<IdemsFeed />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Content for page 1 item 0/)).toBeInTheDocument();
    });
  });

  it("renders multiple idem cards", async () => {
    render(<IdemsFeed />, { wrapper: createWrapper() });

    await waitFor(() => {
      const articles = screen.getAllByRole("article");
      expect(articles.length).toBeGreaterThan(0);
    });
  });

  it("renders error state when API fails", async () => {
    server.use(
      http.get("/api/idems", () => {
        return HttpResponse.json({ error: "Server error" }, { status: 500 });
      })
    );

    render(<IdemsFeed />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load idems/i)).toBeInTheDocument();
    });
  });

  it("renders empty state when no idems", async () => {
    server.use(
      http.get("/api/idems", () => {
        return HttpResponse.json({
          items: [],
          page: 1,
          pageSize: 20,
          totalCount: 0,
          hasMore: false,
          nextPage: null,
        });
      })
    );

    render(<IdemsFeed />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/No idems yet/i)).toBeInTheDocument();
    });
  });
});

describe("IdemsFeed demo mode", () => {
  it("shows demo mode banner when API returns demoMode: true", async () => {
    server.use(
      http.get("/api/idems", () =>
        HttpResponse.json({
          items: [
            {
              id: "idem-1",
              author: "Alice",
              content: "Demo content",
              createdAt: new Date().toISOString(),
              isSeeded: false,
            },
          ],
          page: 1,
          pageSize: 20,
          totalCount: 1,
          hasMore: false,
          nextPage: null,
          demoMode: true,
        })
      )
    );

    render(<IdemsFeed />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Demo-modus/)).toBeInTheDocument();
    });
  });
});

describe("IdemsFeed infinite scroll behavior", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/idems", ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        return HttpResponse.json(createMockResponse(page));
      })
    );
  });

  it("renders feed with idem cards after loading", async () => {
    render(<IdemsFeed />, { wrapper: createWrapper() });

    await waitFor(() => {
      const articles = screen.getAllByRole("article");
      expect(articles.length).toBeGreaterThan(0);
    });
  });

  it("renders sentinel element for scroll detection", async () => {
    render(<IdemsFeed />, { wrapper: createWrapper() });

    await waitFor(() => {
      const sentinel = document.querySelector("[data-testid='scroll-sentinel']");
      expect(sentinel).toBeInTheDocument();
    });
  });
});
