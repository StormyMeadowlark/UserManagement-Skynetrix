import { Queue, Worker, Job } from "bullmq";
import redis from "./redis.js";

const defaultConnection = redis.duplicate();

export function createQueue(name) {
  return new Queue(name, {
    connection: defaultConnection,
  });
}

export async function createWorker(name, processor) {
  return new Worker(name, processor, {
    connection: defaultConnection,
  });
}

export async function addJob(queue, data, opts = {}) {
  return await queue.add(queue.name, data, opts);
}

export const usageQueue = createQueue("usage-events");
