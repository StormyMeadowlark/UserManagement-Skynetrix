const { Queue, Worker, QueueScheduler, Job } = require("bullmq");
const redis = require("./redis");

const defaultConnection = redis.duplicate(); // avoid interference with app Redis

/**
 * Create a new queue
 * @param {string} name
 * @returns {Queue}
 */
function createQueue(name) {
  return new Queue(name, {
    connection: defaultConnection,
  });
}

/**
 * Create a worker for a queue
 * @param {string} name
 * @param {Function} processor
 * @returns {Worker}
 */
function createWorker(name, processor) {
  new QueueScheduler(name, { connection: defaultConnection }); // Required to manage delayed/retried jobs

  return new Worker(name, processor, {
    connection: defaultConnection,
  });
}

/**
 * Add a job to a queue
 */
async function addJob(queue, data, opts = {}) {
  return await queue.add(queue.name, data, opts);
}

const usageQueue = createQueue("usage-events"); 

module.exports = {
  createQueue,
  createWorker,
  addJob,
  usageQueue, // 👈 Export it
};
