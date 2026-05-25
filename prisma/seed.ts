import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create sample users
  const alice = await prisma.user.upsert({
    where: { clerkId: "clerk_seed_alice" },
    create: {
      clerkId: "clerk_seed_alice",
      email: "alice@example.com",
      name: "Alice Engineer",
      imageUrl: null,
    },
    update: {},
  });

  const bob = await prisma.user.upsert({
    where: { clerkId: "clerk_seed_bob" },
    create: {
      clerkId: "clerk_seed_bob",
      email: "bob@example.com",
      name: "Bob Architect",
      imageUrl: null,
    },
    update: {},
  });

  // Create projects for Alice
  const ecommerce = await prisma.project.upsert({
    where: { id: "seed-project-ecommerce" },
    create: {
      id: "seed-project-ecommerce",
      name: "E-Commerce Platform",
      description: "Microservices architecture for a scalable online marketplace",
      userId: alice.id,
    },
    update: {},
  });

  const chatApp = await prisma.project.upsert({
    where: { id: "seed-project-chat" },
    create: {
      id: "seed-project-chat",
      name: "Real-time Chat App",
      description: "WebSocket-based messaging system with presence indicators",
      userId: alice.id,
    },
    update: {},
  });

  await prisma.project.upsert({
    where: { id: "seed-project-api-gateway" },
    create: {
      id: "seed-project-api-gateway",
      name: "API Gateway",
      description: "Centralized gateway with rate limiting and auth",
      userId: alice.id,
    },
    update: {},
  });

  // Create a project for Bob
  await prisma.project.upsert({
    where: { id: "seed-project-ml-pipeline" },
    create: {
      id: "seed-project-ml-pipeline",
      name: "ML Pipeline",
      description: "Data ingestion and model training pipeline on Kubernetes",
      userId: bob.id,
    },
    update: {},
  });

  // Bob is a collaborator on Alice's E-Commerce project
  await prisma.collaborator.upsert({
    where: { projectId_email: { projectId: ecommerce.id, email: bob.email } },
    create: {
      projectId: ecommerce.id,
      userId: bob.id,
      email: bob.email,
      role: "EDITOR",
    },
    update: {},
  });

  // Alice is a collaborator on Bob's chat app... wait, let's make Bob collab on chat app
  await prisma.collaborator.upsert({
    where: { projectId_email: { projectId: chatApp.id, email: bob.email } },
    create: {
      projectId: chatApp.id,
      userId: bob.id,
      email: bob.email,
      role: "VIEWER",
    },
    update: {},
  });

  // Create a sample AI generation record
  await prisma.aIGeneration.upsert({
    where: { id: "seed-generation-1" },
    create: {
      id: "seed-generation-1",
      projectId: ecommerce.id,
      prompt: "Design a microservices architecture for an e-commerce platform with user management, product catalog, and order processing",
      status: "completed",
      result: {
        nodes: [
          { id: "api-gateway", type: "service", label: "API Gateway" },
          { id: "user-service", type: "service", label: "User Service" },
          { id: "product-service", type: "service", label: "Product Service" },
          { id: "order-service", type: "service", label: "Order Service" },
        ],
      },
    },
    update: {},
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
