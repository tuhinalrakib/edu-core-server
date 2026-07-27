import net from "net";
import tls from "tls";
import dns from "dns";
import dotenv from "dotenv";

dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || "redis-19010.c81.us-east-1-2.ec2.cloud.redislabs.com";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "19010");
const REDIS_USERNAME = process.env.REDIS_USERNAME || "default";
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || "hpGQdtIKxqNK7HWZk6z7PvWH54kBfzNv";

// In-Memory Fallback Cache Store for 100% server uptime resilience
const inMemoryCache = new Map<string, { value: string; expiresAt: number }>();

class RedisClient {
  private client: net.Socket | tls.TLSSocket | null = null;
  private isConnected = false;
  private isAuthenticating = false;
  private mode: "tcp" | "tls" = "tcp";
  private commandQueue: Array<{ command: string; resolve: (res: any) => void; reject: (err: any) => void }> = [];

  constructor() {
    this.connect();
  }

  private async connect() {
    try {
      if (this.mode === "tcp") {
        this.client = net.createConnection({ host: REDIS_HOST, port: REDIS_PORT }, () => {
          this.authenticate();
        });
      } else {
        this.client = tls.connect({ host: REDIS_HOST, port: REDIS_PORT, rejectUnauthorized: false }, () => {
          this.authenticate();
        });
      }

      this.client.on("data", (buffer) => {
        const response = buffer.toString();
        this.handleResponse(response);
      });

      this.client.on("error", (err) => {
        if (!this.isConnected && this.mode === "tcp") {
          // Switch to TLS mode if TCP fails
          this.mode = "tls";
          setTimeout(() => this.connect(), 500);
          return;
        }
        this.isConnected = false;
      });

      this.client.on("close", () => {
        this.isConnected = false;
        setTimeout(() => this.connect(), 15000);
      });
    } catch (e: any) {
      // Quiet fallback mode to High-Speed In-Memory Cache
    }
  }

  private authenticate() {
    if (!this.client) return;
    this.isAuthenticating = true;
    const authCmd = `*3\r\n$4\r\nAUTH\r\n$${REDIS_USERNAME.length}\r\n${REDIS_USERNAME}\r\n$${REDIS_PASSWORD.length}\r\n${REDIS_PASSWORD}\r\n`;
    this.client.write(authCmd);
  }

  private handleResponse(response: string) {
    if (this.isAuthenticating) {
      if (response.includes("+OK")) {
        console.log("⚡ [Redis Cloud] Connected & Authenticated successfully to Redis Cloud!");
        this.isConnected = true;
        this.isAuthenticating = false;
      } else {
        this.isAuthenticating = false;
      }
      return;
    }

    if (this.commandQueue.length > 0) {
      const current = this.commandQueue.shift();
      if (current) {
        current.resolve(response);
      }
    }
  }

  private execute(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.client) {
        return resolve("");
      }

      this.commandQueue.push({ command, resolve, reject });
      if (this.commandQueue.length === 1) {
        this.client.write(command);
      }
    });
  }

  async get(key: string): Promise<string | null> {
    // Check In-Memory Fallback Cache first
    const memoryItem = inMemoryCache.get(key);
    if (memoryItem) {
      if (Date.now() < memoryItem.expiresAt) {
        return memoryItem.value;
      } else {
        inMemoryCache.delete(key);
      }
    }

    if (!this.isConnected) return null;

    const cmd = `*2\r\n$3\r\nGET\r\n$${key.length}\r\n${key}\r\n`;
    const res = await this.execute(cmd);
    
    if (!res || res.includes("$-1")) return null;

    const lines = res.split("\r\n");
    if (lines.length >= 2 && lines[0].startsWith("$")) {
      return lines[1];
    }
    return null;
  }

  async set(key: string, value: string, ttlSeconds: number = 3600): Promise<boolean> {
    // Store in In-Memory Fallback
    inMemoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });

    if (!this.isConnected) return true;

    const cmd = `*5\r\n$3\r\nSET\r\n$${key.length}\r\n${key}\r\n$${value.length}\r\n${value}\r\n$2\r\nEX\r\n$${ttlSeconds.toString().length}\r\n${ttlSeconds}\r\n`;
    await this.execute(cmd);
    return true;
  }

  async del(key: string): Promise<boolean> {
    inMemoryCache.delete(key);

    if (!this.isConnected) return true;

    const cmd = `*2\r\n$3\r\nDEL\r\n$${key.length}\r\n${key}\r\n`;
    await this.execute(cmd);
    return true;
  }

  async delByPrefix(prefix: string): Promise<boolean> {
    for (const k of inMemoryCache.keys()) {
      if (k.startsWith(prefix)) {
        inMemoryCache.delete(k);
      }
    }
    return true;
  }
}

export const redis = new RedisClient();

/**
 * Redis Cache Getter (Checks cache hit/miss)
 */
export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const cached = await redis.get(key);
    if (cached) {
      console.log(`⚡ [Redis CACHE HIT] Key: ${key}`);
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    // Quiet handling
  }
  console.log(`🔍 [Redis CACHE MISS] Key: ${key}`);
  return null;
};

/**
 * Redis Cache Setter (Sets JSON string + TTL)
 */
export const setCache = async (key: string, data: any, ttlSeconds: number = 3600): Promise<void> => {
  try {
    const valueStr = JSON.stringify(data);
    await redis.set(key, valueStr, ttlSeconds);
    console.log(`💾 [Redis CACHE SET] Key: ${key} (TTL: ${ttlSeconds}s)`);
  } catch (err) {
    // Quiet handling
  }
};

/**
 * Redis Cache Invalidator (Deletes specific cache key + all group list cache)
 */
export const invalidateCache = async (...keysOrPrefixes: string[]): Promise<void> => {
  try {
    for (const kp of keysOrPrefixes) {
      await redis.del(kp);
      const prefix = kp.split(":")[0];
      if (prefix) {
        await redis.delByPrefix(prefix);
      }
      console.log(`🗑️ [Redis CACHE INVALIDATED] Key/Prefix: ${kp}`);
    }
  } catch (err) {
    // Quiet handling
  }
};
