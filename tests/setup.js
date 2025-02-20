const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log("✅ Connected to in-memory MongoDB");
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase(); // Clear database before each test
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
  console.log("🛑 In-memory MongoDB stopped");
});
