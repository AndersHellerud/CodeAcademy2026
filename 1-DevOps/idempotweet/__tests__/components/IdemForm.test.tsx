import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../setup";
import { IdemForm } from "@/app/components/IdemForm";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("IdemForm rendering", () => {
  it("renders author input, content textarea, and submit button", () => {
    render(<IdemForm />, { wrapper: createWrapper() });

    expect(screen.getByLabelText(/author/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /publish idem/i })).toBeInTheDocument();
  });

  it("submit button is disabled when both fields are empty", () => {
    render(<IdemForm />, { wrapper: createWrapper() });

    expect(screen.getByRole("button", { name: /publish idem/i })).toBeDisabled();
  });

  it("submit button is disabled when only author is filled", async () => {
    const user = userEvent.setup();
    render(<IdemForm />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText(/author/i), "Alice");

    expect(screen.getByRole("button", { name: /publish idem/i })).toBeDisabled();
  });

  it("submit button is disabled when only content is filled", async () => {
    const user = userEvent.setup();
    render(<IdemForm />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText(/content/i), "Hello world");

    expect(screen.getByRole("button", { name: /publish idem/i })).toBeDisabled();
  });

  it("submit button is enabled when both fields have text", async () => {
    const user = userEvent.setup();
    render(<IdemForm />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText(/author/i), "Alice");
    await user.type(screen.getByLabelText(/content/i), "Hello world");

    expect(screen.getByRole("button", { name: /publish idem/i })).not.toBeDisabled();
  });
});

describe("IdemForm character counters", () => {
  it("shows author character count", async () => {
    const user = userEvent.setup();
    render(<IdemForm />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText(/author/i), "Hello");

    expect(screen.getByText("5/50 characters")).toBeInTheDocument();
  });

  it("shows content character count", async () => {
    const user = userEvent.setup();
    render(<IdemForm />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText(/content/i), "Hi");

    expect(screen.getByText("2/280 characters")).toBeInTheDocument();
  });
});

describe("IdemForm submission", () => {
  it("shows success message after successful submission", async () => {
    server.use(
      http.post("/api/publish", () =>
        HttpResponse.json({ success: true, id: "idem-123" })
      )
    );
    const user = userEvent.setup();
    render(<IdemForm />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText(/author/i), "Alice");
    await user.type(screen.getByLabelText(/content/i), "Hello world");
    await user.click(screen.getByRole("button", { name: /publish idem/i }));

    await waitFor(() => {
      expect(screen.getByText(/idem published/i)).toBeInTheDocument();
    });
  });

  it("clears fields after successful submission", async () => {
    server.use(
      http.post("/api/publish", () =>
        HttpResponse.json({ success: true, id: "idem-123" })
      )
    );
    const user = userEvent.setup();
    render(<IdemForm />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText(/author/i), "Alice");
    await user.type(screen.getByLabelText(/content/i), "Hello world");
    await user.click(screen.getByRole("button", { name: /publish idem/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/author/i)).toHaveValue("");
      expect(screen.getByLabelText(/content/i)).toHaveValue("");
    });
  });

  it("shows the API error message on failure", async () => {
    server.use(
      http.post("/api/publish", () =>
        HttpResponse.json({ message: "Queue unavailable" }, { status: 500 })
      )
    );
    const user = userEvent.setup();
    render(<IdemForm />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText(/author/i), "Alice");
    await user.type(screen.getByLabelText(/content/i), "Hello world");
    await user.click(screen.getByRole("button", { name: /publish idem/i }));

    await waitFor(() => {
      expect(screen.getByText("Queue unavailable")).toBeInTheDocument();
    });
  });

  it("shows fallback error when API returns no message", async () => {
    server.use(
      http.post("/api/publish", () =>
        HttpResponse.json({}, { status: 500 })
      )
    );
    const user = userEvent.setup();
    render(<IdemForm />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText(/author/i), "Alice");
    await user.type(screen.getByLabelText(/content/i), "Hello world");
    await user.click(screen.getByRole("button", { name: /publish idem/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to publish idem/i)).toBeInTheDocument();
    });
  });

  it("shows network error when fetch throws", async () => {
    server.use(
      http.post("/api/publish", () => HttpResponse.error())
    );
    const user = userEvent.setup();
    render(<IdemForm />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText(/author/i), "Alice");
    await user.type(screen.getByLabelText(/content/i), "Hello world");
    await user.click(screen.getByRole("button", { name: /publish idem/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
