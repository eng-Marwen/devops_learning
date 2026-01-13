const request = require("supertest");
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");

describe("Server API Tests", () => {
  let app;
  let mockUser;

  beforeAll(() => {
    // Mock User model
    mockUser = {
      findOneAndUpdate: jest.fn(),
      findOne: jest.fn(),
    };

    // Setup express app for testing
    app = express();
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    // Define routes
    app.get("/", (req, res) => {
      res.status(200).json({ message: "OK" });
    });

    app.post("/update-profile", async (req, res) => {
      try {
        let userObj = req.body;
        userObj.userid = 1;

        await mockUser.findOneAndUpdate({ userid: 1 }, userObj, {
          upsert: true,
          new: true,
        });

        res.send(userObj);
      } catch (err) {
        res.status(500).send({ error: "Database operation failed" });
      }
    });

    app.get("/get-profile", async (req, res) => {
      try {
        const user = await mockUser.findOne({ userid: 1 });
        res.send(
          user
            ? user
            : {
                name: "Anna Smith",
                email: "anna.smith@example.com",
                interests: "coding",
              }
        );
      } catch (err) {
        res.send({
          name: "Anna Smith",
          email: "anna.smith@example.com",
          interests: "coding",
        });
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /", () => {
    it("should return 200 status", async () => {
      const response = await request(app).get("/");
      expect(response.status).toBe(200);
    });
  });

  describe("POST /update-profile", () => {
    it("should update user profile successfully", async () => {
      const mockUserData = {
        userid: 1,
        name: "John Doe",
        email: "john@example.com",
        interests: "testing",
      };

      mockUser.findOneAndUpdate.mockResolvedValue(mockUserData);

      const response = await request(app).post("/update-profile").send({
        name: "John Doe",
        email: "john@example.com",
        interests: "testing",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("name", "John Doe");
      expect(response.body).toHaveProperty("email", "john@example.com");
      expect(response.body).toHaveProperty("userid", 1);
    });

    it("should handle database errors", async () => {
      mockUser.findOneAndUpdate.mockRejectedValue(new Error("DB Error"));

      const response = await request(app)
        .post("/update-profile")
        .send({ name: "Test User" });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty(
        "error",
        "Database operation failed"
      );
    });
  });

  describe("GET /get-profile", () => {
    it("should return user profile from database", async () => {
      const mockUserData = {
        userid: 1,
        name: "Jane Doe",
        email: "jane@example.com",
        interests: "reading",
      };

      mockUser.findOne.mockResolvedValue(mockUserData);

      const response = await request(app).get("/get-profile");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("name", "Jane Doe");
      expect(response.body).toHaveProperty("email", "jane@example.com");
      expect(response.body).toHaveProperty("interests", "reading");
    });

    it("should return default profile when no user found", async () => {
      mockUser.findOne.mockResolvedValue(null);

      const response = await request(app).get("/get-profile");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("name", "Anna Smith");
      expect(response.body).toHaveProperty("email", "anna.smith@example.com");
      expect(response.body).toHaveProperty("interests", "coding");
    });

    it("should handle database errors gracefully", async () => {
      mockUser.findOne.mockRejectedValue(new Error("DB Error"));

      const response = await request(app).get("/get-profile");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("name", "Anna Smith");
      expect(response.body).toHaveProperty("email", "anna.smith@example.com");
    });
  });
});
