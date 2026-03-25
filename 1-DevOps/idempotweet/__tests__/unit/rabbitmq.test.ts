import { describe, it, expect, vi, afterEach } from "vitest";

const mockAssertQueue = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSendToQueue = vi.hoisted(() => vi.fn().mockReturnValue(true));
const mockChannelClose = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockConnectionClose = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockCreateChannel = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    assertQueue: mockAssertQueue,
    sendToQueue: mockSendToQueue,
    close: mockChannelClose,
  })
);
const mockConnect = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    createChannel: mockCreateChannel,
    close: mockConnectionClose,
  })
);

vi.mock("amqplib", () => ({
  default: { connect: mockConnect },
}));

import { getChannel, publishIdemCreated, closeConnection, IdemCreatedEvent } from "@/lib/rabbitmq";

afterEach(async () => {
  await closeConnection();
  vi.clearAllMocks();
});

describe("getChannel", () => {
  it("connects and creates a channel on first call", async () => {
    const channel = await getChannel();

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockCreateChannel).toHaveBeenCalledTimes(1);
    expect(mockAssertQueue).toHaveBeenCalledWith("idem-events", { durable: true });
    expect(channel).toBeDefined();
  });

  it("returns the cached channel on subsequent calls", async () => {
    const channel1 = await getChannel();
    const channel2 = await getChannel();

    expect(channel1).toBe(channel2);
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockCreateChannel).toHaveBeenCalledTimes(1);
  });
});

describe("publishIdemCreated", () => {
  it("sends the serialised event to the idem-events queue", async () => {
    const event: IdemCreatedEvent = {
      type: "idem.created",
      timestamp: "2025-01-01T00:00:00Z",
      data: {
        id: "idem-1",
        author: "Alice",
        content: "Hello world",
        createdAt: "2025-01-01T00:00:00Z",
        isSeeded: false,
      },
    };

    await publishIdemCreated(event);

    expect(mockSendToQueue).toHaveBeenCalledWith(
      "idem-events",
      Buffer.from(JSON.stringify(event)),
      { persistent: true, contentType: "application/json" }
    );
  });
});

describe("closeConnection", () => {
  it("closes channel and connection when both exist", async () => {
    await getChannel();

    await closeConnection();

    expect(mockChannelClose).toHaveBeenCalledTimes(1);
    expect(mockConnectionClose).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when nothing is connected", async () => {
    await closeConnection();

    expect(mockChannelClose).not.toHaveBeenCalled();
    expect(mockConnectionClose).not.toHaveBeenCalled();
  });

  it("resets state so getChannel reconnects after close", async () => {
    await getChannel();
    await closeConnection();
    vi.clearAllMocks();

    await getChannel();

    expect(mockConnect).toHaveBeenCalledTimes(1);
  });
});
