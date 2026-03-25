import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Register child mocks before any import of FeedContainer.
// vi.doMock is not hoisted, but the registrations persist across vi.resetModules() calls,
// so the mocked factories will be used every time FeedContainer is dynamically imported.
beforeAll(() => {
  vi.doMock("@/app/components/IdemsFeed", () => ({
    IdemsFeed: ({ includeSeeded }: { includeSeeded?: boolean }) => (
      <div data-testid="idems-feed" data-include-seeded={String(includeSeeded ?? true)} />
    ),
  }));
  vi.doMock("@/app/components/IdemForm", () => ({
    IdemForm: () => <div data-testid="idem-form" />,
  }));
});

// Clear the module cache before each test so that FeedContainer re-evaluates
// its module-level env-var constants with the current process.env.
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
});

describe("FeedContainer", () => {
  it("always renders IdemsFeed", async () => {
    const { FeedContainer } = await import("@/app/components/FeedContainer");
    render(<FeedContainer />);

    expect(screen.getByTestId("idems-feed")).toBeInTheDocument();
  });

  it("does not render IdemForm when NEXT_PUBLIC_ENABLE_IDEM_FORM is not set", async () => {
    const { FeedContainer } = await import("@/app/components/FeedContainer");
    render(<FeedContainer />);

    expect(screen.queryByTestId("idem-form")).not.toBeInTheDocument();
  });

  it('renders IdemForm when NEXT_PUBLIC_ENABLE_IDEM_FORM is "true"', async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_IDEM_FORM", "true");
    const { FeedContainer } = await import("@/app/components/FeedContainer");
    render(<FeedContainer />);

    expect(screen.getByTestId("idem-form")).toBeInTheDocument();
  });

  it("passes includeSeeded=false when NEXT_PUBLIC_SHOW_SEEDED_IDEMS is not set", async () => {
    const { FeedContainer } = await import("@/app/components/FeedContainer");
    render(<FeedContainer />);

    expect(screen.getByTestId("idems-feed")).toHaveAttribute("data-include-seeded", "false");
  });

  it('passes includeSeeded=true when NEXT_PUBLIC_SHOW_SEEDED_IDEMS is "true"', async () => {
    vi.stubEnv("NEXT_PUBLIC_SHOW_SEEDED_IDEMS", "true");
    const { FeedContainer } = await import("@/app/components/FeedContainer");
    render(<FeedContainer />);

    expect(screen.getByTestId("idems-feed")).toHaveAttribute("data-include-seeded", "true");
  });
});
