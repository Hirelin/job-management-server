import { createClient } from "redis";
import { env } from "../env";

const createRedisClient = () => {
  const client = createClient({
    url: `redis://${env.REDIS_HOST}:${env.REDIS_PORT}/${env.REDIS_DB}`,
  });

  // Connection event handling
  client.on("connect", () => {
    console.log("Connected to Redis");
  });

  client.on("error", (err) => {
    console.error("Redis connection error:", err);
  });

  return client;
};

// Setup global Redis client using singleton pattern (similar to db.ts)
const globalForRedis = globalThis as unknown as {
  redis: ReturnType<typeof createRedisClient> | undefined;
};

export const redis = globalForRedis.redis ?? createRedisClient();

// Only save reference to redis client in development to avoid memory leaks in production
if (env.NODE_ENV !== "production") globalForRedis.redis = redis;

// Connect to Redis (the connection will be established when needed)
const connectRedis = async () => {
  if (!redis.isOpen) {
    await redis.connect();
  }
  return redis;
};

/**
 * Publish an event to a Redis channel
 * @param channel The channel to publish to
 * @param data The data to publish (will be JSON stringified)
 * @returns Promise resolving to the number of clients that received the message
 */
export const publishEvent = async (
  channel: string,
  data: any
): Promise<number> => {
  try {
    const client = await connectRedis();
    const message = typeof data === "string" ? data : JSON.stringify(data);
    const receivers = await client.publish(channel, message);

    if (env.NODE_ENV === "development") {
      console.log(
        `Event published to '${channel}', received by ${receivers} subscribers`
      );
    }

    return receivers;
  } catch (error) {
    console.error(`Error publishing to channel '${channel}':`, error);
    throw error;
  }
};

/**
 * Push an event to a Redis queue (list)
 * @param queueName The name of the queue (Redis list)
 * @param data The data to push (will be JSON stringified)
 * @returns Promise resolving to the length of the list after the push operation
 */
export const pushToQueue = async (
  queueName: string = env.EVENT_QUEUE || "events",
  data: any
): Promise<number> => {
  try {
    const client = await connectRedis();
    const eventJson = typeof data === "string" ? data : JSON.stringify(data);
    const listLength = await client.lPush(queueName, eventJson);

    if (env.NODE_ENV === "development") {
      console.log(
        `Event pushed to Redis queue '${queueName}'. Queue length: ${listLength}`
      );
    }

    return listLength;
  } catch (error) {
    console.error(`Error pushing to queue '${queueName}':`, error);
    throw error;
  }
};

/**
 * Push a job event to the default event queue
 * @param jobEvent The job event data
 * @returns Promise resolving to the length of the queue after push
 */
export const pushEvent = async (jobEvent: any): Promise<number> => {
  const queueName = env.EVENT_QUEUE || "events";
  return await pushToQueue(queueName, jobEvent);
};

/**
 * Close the Redis connection
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redis.isOpen) {
    await redis.quit();
    if (env.NODE_ENV === "development") {
      console.log("Redis connection closed");
    }
  }
};

export default {
  publishEvent,
  pushToQueue,
  pushEvent,
  closeRedisConnection,
  client: redis,
};
